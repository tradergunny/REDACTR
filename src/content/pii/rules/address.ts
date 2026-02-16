import type { PIIRule, RuleMatch } from '../types';
import { makeRuleMatch, runGlobalRegex } from './shared';

const US_ADDRESS_REGEX =
  /\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b(?:,\s*[A-Za-z .'-]+){0,2}/gi;

const THAI_ADDRESS_REGEX =
  /\b(?:ที่อยู่|addr(?:ess)?|shipping address|billing address)\b\s*[:-]?\s*([^\n]{8,140})/gi;

const THAI_ADDRESS_TOKEN_REGEX = /(ถนน|ซอย|แขวง|เขต|จังหวัด|อำเภอ|ตำบล|หมู่)/i;

export const addressRule: PIIRule = {
  id: 'address.conservative',
  category: 'address',
  severity: 'low',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(US_ADDRESS_REGEX, input)) {
      matches.push(
        makeRuleMatch(candidate[0], candidate.index ?? 0, {
          rule: 'address.us_suffix',
          category: 'address',
          severity: 'low',
          baseConfidence: 0.72,
          contextBonus: 0.03
        })
      );
    }

    for (const candidate of runGlobalRegex(THAI_ADDRESS_REGEX, input)) {
      const value = candidate[1];
      if (!value) {
        continue;
      }

      if (!/\d/.test(value)) {
        continue;
      }

      if (!THAI_ADDRESS_TOKEN_REGEX.test(value) && !/(street|road|ave|rd|st)/i.test(value)) {
        continue;
      }

      const fullMatch = candidate[0];
      const fullStart = candidate.index ?? 0;
      const valueStart = fullStart + fullMatch.indexOf(value);

      matches.push(
        makeRuleMatch(value.trim(), valueStart, {
          rule: 'address.context',
          category: 'address',
          severity: 'low',
          baseConfidence: 0.69,
          contextBonus: 0.05
        })
      );
    }

    return matches;
  }
};
