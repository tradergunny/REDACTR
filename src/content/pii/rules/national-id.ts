import type { PIIRule, RuleMatch } from '../types';
import { isThaiIdentifierChecksumValid } from '../validators/thai';
import {
  hasKeywordNearby,
  makeRuleMatch,
  runGlobalRegex
} from './shared';

const THAI_THIRTEEN_DIGIT_REGEX = /\b\d{13}\b/g;
const US_ITIN_REGEX = /\b9\d{2}[- ]?\d{2}[- ]?\d{4}\b/g;

const THAI_ID_KEYWORDS = [
  'national id',
  'citizen id',
  'thai id',
  'บัตรประชาชน',
  'เลขบัตร',
  'เลขประจำตัวประชาชน',
  'tax id',
  'taxpayer id',
  'เลขผู้เสียภาษี',
  'company registration',
  'ทะเบียนนิติบุคคล'
];

const US_ITIN_KEYWORDS = ['itin', 'taxpayer identification', 'individual taxpayer'];

export const nationalIdRule: PIIRule = {
  id: 'national_id.th_us',
  category: 'national_id',
  severity: 'high',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(THAI_THIRTEEN_DIGIT_REGEX, input)) {
      const value = candidate[0];
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;

      if (!hasKeywordNearby(input, startIndex, endIndex, THAI_ID_KEYWORDS, 64)) {
        continue;
      }

      if (isThaiIdentifierChecksumValid(value)) {
        matches.push(
          makeRuleMatch(value, startIndex, {
            rule: 'national_id.thai_checksum',
            category: 'national_id',
            severity: 'high',
            baseConfidence: 0.95,
            contextBonus: 0.03
          })
        );
        continue;
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'national_id.thai_context',
          category: 'national_id',
          severity: 'high',
          baseConfidence: 0.75,
          contextBonus: 0.04
        })
      );
    }

    for (const candidate of runGlobalRegex(US_ITIN_REGEX, input)) {
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + candidate[0].length;

      if (!hasKeywordNearby(input, startIndex, endIndex, US_ITIN_KEYWORDS, 48)) {
        continue;
      }

      matches.push(
        makeRuleMatch(candidate[0], startIndex, {
          rule: 'national_id.us_itin',
          category: 'national_id',
          severity: 'high',
          baseConfidence: 0.87,
          contextBonus: 0.04
        })
      );
    }

    return matches;
  }
};
