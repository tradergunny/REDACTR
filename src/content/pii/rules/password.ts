import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { makeRuleMatch, pushSignal, runGlobalRegex } from './shared';

const PASSWORD_ASSIGNMENT_REGEX =
  /(?:^|\s|\(|\[|\{|-|`|,)(?:password|passwd|pwd|passphrase|รหัสผ่าน)\s*(?:[:=]|is)\s*["']?([^\s"'`]{4,128})["']?/gim;
const ENV_ASSIGNMENT_REGEX =
  /\b(?:PASSWORD|PASSWD|PWD|PASSPHRASE)\s*=\s*["']?([^\s"'`]{4,128})["']?/gm;
const CLI_FLAG_REGEX = /--(?:password|passphrase|pwd)\s+([^\s"'`]{4,128})/gi;

const PLACEHOLDER_PASSWORDS = [
  '<password>',
  'your_password',
  'example_password',
  'changeme',
  'password123',
  'secret123'
];

export const passwordRule: PIIRule = {
  id: 'password.context',
  category: 'password',
  severity: 'high',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    const patterns = [
      { regex: PASSWORD_ASSIGNMENT_REGEX, rule: 'password.context', confidence: 0.88 },
      { regex: ENV_ASSIGNMENT_REGEX, rule: 'password.env', confidence: 0.9 },
      { regex: CLI_FLAG_REGEX, rule: 'password.cli_flag', confidence: 0.86 }
    ];

    for (const pattern of patterns) {
      for (const candidate of runGlobalRegex(pattern.regex, input)) {
        const fullMatch = candidate[0];
        const value = candidate[1];
        const fullStart = candidate.index ?? 0;
        const valueStart = fullStart + fullMatch.indexOf(value);
        const lowerValue = value?.toLowerCase() ?? '';

        if (!value || value.length < 4) {
          continue;
        }

        if (PLACEHOLDER_PASSWORDS.includes(lowerValue)) {
          continue;
        }

        const scoreSignals: ScoreSignal[] = [];
        pushSignal(scoreSignals, 'explicit_assignment_context', 'context', 0.05);
        if (/[^a-z]/i.test(value) && /\d/.test(value)) {
          pushSignal(scoreSignals, 'password_complexity_shape', 'heuristic', 0.02);
        }

        matches.push(
          makeRuleMatch(value, valueStart, {
            rule: pattern.rule,
            category: 'password',
            severity: 'high',
            baseConfidence: pattern.confidence,
            contextBonus: 0.04,
            validationStage: 'validated',
            scoreSignals
          })
        );
      }
    }

    return matches;
  }
};
