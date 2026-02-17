import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { makeRuleMatch, pushSignal, runGlobalRegex } from './shared';

const EMAIL_REGEX =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}\b/g;
const PLACEHOLDER_LOCAL_PARTS = new Set(['name', 'email', 'example', 'test']);

export const emailRule: PIIRule = {
  id: 'email.basic',
  category: 'email',
  severity: 'medium',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const match of runGlobalRegex(EMAIL_REGEX, input)) {
      const value = match[0];
      const [localPart = '', domain = ''] = value.split('@');
      if (!localPart || !domain) {
        continue;
      }

      if (localPart.includes('..') || domain.includes('..')) {
        continue;
      }

      if (PLACEHOLDER_LOCAL_PARTS.has(localPart.toLowerCase()) && domain.startsWith('example.')) {
        continue;
      }

      const scoreSignals: ScoreSignal[] = [];
      if (localPart.includes('+')) {
        pushSignal(scoreSignals, 'plus_alias_email', 'heuristic', 0.01);
      }

      matches.push(
        makeRuleMatch(value, match.index ?? 0, {
          rule: 'email.basic',
          category: 'email',
          severity: 'medium',
          baseConfidence: 0.9,
          validationStage: 'validated',
          scoreSignals
        })
      );
    }

    return matches;
  }
};
