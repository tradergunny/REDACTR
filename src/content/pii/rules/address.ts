import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { makeRuleMatch, pushSignal, runGlobalRegex } from './shared';

const US_ADDRESS_REGEX =
  /\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b(?:,\s*[A-Za-z .'-]+){0,2}/gi;

const THAI_ADDRESS_REGEX =
  /\b(?:ที่อยู่|addr(?:ess)?|shipping address|billing address)\b\s*[:-]?\s*([^\n]{8,140})/gi;

const THAI_ADDRESS_TOKEN_REGEX = /(ถนน|ซอย|แขวง|เขต|จังหวัด|อำเภอ|ตำบล|หมู่)/i;
const US_POSTAL_REGEX = /\b\d{5}(?:-\d{4})?\b/;

export const addressRule: PIIRule = {
  id: 'address.conservative',
  category: 'address',
  severity: 'low',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(US_ADDRESS_REGEX, input)) {
      const value = candidate[0];
      let tokenScore = 0;
      const scoreSignals: ScoreSignal[] = [];

      if (/\b\d{1,6}\b/.test(value)) {
        tokenScore += 1;
        pushSignal(scoreSignals, 'address_has_street_number', 'validator', 0.03);
      }

      if (/\b(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b/i.test(value)) {
        tokenScore += 1;
        pushSignal(scoreSignals, 'address_has_street_suffix', 'validator', 0.03);
      }

      if (/,/.test(value)) {
        tokenScore += 1;
        pushSignal(scoreSignals, 'address_has_locality_delimiter', 'heuristic', 0.02);
      }

      if (US_POSTAL_REGEX.test(value)) {
        pushSignal(scoreSignals, 'address_has_postal_code', 'validator', 0.03);
      }

      if (tokenScore < 2) {
        continue;
      }

      matches.push(
        makeRuleMatch(value, candidate.index ?? 0, {
          rule: 'address.us_suffix',
          category: 'address',
          severity: 'low',
          baseConfidence: 0.69,
          contextBonus: 0.04,
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'us'
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
      const scoreSignals: ScoreSignal[] = [];
      pushSignal(scoreSignals, 'address_context_keyword', 'context', 0.05);
      if (THAI_ADDRESS_TOKEN_REGEX.test(value)) {
        pushSignal(scoreSignals, 'thai_address_tokens', 'validator', 0.04);
      }

      matches.push(
        makeRuleMatch(value.trim(), valueStart, {
          rule: 'address.context',
          category: 'address',
          severity: 'low',
          baseConfidence: 0.66,
          contextBonus: 0.05,
          validationStage: 'validated',
          scoreSignals,
          countryHint: THAI_ADDRESS_TOKEN_REGEX.test(value) ? 'th' : 'us'
        })
      );
    }

    return matches;
  }
};
