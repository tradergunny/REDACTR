import type { PIIRule, RuleMatch } from '../types';
import { makeRuleMatch, runGlobalRegex } from './shared';

const EMAIL_REGEX = /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;

export const emailRule: PIIRule = {
  id: 'email.basic',
  category: 'email',
  severity: 'medium',
  detect(input: string): RuleMatch[] {
    return runGlobalRegex(EMAIL_REGEX, input).map((match) =>
      makeRuleMatch(match[0], match.index ?? 0, {
        rule: 'email.basic',
        category: 'email',
        severity: 'medium',
        baseConfidence: 0.9
      })
    );
  }
};
