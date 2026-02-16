import { describe, expect, it } from 'vitest';

import { generateMask } from '../../src/content/pii';

describe('generateMask', () => {
  it('masks email local part', () => {
    expect(generateMask('jane.doe@example.com', 'email')).toBe('j***@example.com');
  });

  it('masks phone except last 4 digits', () => {
    expect(generateMask('+1 (415) 555-2671', 'phone')).toBe('+* (***) ***-2671');
  });

  it('masks ssn preserving last 4', () => {
    expect(generateMask('123-45-6789', 'ssn')).toBe('***-**-6789');
  });

  it('masks credit card preserving last 4', () => {
    expect(generateMask('4111 1111 1111 1111', 'credit_card')).toBe(
      '****-****-****-1111'
    );
  });

  it('masks api key with prefix preservation', () => {
    expect(generateMask('sk-abcdefghijklmnopqrstuvwxyz123456', 'api_key')).toBe(
      'sk-abcde****'
    );
  });

  it('masks passwords with stars', () => {
    expect(generateMask('Hunter2!', 'password')).toBe('********');
  });

  it('masks unknown-like value with default for empty input', () => {
    expect(generateMask('', 'address')).toBe('[REDACTED]');
  });
});
