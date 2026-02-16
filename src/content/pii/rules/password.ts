import type { PIIRule, RuleMatch } from '../types';
import { makeRuleMatch, runGlobalRegex } from './shared';

const PASSWORD_ASSIGNMENT_REGEX =
  /(?:^|\s|\(|\[|\{|-|`)(?:password|passwd|pwd|passphrase|รหัสผ่าน)\s*(?:[:=]|is)\s*([^\s"'`]{4,128})/gim;

export const passwordRule: PIIRule = {
  id: 'password.context',
  category: 'password',
  severity: 'high',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(PASSWORD_ASSIGNMENT_REGEX, input)) {
      const fullMatch = candidate[0];
      const value = candidate[1];
      const fullStart = candidate.index ?? 0;
      const valueStart = fullStart + fullMatch.indexOf(value);

      if (!value || value.length < 4) {
        continue;
      }

      matches.push(
        makeRuleMatch(value, valueStart, {
          rule: 'password.context',
          category: 'password',
          severity: 'high',
          baseConfidence: 0.9,
          contextBonus: 0.05
        })
      );
    }

    return matches;
  }
};
