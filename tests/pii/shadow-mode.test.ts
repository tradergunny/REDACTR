import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';

describe('shadow and enforced execution modes', () => {
  it('returns warn decision for standalone passport in enforced mode', () => {
    const detection = detectPII('AB1234567').find((item) => item.category === 'passport');

    expect(detection).toBeDefined();
    expect(detection?.decision).toBe('warn');
    expect(detection?.shadowDecision).toBeUndefined();
  });

  it('keeps legacy visible decision and exposes shadow decision in shadow mode', () => {
    const detection = detectPII('AB1234567', { executionMode: 'shadow' }).find(
      (item) => item.category === 'passport'
    );

    expect(detection).toBeDefined();
    expect(detection?.decision).toBe('block');
    expect(detection?.shadowDecision).toBe('warn');
  });

  it('keeps low-confidence shape matches out of enforced mode but visible in shadow mode', () => {
    const enforced = detectPII('Token A1B2C3D4E should be reviewed');
    const shadow = detectPII('Token A1B2C3D4E should be reviewed', { executionMode: 'shadow' });

    expect(enforced.some((item) => item.category === 'passport')).toBe(false);
    expect(shadow.some((item) => item.category === 'passport')).toBe(true);
  });
});
