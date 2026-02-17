import { describe, expect, it } from 'vitest';

import { resolvePolicyDecision } from '../../src/content/pii/policy';

const category = 'passport' as const;

describe('pii policy decisions', () => {
  it('applies standard thresholds for high/critical severities', () => {
    expect(resolvePolicyDecision(category, 'critical', 0.9, {}).decision).toBe('block');
    expect(resolvePolicyDecision(category, 'critical', 0.8, {}).decision).toBe('warn');
    expect(resolvePolicyDecision(category, 'critical', 0.6, {}).decision).toBe('ignore');

    expect(resolvePolicyDecision(category, 'high', 0.91, {}).decision).toBe('block');
    expect(resolvePolicyDecision(category, 'high', 0.85, {}).decision).toBe('warn');
  });

  it('keeps medium/low as warn-only by default', () => {
    expect(resolvePolicyDecision('email', 'medium', 0.95, {}).decision).toBe('warn');
    expect(resolvePolicyDecision('email', 'medium', 0.69, {}).decision).toBe('ignore');
    expect(resolvePolicyDecision('address', 'low', 0.91, {}).decision).toBe('warn');
  });

  it('changes sensitivity across relaxed and strict modes', () => {
    expect(resolvePolicyDecision('email', 'medium', 0.66, { mode: 'relaxed' }).decision).toBe('warn');
    expect(resolvePolicyDecision('email', 'medium', 0.66, { mode: 'strict' }).decision).toBe('ignore');
  });

  it('supports category-level threshold overrides', () => {
    const settings = {
      categoryThresholds: {
        passport: {
          warn: 0.6,
          block: 0.8
        }
      }
    } as const;

    expect(resolvePolicyDecision('passport', 'high', 0.79, settings).decision).toBe('warn');
    expect(resolvePolicyDecision('passport', 'high', 0.81, settings).decision).toBe('block');
  });

  it('uses legacy visible decisions and exposes shadow decision in shadow mode', () => {
    const decision = resolvePolicyDecision('passport', 'high', 0.64, {
      executionMode: 'shadow'
    });

    expect(decision.decision).toBe('block');
    expect(decision.shadowDecision).toBe('ignore');
  });
});
