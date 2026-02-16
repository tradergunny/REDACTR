import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';

const findCategory = (input: string, category: string) =>
  detectPII(input).find((detection) => detection.category === category);

describe('pii engine behavior', () => {
  it('downgrades severity inside fenced code blocks', () => {
    const detection = findCategory('```\nSSN: 123-45-6789\n```', 'ssn');

    expect(detection).toBeDefined();
    expect(detection?.severity).toBe('high');
  });

  it('downgrades severity inside inline backticks', () => {
    const detection = findCategory('Use `password: Hunter2!` in docs', 'password');

    expect(detection).toBeDefined();
    expect(detection?.severity).toBe('medium');
  });

  it('downgrades severity inside html code tags', () => {
    const detection = findCategory('<code>john.doe@example.com</code>', 'email');

    expect(detection).toBeDefined();
    expect(detection?.severity).toBe('low');
  });

  it('keeps highest-priority overlap when categories collide', () => {
    const detections = detectPII(
      'bank account citizen id 1101700203450 should be reviewed'
    );

    const categories = detections.map((detection) => detection.category);

    expect(categories).toContain('bank_account');
    expect(categories).not.toContain('national_id');
  });

  it('keeps non-overlapping detections after overlap resolution', () => {
    const detections = detectPII(
      'SSN 123-45-6789 and email jane.doe@example.com are present'
    );

    expect(detections.some((detection) => detection.category === 'ssn')).toBe(true);
    expect(detections.some((detection) => detection.category === 'email')).toBe(true);
  });

  it('handles long prompts using chunked processing', () => {
    const prefix = 'plain text '.repeat(1200);
    const suffix = ' more plain text'.repeat(1200);
    const input = `${prefix} contact me at end.user@example.com ${suffix}`;

    const detection = findCategory(input, 'email');

    expect(input.length).toBeGreaterThan(10_000);
    expect(detection).toBeDefined();
    expect(detection?.text).toContain('end.user@example.com');
  });

  it('returns empty array for blank input', () => {
    expect(detectPII('   \n\t ')).toEqual([]);
  });

  it('clamps confidence to the expected range', () => {
    const detections = detectPII('password: Hunter2! and john.doe@example.com');

    for (const detection of detections) {
      expect(detection.confidence).toBeGreaterThanOrEqual(0);
      expect(detection.confidence).toBeLessThanOrEqual(1);
    }
  });
});
