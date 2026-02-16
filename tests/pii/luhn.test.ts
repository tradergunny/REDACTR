import { describe, expect, it } from 'vitest';

import { luhnCheck } from '../../src/content/pii';

describe('luhnCheck', () => {
  it('accepts known valid card numbers', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
    expect(luhnCheck('5555555555554444')).toBe(true);
    expect(luhnCheck('378282246310005')).toBe(true);
  });

  it('rejects invalid numbers and malformed input', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
    expect(luhnCheck('1234')).toBe(false);
    expect(luhnCheck('abcd')).toBe(false);
  });
});
