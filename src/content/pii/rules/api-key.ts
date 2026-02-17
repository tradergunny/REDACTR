import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { makeRuleMatch, pushSignal, runGlobalRegex, safeEntropy } from './shared';

const KEY_PATTERNS: Array<{ regex: RegExp; id: string; confidence: number }> = [
  { regex: /\bAKIA[0-9A-Z]{16}\b/g, id: 'api_key.aws_akia', confidence: 0.99 },
  { regex: /\bsk_live_[0-9A-Za-z]{16,}\b/g, id: 'api_key.stripe_live', confidence: 0.99 },
  { regex: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g, id: 'api_key.gitlab_pat', confidence: 0.98 },
  {
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
    id: 'api_key.slack',
    confidence: 0.98
  },
  { regex: /\bAZURE_[A-Za-z0-9]{32,}\b/g, id: 'api_key.azure', confidence: 0.96 },
  { regex: /\bsk-[A-Za-z0-9]{20,}\b/g, id: 'api_key.openai', confidence: 0.98 },
  { regex: /\bghp_[A-Za-z0-9]{36}\b/g, id: 'api_key.github_pat', confidence: 0.98 },
  { regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g, id: 'api_key.google', confidence: 0.97 }
];

const KNOWN_FAKE_TOKENS = ['example', 'sample', 'fake', 'test', 'shorttoken', 'dummy'];

export const apiKeyRule: PIIRule = {
  id: 'api_key.composite',
  category: 'api_key',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const pattern of KEY_PATTERNS) {
      const found = runGlobalRegex(pattern.regex, input);
      for (const match of found) {
        const value = match[0];
        const entropy = safeEntropy(value.replace(/[^A-Za-z0-9]/g, ''));
        if (entropy < 2.8) {
          continue;
        }

        const lower = value.toLowerCase();
        if (KNOWN_FAKE_TOKENS.some((token) => lower.includes(token))) {
          continue;
        }

        const scoreSignals: ScoreSignal[] = [];
        pushSignal(scoreSignals, 'entropy_signal', 'validator', entropy >= 3.4 ? 0.03 : 0.01);

        matches.push(
          makeRuleMatch(value, match.index ?? 0, {
            rule: pattern.id,
            category: 'api_key',
            severity: 'critical',
            baseConfidence: pattern.confidence,
            validationStage: 'validated',
            scoreSignals
          })
        );
      }
    }

    return matches;
  }
};
