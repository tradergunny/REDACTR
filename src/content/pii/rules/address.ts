import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { makeRuleMatch, pushSignal, runGlobalRegex } from './shared';

const US_ADDRESS_REGEX =
  /\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b(?:,\s*[A-Za-z .'-]+){0,2}/gi;

const THAI_ADDRESS_REGEX =
  /\b(?:ที่อยู่|addr(?:ess)?|shipping address|billing address)\b\s*[:-]?\s*([^\n]{8,140})/gi;

const THAI_ADDRESS_TOKEN_REGEX = /(ถนน|ซอย|แขวง|เขต|จังหวัด|อำเภอ|ตำบล|หมู่|กรุงเทพมหานคร)/i;
const THAI_ADDRESS_TOKEN_GLOBAL_REGEX =
  /(ถนน|ซอย|แขวง|เขต|จังหวัด|อำเภอ|ตำบล|หมู่|กรุงเทพมหานคร)/gi;
const THAI_ADMIN_TOKEN_REGEX = /(แขวง|เขต|จังหวัด|อำเภอ|ตำบล|กรุงเทพมหานคร)/i;
const THAI_CHAR_REGEX = /[\u0E00-\u0E7F]/;
const THAI_HOUSE_NUMBER_REGEX = /^\s*\d{1,4}(?:\/\d{1,4})?/;
const THAI_POSTAL_REGEX = /\b\d{5}\b/;
const US_POSTAL_REGEX = /\b\d{5}(?:-\d{4})?\b/;
const THAI_FREEFORM_LOOKBACK = 140;
const THAI_FREEFORM_LOOKAHEAD = 180;

interface ThaiFreeformCandidate {
  value: string;
  startIndex: number;
}

const countThaiAddressTokens = (value: string): number => {
  const expression = new RegExp(
    THAI_ADDRESS_TOKEN_GLOBAL_REGEX.source,
    THAI_ADDRESS_TOKEN_GLOBAL_REGEX.flags
  );
  let count = 0;
  let token = expression.exec(value);
  while (token) {
    count += 1;
    token = expression.exec(value);
  }
  return count;
};

const extractThaiFreeformCandidates = (input: string): ThaiFreeformCandidate[] => {
  const candidates: ThaiFreeformCandidate[] = [];
  const seenRanges = new Set<string>();
  const expression = new RegExp(
    THAI_ADDRESS_TOKEN_GLOBAL_REGEX.source,
    THAI_ADDRESS_TOKEN_GLOBAL_REGEX.flags
  );

  let token = expression.exec(input);
  while (token) {
    const tokenStart = token.index ?? 0;
    let segmentStart = tokenStart;
    let segmentEnd = tokenStart + token[0].length;

    while (
      segmentStart > 0 &&
      !/[\n.!?]/.test(input[segmentStart - 1]) &&
      tokenStart - segmentStart < THAI_FREEFORM_LOOKBACK
    ) {
      segmentStart -= 1;
    }

    while (
      segmentEnd < input.length &&
      !/[\n.!?]/.test(input[segmentEnd]) &&
      segmentEnd - tokenStart < THAI_FREEFORM_LOOKAHEAD
    ) {
      segmentEnd += 1;
    }

    const rawSegment = input.slice(segmentStart, segmentEnd);
    const houseNumberOffset = rawSegment.search(/\d{1,4}(?:\/\d{1,4})?(?=\s*[\u0E00-\u0E7F])/);
    if (houseNumberOffset > 0) {
      segmentStart += houseNumberOffset;
    }

    const segment = input.slice(segmentStart, segmentEnd).trim();
    if (!segment) {
      token = expression.exec(input);
      continue;
    }

    const trimOffset = input.slice(segmentStart, segmentEnd).indexOf(segment);
    const normalizedStart = segmentStart + Math.max(0, trimOffset);
    const rangeKey = `${normalizedStart}:${normalizedStart + segment.length}`;

    if (seenRanges.has(rangeKey)) {
      token = expression.exec(input);
      continue;
    }

    seenRanges.add(rangeKey);
    candidates.push({
      value: segment,
      startIndex: normalizedStart
    });

    token = expression.exec(input);
  }

  return candidates;
};

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

    for (const candidate of extractThaiFreeformCandidates(input)) {
      const value = candidate.value;
      const tokenCount = countThaiAddressTokens(value);
      const hasThaiCharacters = THAI_CHAR_REGEX.test(value);
      const hasThaiAdminToken = THAI_ADMIN_TOKEN_REGEX.test(value);
      const hasHouseNumber = THAI_HOUSE_NUMBER_REGEX.test(value);
      const hasPostalCode = THAI_POSTAL_REGEX.test(value);

      if (!hasThaiCharacters) {
        continue;
      }

      if (tokenCount < 2 || !hasThaiAdminToken) {
        continue;
      }

      if (!hasHouseNumber && !hasPostalCode) {
        continue;
      }

      const scoreSignals: ScoreSignal[] = [];
      pushSignal(scoreSignals, 'thai_freeform_chars_present', 'validator', 0.02);
      pushSignal(scoreSignals, 'thai_freeform_tokens_present', 'validator', 0.03);
      pushSignal(scoreSignals, 'thai_freeform_admin_token', 'validator', 0.03);
      if (hasHouseNumber) {
        pushSignal(scoreSignals, 'thai_freeform_house_number', 'validator', 0.02);
      }
      if (hasPostalCode) {
        pushSignal(scoreSignals, 'thai_freeform_postal_code', 'validator', 0.03);
      }

      matches.push(
        makeRuleMatch(value, candidate.startIndex, {
          rule: 'address.thai_freeform',
          category: 'address',
          severity: 'low',
          baseConfidence: 0.65,
          contextBonus: 0.03,
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'th'
        })
      );
    }

    return matches;
  }
};
