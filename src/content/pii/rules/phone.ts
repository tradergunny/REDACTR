import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import {
  hasNegativeKeywordNearby,
  hasSeparator,
  makeRuleMatch,
  pushSignal,
  runGlobalRegex
} from './shared';

const PHONE_REGEX =
  /\b(?:\+?\d{1,3}[\s.\-\u00AD\u2060\u200B\u200C\u200D\uFEFF]{0,3})?(?:\(?\d{2,4}\)?[\s.\-\u00AD\u2060\u200B\u200C\u200D\uFEFF]{0,3}){2,4}\d{3,4}\b/g;
const THAI_LOCAL_MOBILE_REGEX = /^0(?:6|8|9)\d{8}$/;
const THAI_LOCAL_LANDLINE_REGEX = /^0[2-7]\d{7}$/;
const THAI_ID_PREFIX_PHONE_SHAPE_REGEX = /^\d-\d{4}-\d{5}$/;
const THAI_ID_PREFIX_TRAILING_REGEX = /^-\d{2}-\d(?!\d)/;
const DATEISH_REGEX = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
const EXTENSION_REGEX = /\s*(?:ext\.?|x)\s*\d{1,5}$/i;
const NEGATIVE_CONTEXT = ['version', 'build', 'release', 'ticket', 'order', 'ref', 'serial'];
const CANDIDATE_SEPARATOR_REGEX = /[\s,;|\u00AD\u2060\u200B\u200C\u200D\uFEFF]/;
const STRONG_SPLIT_SEPARATOR_REGEX = /[,\n;|]/;

interface PhoneCandidate {
  value: string;
  startIndex: number;
}

const countDigits = (value: string): number => value.replace(/\D/g, '').length;

const trimCandidate = (value: string, startIndex: number): PhoneCandidate => {
  const trimLeftOffset = value.length - value.trimStart().length;
  const trimRightValue = value.trim();
  return {
    value: trimRightValue,
    startIndex: startIndex + trimLeftOffset
  };
};

const splitMergedCandidate = (value: string, startIndex: number): PhoneCandidate[] => {
  const matches: PhoneCandidate[] = [];
  let segmentStart = 0;

  const pushSegment = (segmentEnd: number): void => {
    const segment = trimCandidate(value.slice(segmentStart, segmentEnd), startIndex + segmentStart);
    if (segment.value) {
      matches.push(segment);
    }
  };

  for (let cursor = 1; cursor < value.length; cursor += 1) {
    const separator = value[cursor];
    if (!CANDIDATE_SEPARATOR_REGEX.test(separator)) {
      continue;
    }

    const left = value.slice(segmentStart, cursor).trim();
    const right = value.slice(cursor + 1).trim();
    const shouldSplitByStrongSeparator = STRONG_SPLIT_SEPARATOR_REGEX.test(separator);
    const shouldSplitByWhitespaceBoundary =
      /\s/.test(separator) && countDigits(left) >= 10 && countDigits(right) >= 10;

    if (!shouldSplitByStrongSeparator && !shouldSplitByWhitespaceBoundary) {
      continue;
    }

    pushSegment(cursor);
    segmentStart = cursor + 1;
    while (segmentStart < value.length && CANDIDATE_SEPARATOR_REGEX.test(value[segmentStart])) {
      segmentStart += 1;
    }
    cursor = segmentStart - 1;
  }

  pushSegment(value.length);
  return matches.length ? matches : [trimCandidate(value, startIndex)];
};

const isThaiIdPrefixCapture = (
  input: string,
  value: string,
  endIndex: number
): boolean => {
  if (!THAI_ID_PREFIX_PHONE_SHAPE_REGEX.test(value)) {
    return false;
  }

  return THAI_ID_PREFIX_TRAILING_REGEX.test(input.slice(endIndex, endIndex + 6));
};

export const phoneRule: PIIRule = {
  id: 'phone.international',
  category: 'phone',
  severity: 'medium',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(PHONE_REGEX, input)) {
      let rawStartIndex = candidate.index ?? 0;
      let rawValue = candidate[0];
      if (
        rawStartIndex > 0 &&
        input[rawStartIndex - 1] === '+' &&
        !rawValue.startsWith('+')
      ) {
        rawValue = `+${rawValue}`;
        rawStartIndex -= 1;
      }

      const splitCandidates =
        countDigits(rawValue) > 15
          ? splitMergedCandidate(rawValue, rawStartIndex)
          : [trimCandidate(rawValue, rawStartIndex)];

      for (const splitCandidate of splitCandidates) {
        const value = splitCandidate.value.replace(EXTENSION_REGEX, '');
        const digits = value.replace(/\D/g, '');
        const isThaiLocalMobile = THAI_LOCAL_MOBILE_REGEX.test(digits);
        const isThaiLocalLandline =
          THAI_LOCAL_LANDLINE_REGEX.test(digits) &&
          /^0[2-7][\s().-]+\d{2,4}[\s().-]+\d{3,4}$/.test(value);
        const isThaiLocalPhone = isThaiLocalMobile || isThaiLocalLandline;
        const endIndex = splitCandidate.startIndex + value.length;
        const scoreSignals: ScoreSignal[] = [];

        if (isThaiIdPrefixCapture(input, value, endIndex)) {
          continue;
        }

        if (DATEISH_REGEX.test(value)) {
          continue;
        }

        if (hasNegativeKeywordNearby(input, splitCandidate.startIndex, endIndex, NEGATIVE_CONTEXT, 28)) {
          continue;
        }

        if (
          (!isThaiLocalLandline && (digits.length < 10 || digits.length > 15)) ||
          (isThaiLocalLandline && digits.length !== 9)
        ) {
          continue;
        }

        if (!value.startsWith('+') && !hasSeparator(value) && !isThaiLocalPhone) {
          continue;
        }

        if (/^\+1/.test(value) || /^\(?\d{3}\)?/.test(value)) {
          pushSignal(scoreSignals, 'us_phone_shape', 'validator', 0.03);
        }

        if (/^\+66/.test(value) || isThaiLocalMobile) {
          pushSignal(scoreSignals, 'thai_phone_shape', 'validator', 0.03);
        }
        if (isThaiLocalLandline) {
          pushSignal(scoreSignals, 'thai_landline_shape', 'validator', 0.03);
        }

        matches.push(
          makeRuleMatch(value, splitCandidate.startIndex, {
            rule: 'phone.international',
            category: 'phone',
            severity: 'medium',
            baseConfidence: 0.8,
            validationStage: 'validated',
            scoreSignals
          })
        );
      }
    }

    return matches;
  }
};
