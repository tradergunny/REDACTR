import type { PIIRule, RuleMatch } from '../types';
import { luhnCheck, normalizeDigits } from '../validators/luhn';
import {
  hasKeywordNearby,
  makeRuleMatch,
  runGlobalRegex
} from './shared';

const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
const NON_CARD_CONTEXT_KEYWORDS = [
  'national id',
  'citizen id',
  'taxpayer id',
  'เลขประจำตัวประชาชน',
  'passport',
  'bank account',
  'routing',
  'account number',
  'acct'
];

export const creditCardRule: PIIRule = {
  id: 'credit_card.luhn',
  category: 'credit_card',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(CREDIT_CARD_REGEX, input)) {
      const value = candidate[0].trim();
      const digits = normalizeDigits(value);

      if (digits.length < 13 || digits.length > 19) {
        continue;
      }

      if (!luhnCheck(digits)) {
        continue;
      }

      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;
      if (
        hasKeywordNearby(
          input,
          startIndex,
          endIndex,
          NON_CARD_CONTEXT_KEYWORDS,
          40
        )
      ) {
        continue;
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'credit_card.luhn',
          category: 'credit_card',
          severity: 'critical',
          baseConfidence: 0.99
        })
      );
    }

    return matches;
  }
};
