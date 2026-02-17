import { describe, expect, it } from 'vitest';

import {
  isAbaRoutingNumberValid,
  isIbanChecksumValid,
  normalizeIban
} from '../../src/content/pii/validators/bank';

describe('bank validators', () => {
  it('normalizes IBAN values', () => {
    expect(normalizeIban(' gb82 west 1234 5698 7654 32 ')).toBe('GB82WEST12345698765432');
  });

  it('validates known-good ABA routing numbers', () => {
    expect(isAbaRoutingNumberValid('011000015')).toBe(true);
    expect(isAbaRoutingNumberValid('021000021')).toBe(true);
  });

  it('rejects bad ABA routing numbers', () => {
    expect(isAbaRoutingNumberValid('011000016')).toBe(false);
    expect(isAbaRoutingNumberValid('123456789')).toBe(false);
  });

  it('validates known-good IBANs', () => {
    expect(isIbanChecksumValid('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(isIbanChecksumValid('DE89 3704 0044 0532 0130 00')).toBe(true);
  });

  it('rejects invalid IBANs', () => {
    expect(isIbanChecksumValid('GB82 WEST 1234 5698 7654 31')).toBe(false);
    expect(isIbanChecksumValid('DE89 3704 0044 0532 0130 99')).toBe(false);
  });
});
