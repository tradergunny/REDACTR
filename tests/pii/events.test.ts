import { describe, expect, it } from 'vitest';

import {
  createPIIActionEvent,
  createScanCompletedEvent,
  sanitizePIIEvent,
  type PIIEvent
} from '../../src/shared/events';

describe('event helpers', () => {
  it('creates scan_completed event metadata without prompt text', () => {
    const event = createScanCompletedEvent({
      platform: 'chatgpt',
      promptLength: 512,
      piiFound: true,
      latencyMs: 12.34,
      sessionId: 'sess_phase3'
    });

    expect(event.event_type).toBe('scan_completed');
    expect(event.platform).toBe('chatgpt');
    expect(event.prompt_length).toBe(512);
    expect(event.char_count).toBe(512);
    expect(event.pii_found).toBe(true);
    expect(typeof event.event_id).toBe('string');
    expect(event.event_id.length).toBeGreaterThan(0);
    expect((event as unknown as Record<string, unknown>).prompt_text).toBeUndefined();
  });

  it('sanitizes unknown payload keys to prevent pii text persistence', () => {
    const unsafeEvent = {
      event_id: 'evt_123',
      timestamp: new Date().toISOString(),
      event_type: 'scan_completed',
      platform: 'claude',
      session_id: 'sess_1',
      prompt_length: 42,
      pii_found: false,
      latency_ms: 1.2,
      prompt_text: 'my password is 123',
      matched_text: '123'
    } as unknown as PIIEvent;

    const sanitized = sanitizePIIEvent(unsafeEvent);

    expect('prompt_text' in sanitized).toBe(false);
    expect('matched_text' in sanitized).toBe(false);
    expect(sanitized.prompt_length).toBe(42);
  });

  it('creates intervention action events without prompt text', () => {
    const event = createPIIActionEvent({
      eventType: 'pii_masked',
      platform: 'chatgpt',
      sessionId: 'sess_intervention',
      promptLength: 120,
      actionLatencyMs: 45.123,
      category: 'email',
      severity: 'medium',
      confidence: 0.91
    });

    expect(event.event_type).toBe('pii_masked');
    expect(event.platform).toBe('chatgpt');
    expect(event.prompt_length).toBe(120);
    expect(event.action_latency_ms).toBe(45.12);
    expect(event.category).toBe('email');
    expect(event.severity).toBe('medium');
    expect((event as unknown as Record<string, unknown>).prompt_text).toBeUndefined();
  });
});
