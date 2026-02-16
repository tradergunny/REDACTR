import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );

  return sorted[index];
};

describe('pii scan performance', () => {
  it('keeps p95 latency under 100ms for 2000-char inputs', () => {
    const base = 'normal sentence with no pii '.repeat(80);
    const sample = `${base} email alice@example.com password: Hunter2! bank account number 123456789012`;

    const measurements: number[] = [];

    for (let iteration = 0; iteration < 120; iteration += 1) {
      const start = performance.now();
      detectPII(sample);
      const latency = performance.now() - start;
      measurements.push(latency);
    }

    const p95 = percentile(measurements, 95);

    expect(sample.length).toBeGreaterThanOrEqual(2000);
    expect(p95).toBeLessThan(100);
  });
});
