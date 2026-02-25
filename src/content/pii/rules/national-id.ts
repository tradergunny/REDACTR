import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { detectThaiIdOrCardCandidates } from '../validators/id-card-detector';
import {
  hasKeywordNearby,
  makeRuleMatch,
  pushSignal,
  runGlobalRegex
} from './shared';

const US_ITIN_REGEX = /\b9\d{2}[- ]?\d{2}[- ]?\d{4}\b/g;

const US_ITIN_KEYWORDS = ['itin', 'taxpayer identification', 'individual taxpayer'];

export const nationalIdRule: PIIRule = {
  id: 'national_id.th_us',
  category: 'national_id',
  severity: 'high',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of detectThaiIdOrCardCandidates(input)) {
      if (candidate.type !== 'THAI_NATIONAL_ID') {
        continue;
      }

      const scoreSignals: ScoreSignal[] = [];
      let baseConfidence = 0.9;
      let contextBonus = 0;
      let rule = 'national_id.thai_checksum';

      if (candidate.checksumPassed === 'THAI_ID') {
        pushSignal(scoreSignals, 'thai_checksum_valid', 'validator', 0.08);
      } else if (candidate.thaiIdByFormatContext) {
        baseConfidence = 0.74;
        contextBonus = 0.03;
        rule = 'national_id.thai_format_context';
        pushSignal(scoreSignals, 'thai_format_context_fallback', 'pattern', 0.02);
      } else {
        continue;
      }

      if (candidate.contextSignals.thaiKeywordNearby) {
        pushSignal(scoreSignals, 'thai_context_present', 'context', 0.02);
      }

      if (candidate.contextSignals.cardKeywordNearby) {
        pushSignal(scoreSignals, 'card_context_nearby', 'context', -0.01);
      }

      if (candidate.contextSignals.negativeKeywordNearby) {
        pushSignal(scoreSignals, 'ambiguous_numeric_context', 'suppressor', -0.01);
      }

      matches.push(
        makeRuleMatch(candidate.raw, candidate.startIndex, {
          rule,
          category: 'national_id',
          severity: 'high',
          baseConfidence,
          contextBonus,
          normalizedText: candidate.normalizedNumber,
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'th'
        })
      );
    }

    for (const candidate of runGlobalRegex(US_ITIN_REGEX, input)) {
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + candidate[0].length;
      const scoreSignals: ScoreSignal[] = [];

      if (!hasKeywordNearby(input, startIndex, endIndex, US_ITIN_KEYWORDS, 48)) {
        continue;
      }

      pushSignal(scoreSignals, 'itin_context_present', 'context', 0.05);

      matches.push(
        makeRuleMatch(candidate[0], startIndex, {
          rule: 'national_id.us_itin',
          category: 'national_id',
          severity: 'high',
          baseConfidence: 0.83,
          contextBonus: 0.05,
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'us'
        })
      );
    }

    return matches;
  }
};
