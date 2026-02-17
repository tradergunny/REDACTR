import { describe, expect, it } from 'vitest';

import {
  detectThaiIdOrCardCandidates,
  type NumericCandidateDetection
} from '../../src/content/pii';

const findByNormalized = (
  detections: NumericCandidateDetection[],
  digits: string
): NumericCandidateDetection | undefined =>
  detections.find((detection) => detection.normalizedNumber === digits);

const findByRaw = (
  detections: NumericCandidateDetection[],
  raw: string
): NumericCandidateDetection | undefined =>
  detections.find((detection) => detection.raw === raw);

describe('detectThaiIdOrCardCandidates', () => {
  it('classifies valid Thai IDs in unformatted and formatted forms', () => {
    const detections = detectThaiIdOrCardCandidates(
      'plain 1101700203450 and formatted 1-1017-00203-45-0'
    );

    const unformatted = findByRaw(detections, '1101700203450');
    const formatted = findByRaw(detections, '1-1017-00203-45-0');

    expect(unformatted?.type).toBe('THAI_NATIONAL_ID');
    expect(unformatted?.checksumPassed).toBe('THAI_ID');
    expect(formatted?.type).toBe('THAI_NATIONAL_ID');
    expect(formatted?.normalizedNumber).toBe('1101700203450');
  });

  it('returns NONE for checksum-invalid Thai-like numbers', () => {
    const detections = detectThaiIdOrCardCandidates('invalid 1101700203451');
    const candidate = findByNormalized(detections, '1101700203451');

    expect(candidate?.type).toBe('NONE');
    expect(candidate?.checksumPassed).toBe(null);
  });

  it('classifies supported card networks with spaces and hyphens', () => {
    const detections = detectThaiIdOrCardCandidates(
      [
        'Visa 4111 1111 1111 1111',
        'Mastercard 5555-5555-5555-4444',
        'Amex 378282246310005',
        'Discover 6011 1111 1111 1117'
      ].join(' | ')
    );

    expect(findByNormalized(detections, '4111111111111111')?.matchedPrefixNetwork).toBe(
      'VISA'
    );
    expect(findByNormalized(detections, '5555555555554444')?.matchedPrefixNetwork).toBe(
      'MASTERCARD'
    );
    expect(findByNormalized(detections, '378282246310005')?.matchedPrefixNetwork).toBe(
      'AMEX'
    );
    expect(findByNormalized(detections, '6011111111111117')?.matchedPrefixNetwork).toBe(
      'DISCOVER'
    );

    expect(findByNormalized(detections, '4111111111111111')?.type).toBe('CREDIT_CARD');
    expect(findByNormalized(detections, '5555555555554444')?.type).toBe('CREDIT_CARD');
    expect(findByNormalized(detections, '378282246310005')?.type).toBe('CREDIT_CARD');
    expect(findByNormalized(detections, '6011111111111117')?.type).toBe('CREDIT_CARD');
  });

  it('returns NONE when Luhn is valid but IIN network is unsupported', () => {
    const detections = detectThaiIdOrCardCandidates('JCB 3530111333300000');
    const candidate = findByNormalized(detections, '3530111333300000');

    expect(candidate?.type).toBe('NONE');
    expect(candidate?.matchedPrefixNetwork).toBe(null);
  });

  it('excludes candidates whose normalized length is outside 13..19', () => {
    const detections = detectThaiIdOrCardCandidates(
      'too short 1234-5678-9012 and too long 1234 5678 9012 3456 7890'
    );

    expect(detections).toEqual([]);
  });

  it('prioritizes Thai ID when a 13-digit candidate is also Visa+Luhn valid', () => {
    const detections = detectThaiIdOrCardCandidates('candidate 4000000000071');
    const candidate = findByNormalized(detections, '4000000000071');

    expect(candidate?.type).toBe('THAI_NATIONAL_ID');
    expect(candidate?.checksumPassed).toBe('THAI_ID');
    expect(candidate?.matchedPrefixNetwork).toBe('VISA');
  });

  it('does not require context keywords to classify valid Thai IDs', () => {
    const detections = detectThaiIdOrCardCandidates('value=1101700203450');
    const candidate = findByNormalized(detections, '1101700203450');

    expect(candidate?.type).toBe('THAI_NATIONAL_ID');
    expect(candidate?.contextSignals.thaiKeywordNearby).toBe(false);
  });
});
