import { describe, expect, it } from 'vitest';

import {
  createInterventionEvent,
  createScanCompletedEvent,
  sanitizePIIEvent,
  type PIIEvent
} from '../../src/shared/events';

describe('event helpers', () => {
  it('creates scan_completed event metadata without prompt text and includes detection_count', () => {
    const event = createScanCompletedEvent({
      platform: 'chatgpt',
      promptLength: 512,
      piiFound: true,
      detectionCount: 3,
      latencyMs: 12.34,
      sessionId: 'sess_phase3',
      mode: 'standard',
      ruleVersion: 'v2',
      decision: 'warn'
    });

    expect(event.event_type).toBe('scan_completed');
    expect(event.platform).toBe('chatgpt');
    expect(event.prompt_length).toBe(512);
    expect(event.char_count).toBe(512);
    expect(event.pii_found).toBe(true);
    expect(event.detection_count).toBe(3);
    expect(event.mode).toBe('standard');
    expect(event.rule_version).toBe('v2');
    expect(event.decision).toBe('warn');
    expect(typeof event.event_id).toBe('string');
    expect(event.event_id.length).toBeGreaterThan(0);
    expect((event as unknown as Record<string, unknown>).prompt_text).toBeUndefined();
  });

  it('sanitizes unknown payload keys to prevent pii text persistence', () => {
    const unsafeEvent = {
      event_id: 'evt_123',
      timestamp: new Date().toISOString(),
      event_type: 'submit_confirmed',
      platform: 'claude',
      session_id: 'sess_1',
      redacted_count: 2,
      ignored_count: 1,
      total_detected: 3,
      action_latency_ms: 1234,
      prompt_text: 'my password is 123',
      matched_text: '123'
    } as unknown as PIIEvent;

    const sanitized = sanitizePIIEvent(unsafeEvent);

    expect('prompt_text' in sanitized).toBe(false);
    expect('matched_text' in sanitized).toBe(false);
    expect(sanitized.redacted_count).toBe(2);
    expect(sanitized.ignored_count).toBe(1);
    expect(sanitized.total_detected).toBe(3);
  });

  it('creates intervention events with provided payload fields', () => {
    const event = createInterventionEvent({
      eventType: 'pii_item_redacted',
      platform: 'chatgpt',
      sessionId: 'sess_intervention',
      payload: {
        category: 'email',
        severity: 'medium',
        confidence: 0.91,
        redaction_format: 'j***@example.com'
      }
    });

    expect(event.event_type).toBe('pii_item_redacted');
    expect(event.platform).toBe('chatgpt');
    expect(event.category).toBe('email');
    expect(event.severity).toBe('medium');
    expect(event.redaction_format).toBe('j***@example.com');
    expect((event as unknown as Record<string, unknown>).prompt_text).toBeUndefined();
  });
});
