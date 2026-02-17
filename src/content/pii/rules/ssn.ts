import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import {
  hasKeywordNearby,
  makeRuleMatch,
  pushSignal,
  runGlobalRegex
} from './shared';

const SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g;
const SSN_COMPACT_REGEX = /\b(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}\b/g;
const SSN_KEYWORDS = ['ssn', 'social security', 'social'];

export const ssnRule: PIIRule = {
  id: 'ssn.us',
  category: 'ssn',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const match of runGlobalRegex(SSN_REGEX, input)) {
      const startIndex = match.index ?? 0;
      const endIndex = startIndex + match[0].length;
      const scoreSignals: ScoreSignal[] = [];

      if (hasKeywordNearby(input, startIndex, endIndex, SSN_KEYWORDS, 48)) {
        pushSignal(scoreSignals, 'ssn_keyword_context', 'context', 0.04);
      }

      matches.push(
        makeRuleMatch(match[0], startIndex, {
          rule: 'ssn.us',
          category: 'ssn',
          severity: 'critical',
          baseConfidence: 0.94,
          validationStage: 'validated',
          scoreSignals
        })
      );
    }

    for (const match of runGlobalRegex(SSN_COMPACT_REGEX, input)) {
      const startIndex = match.index ?? 0;
      const endIndex = startIndex + match[0].length;
      if (!hasKeywordNearby(input, startIndex, endIndex, SSN_KEYWORDS, 56)) {
        continue;
      }

      const scoreSignals: ScoreSignal[] = [];
      pushSignal(scoreSignals, 'compact_ssn_penalty', 'heuristic', -0.09);
      pushSignal(scoreSignals, 'ssn_keyword_context', 'context', 0.06);

      matches.push(
        makeRuleMatch(match[0], startIndex, {
          rule: 'ssn.us_compact',
          category: 'ssn',
          severity: 'critical',
          baseConfidence: 0.82,
          validationStage: 'validated',
          scoreSignals
        })
      );
    }

    return matches;
  }
};
