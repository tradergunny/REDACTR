import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';

const onboardingPrompt = `This internal report summarizes the onboarding status of a new client, Mr. Somchai Prasert, who recently signed a service agreement with our company. Mr. Somchai is a Thai national, holding a national ID number 1-2345-67890-12-3, and currently resides at 88/123 ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพมหานคร 10110.

During the onboarding process, our operations team collected his contact details, including his primary mobile phone number +66 81 234 5678 and an office landline 02-345-6789. For communication and documentation purposes, his email address somchai.prasert@companymail.co.th
was used to share onboarding forms and contractual drafts.

For billing setup, the client opted to use a corporate credit card for recurring service charges. The mock credit card number provided for testing purposes is 4111 1111 1111 1111, with an expiration date of 08/27 and a CVV code of 123. This card is registered under the same legal name and will be used solely for automated monthly invoicing.

In addition, the finance department recorded a backup payment method through a local bank account with Bangkok Bank, account number 123-4-56789-0, to be used in case the primary payment method fails. All payment data is stored internally and access is restricted to authorized finance personnel only.`;

const hasDetection = (detections: ReturnType<typeof detectPII>, category: string, text: string): boolean =>
  detections.some((detection) => detection.category === category && detection.text === text);

describe('thai regression coverage', () => {
  it('detects full Thai ID, Thai bank account, Thai landline, and free-form Thai address', () => {
    const detections = detectPII(onboardingPrompt);

    expect(hasDetection(detections, 'national_id', '1-2345-67890-12-3')).toBe(true);
    expect(hasDetection(detections, 'bank_account', '123-4-56789-0')).toBe(true);
    expect(hasDetection(detections, 'phone', '02-345-6789')).toBe(true);
    expect(
      hasDetection(
        detections,
        'address',
        '88/123 ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพมหานคร 10110'
      )
    ).toBe(true);

    expect(hasDetection(detections, 'phone', '+66 81 234 5678')).toBe(true);
    expect(hasDetection(detections, 'email', 'somchai.prasert@companymail.co.th')).toBe(true);
    expect(hasDetection(detections, 'credit_card', '4111 1111 1111 1111')).toBe(true);
    expect(hasDetection(detections, 'phone', '1-2345-67890')).toBe(false);
  });

  it('does not classify formatted Thai-like IDs without Thai ID context', () => {
    const detections = detectPII('tracking token 9-8765-43210-98-7 is pending');

    expect(
      detections.some((detection) => detection.category === 'national_id')
    ).toBe(false);
  });

  it('does not classify hyphenated Thai-like account numbers without bank context', () => {
    const detections = detectPII('reference payload 123-4-56789-0 only');

    expect(
      detections.some((detection) => detection.category === 'bank_account')
    ).toBe(false);
  });

  it('suppresses Thai landline-like patterns in negative contexts', () => {
    const detections = detectPII('build ref 02-345-6789 for version 1.2.3');

    expect(detections.some((detection) => detection.category === 'phone')).toBe(false);
  });

  it('does not classify Thai address tokens without house/postal structure', () => {
    const detections = detectPII('ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพมหานคร');

    expect(detections.some((detection) => detection.category === 'address')).toBe(false);
  });
});
