import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';

describe('overlap priority matrix', () => {
  it('prefers passport over password when ranges collide', () => {
    const detections = detectPII('password: AB1234567');
    const categories = detections.map((detection) => detection.category);

    expect(categories).toContain('passport');
    expect(categories).not.toContain('password');
  });

  it('prefers bank account over national id when overlap collides', () => {
    const detections = detectPII('bank account citizen id 1101700203450 should be reviewed');
    const categories = detections.map((detection) => detection.category);

    expect(categories).toContain('bank_account');
    expect(categories).not.toContain('national_id');
  });
});
