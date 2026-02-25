import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';

const detectionsByCategory = (input: string, category: string): string[] =>
  detectPII(input)
    .filter((detection) => detection.category === category)
    .map((detection) => detection.text);

describe('card metadata detection', () => {
  it('detects expiry and cvv on the same line with expiry before cvv', () => {
    const input =
      'Card 4111 1111 1111 1111, exp 08/27, CVV 123 for recurring billing.';

    expect(detectionsByCategory(input, 'card_expiry')).toContain('08/27');
    expect(detectionsByCategory(input, 'card_cvv')).toContain('123');
  });

  it('detects cvv and expiry when order is reversed across lines with noise', () => {
    const input = [
      'Payment profile:',
      'CVV code: 123',
      'Please keep this for automatic invoices.',
      'expiration date is 08/2027',
      'card on file 4111 1111 1111 1111'
    ].join('\n');

    expect(detectionsByCategory(input, 'card_cvv')).toContain('123');
    expect(detectionsByCategory(input, 'card_expiry')).toContain('08/2027');
  });

  it('detects 4-digit cvv with amex context', () => {
    const input = 'Amex 378282246310005 valid thru 09/2028 security code 1234';

    expect(detectionsByCategory(input, 'card_expiry')).toContain('09/2028');
    expect(detectionsByCategory(input, 'card_cvv')).toContain('1234');
  });

  it('detects keyword-linked cvv and expiry even without explicit card number anchor', () => {
    const input = 'Please store CVV code 123 and expiration date 08/27 for later.';

    expect(detectionsByCategory(input, 'card_cvv')).toContain('123');
    expect(detectionsByCategory(input, 'card_expiry')).toContain('08/27');
  });

  it('does not detect random 3-digit values without card context', () => {
    const input = 'Room 123 has 456 seats and floor 789 is closed.';

    expect(detectionsByCategory(input, 'card_cvv')).toEqual([]);
  });

  it('does not detect random month/year dates without card context', () => {
    const input = 'Project milestone planned for 08/27 and retrospective in 09/27.';

    expect(detectionsByCategory(input, 'card_expiry')).toEqual([]);
  });

  it('suppresses otp/pin contexts for cvv-like values', () => {
    const input = 'Use OTP 123 and PIN 4567 to access the room.';

    expect(detectionsByCategory(input, 'card_cvv')).toEqual([]);
  });

  it('prefers context-correct expiry when multiple dates exist nearby', () => {
    const input =
      'Card 4111 1111 1111 1111 invoice date 05/2024 exp 08/27 CVV 123. Unrelated forecast 11/2035.';
    const expiryDetections = detectionsByCategory(input, 'card_expiry');

    expect(expiryDetections).toContain('08/27');
    expect(expiryDetections).not.toContain('11/2035');
  });
});
