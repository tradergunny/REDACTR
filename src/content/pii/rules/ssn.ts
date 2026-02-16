import type { PIIRule, RuleMatch } from '../types';
import { makeRuleMatch, runGlobalRegex } from './shared';

const SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g;

export const ssnRule: PIIRule = {
  id: 'ssn.us',
  category: 'ssn',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    return runGlobalRegex(SSN_REGEX, input).map((match) =>
      makeRuleMatch(match[0], match.index ?? 0, {
        rule: 'ssn.us',
        category: 'ssn',
        severity: 'critical',
        baseConfidence: 0.96
      })
    );
  }
};
