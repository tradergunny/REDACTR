import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import {
  hasNegativeKeywordNearby,
  hasSeparator,
  makeRuleMatch,
  pushSignal,
  runGlobalRegex
} from './shared';

const PHONE_REGEX = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/g;
const THAI_LOCAL_MOBILE_REGEX = /^0(?:6|8|9)\d{8}$/;
const DATEISH_REGEX = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
const EXTENSION_REGEX = /\s*(?:ext\.?|x)\s*\d{1,5}$/i;
const NEGATIVE_CONTEXT = ['version', 'build', 'release', 'ticket', 'order', 'ref', 'serial'];

export const phoneRule: PIIRule = {
  id: 'phone.international',
  category: 'phone',
  severity: 'medium',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(PHONE_REGEX, input)) {
      const startIndex = candidate.index ?? 0;
      const rawValue = candidate[0].trim();
      const value = rawValue.replace(EXTENSION_REGEX, '');
      const digits = value.replace(/\D/g, '');
      const isThaiLocalMobile = THAI_LOCAL_MOBILE_REGEX.test(digits);
      const endIndex = startIndex + value.length;
      const scoreSignals: ScoreSignal[] = [];

      if (DATEISH_REGEX.test(value)) {
        continue;
      }

      if (hasNegativeKeywordNearby(input, startIndex, endIndex, NEGATIVE_CONTEXT, 28)) {
        continue;
      }

      if (digits.length < 10 || digits.length > 15) {
        continue;
      }

      if (!value.startsWith('+') && !hasSeparator(value) && !isThaiLocalMobile) {
        continue;
      }

      if (/^\+1/.test(value) || /^\(?\d{3}\)?/.test(value)) {
        pushSignal(scoreSignals, 'us_phone_shape', 'validator', 0.03);
      }

      if (/^\+66/.test(value) || isThaiLocalMobile) {
        pushSignal(scoreSignals, 'thai_phone_shape', 'validator', 0.03);
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'phone.international',
          category: 'phone',
          severity: 'medium',
          baseConfidence: 0.8,
          validationStage: 'validated',
          scoreSignals
        })
      );
    }

    return matches;
  }
};
