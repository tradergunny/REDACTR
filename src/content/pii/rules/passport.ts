import type { PIIRule, RuleMatch } from '../types';
import {
  hasKeywordNearby,
  makeRuleMatch,
  runGlobalRegex
} from './shared';

const THAI_PASSPORT_REGEX = /\b[A-Z]{1,2}\d{6,7}\b/g;
const US_PASSPORT_REGEX = /\b[A-Z0-9]{9}\b/g;
const PASSPORT_KEYWORDS = ['passport', 'หนังสือเดินทาง'];

export const passportRule: PIIRule = {
  id: 'passport.th_us',
  category: 'passport',
  severity: 'high',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(THAI_PASSPORT_REGEX, input)) {
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + candidate[0].length;

      if (!hasKeywordNearby(input, startIndex, endIndex, PASSPORT_KEYWORDS, 48)) {
        continue;
      }

      matches.push(
        makeRuleMatch(candidate[0], startIndex, {
          rule: 'passport.thai',
          category: 'passport',
          severity: 'high',
          baseConfidence: 0.92,
          contextBonus: 0.04
        })
      );
    }

    for (const candidate of runGlobalRegex(US_PASSPORT_REGEX, input)) {
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + candidate[0].length;

      if (!hasKeywordNearby(input, startIndex, endIndex, PASSPORT_KEYWORDS, 32)) {
        continue;
      }

      matches.push(
        makeRuleMatch(candidate[0], startIndex, {
          rule: 'passport.us_context',
          category: 'passport',
          severity: 'high',
          baseConfidence: 0.84,
          contextBonus: 0.05
        })
      );
    }

    return matches;
  }
};
