import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import {
  hasNegativeKeywordNearby,
  hasKeywordNearby,
  makeRuleMatch,
  pushSignal,
  runGlobalRegex
} from './shared';

const THAI_PASSPORT_REGEX = /\b[A-Z]{1,2}\d{6,7}\b/g;
const US_PASSPORT_REGEX = /\b[A-Z0-9]{9}\b/g;
const PASSPORT_KEYWORDS = ['passport', 'หนังสือเดินทาง'];
const PASSPORT_NEGATIVE_KEYWORDS = [
  'serial',
  'invoice',
  'ticket',
  'order',
  'build',
  'version',
  'model',
  'sku',
  'product code'
];

const hasRepeatedCharsOnly = (value: string): boolean =>
  /^(.)\1+$/.test(value);

export const passportRule: PIIRule = {
  id: 'passport.th_us',
  category: 'passport',
  severity: 'high',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(THAI_PASSPORT_REGEX, input)) {
      const value = candidate[0];
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;
      const scoreSignals: ScoreSignal[] = [];
      const hasContext = hasKeywordNearby(
        input,
        startIndex,
        endIndex,
        PASSPORT_KEYWORDS,
        48
      );

      if (
        hasNegativeKeywordNearby(
          input,
          startIndex,
          endIndex,
          PASSPORT_NEGATIVE_KEYWORDS,
          36
        )
      ) {
        continue;
      }

      if (hasContext) {
        pushSignal(scoreSignals, 'passport_keyword_context', 'context', 0.08);
      } else {
        pushSignal(scoreSignals, 'standalone_passport_penalty', 'heuristic', -0.06);
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: hasContext ? 'passport.thai_context' : 'passport.thai_shape',
          category: 'passport',
          severity: 'high',
          baseConfidence: hasContext ? 0.88 : 0.8,
          contextBonus: hasContext ? 0.05 : 0,
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'th'
        })
      );
    }

    for (const candidate of runGlobalRegex(US_PASSPORT_REGEX, input)) {
      const value = candidate[0];
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;
      const scoreSignals: ScoreSignal[] = [];
      const hasContext = hasKeywordNearby(
        input,
        startIndex,
        endIndex,
        PASSPORT_KEYWORDS,
        32
      );

      if (hasNegativeKeywordNearby(input, startIndex, endIndex, PASSPORT_NEGATIVE_KEYWORDS, 32)) {
        continue;
      }

      const hasLetterAndDigit = /[A-Z]/.test(value) && /\d/.test(value);
      if (!hasContext && !hasLetterAndDigit) {
        continue;
      }

      if (hasRepeatedCharsOnly(value)) {
        continue;
      }

      if (hasContext) {
        pushSignal(scoreSignals, 'passport_keyword_context', 'context', 0.07);
      } else {
        pushSignal(scoreSignals, 'standalone_us_passport_penalty', 'heuristic', -0.09);
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: hasContext ? 'passport.us_context' : 'passport.us_shape',
          category: 'passport',
          severity: 'high',
          baseConfidence: hasContext ? 0.84 : 0.78,
          contextBonus: hasContext ? 0.05 : 0,
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'us'
        })
      );
    }

    return matches;
  }
};
