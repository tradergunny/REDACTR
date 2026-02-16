import type { PIIRule, RuleMatch } from '../types';
import { makeRuleMatch, runGlobalRegex } from './shared';

const KEY_PATTERNS: Array<{ regex: RegExp; id: string; confidence: number }> = [
  { regex: /\bAKIA[0-9A-Z]{16}\b/g, id: 'api_key.aws_akia', confidence: 0.99 },
  { regex: /\bsk_live_[0-9A-Za-z]{16,}\b/g, id: 'api_key.stripe_live', confidence: 0.99 },
  { regex: /\bsk-[A-Za-z0-9]{20,}\b/g, id: 'api_key.openai', confidence: 0.98 },
  { regex: /\bghp_[A-Za-z0-9]{36}\b/g, id: 'api_key.github_pat', confidence: 0.98 },
  { regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g, id: 'api_key.google', confidence: 0.97 }
];

export const apiKeyRule: PIIRule = {
  id: 'api_key.composite',
  category: 'api_key',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const pattern of KEY_PATTERNS) {
      const found = runGlobalRegex(pattern.regex, input);
      for (const match of found) {
        matches.push(
          makeRuleMatch(match[0], match.index ?? 0, {
            rule: pattern.id,
            category: 'api_key',
            severity: 'critical',
            baseConfidence: pattern.confidence
          })
        );
      }
    }

    return matches;
  }
};
