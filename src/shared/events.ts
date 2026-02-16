import type { PIICategory, Severity } from '../content/pii/types';

export type PlatformId = 'chatgpt' | 'claude';

export type PIIEventType =
  | 'scan_completed'
  | 'warning_shown'
  | 'pii_detected'
  | 'pii_masked'
  | 'pii_allowed_once'
  | 'pii_allowlisted'
  | 'pii_edit_requested'
  | 'warning_dismissed'
  | 'submit_intercepted'
  | 'dashboard_viewed'
  | 'settings_changed';

export interface PIIEvent {
  event_id: string;
  timestamp: string;
  event_type: PIIEventType;
  platform: PlatformId;
  category?: PIICategory;
  severity?: Severity;
  confidence?: number;
  prompt_length?: number;
  action_latency_ms?: number;
  session_id: string;
  char_count?: number;
  pii_found?: boolean;
  latency_ms?: number;
}

export interface ScanCompletedEventInput {
  platform: PlatformId;
  promptLength: number;
  piiFound: boolean;
  latencyMs: number;
  sessionId: string;
}

export type PIIActionEventType = Extract<
  PIIEventType,
  | 'pii_masked'
  | 'pii_edit_requested'
  | 'pii_allowed_once'
  | 'warning_dismissed'
  | 'submit_intercepted'
  | 'pii_allowlisted'
>;

export interface PIIActionEventInput {
  eventType: PIIActionEventType;
  platform: PlatformId;
  sessionId: string;
  promptLength: number;
  actionLatencyMs?: number;
  category?: PIICategory;
  severity?: Severity;
  confidence?: number;
}

export const createScanCompletedEvent = (
  input: ScanCompletedEventInput
): PIIEvent => {
  const now = new Date().toISOString();
  const roundedLatencyMs = Number(input.latencyMs.toFixed(2));

  return {
    event_id: crypto.randomUUID(),
    timestamp: now,
    event_type: 'scan_completed',
    platform: input.platform,
    session_id: input.sessionId,
    prompt_length: input.promptLength,
    char_count: input.promptLength,
    pii_found: input.piiFound,
    latency_ms: roundedLatencyMs
  };
};

export const createPIIActionEvent = (input: PIIActionEventInput): PIIEvent => {
  const event: PIIEvent = {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    event_type: input.eventType,
    platform: input.platform,
    session_id: input.sessionId,
    prompt_length: input.promptLength
  };

  if (typeof input.actionLatencyMs === 'number') {
    event.action_latency_ms = Number(input.actionLatencyMs.toFixed(2));
  }

  if (input.category) {
    event.category = input.category;
  }

  if (input.severity) {
    event.severity = input.severity;
  }

  if (typeof input.confidence === 'number') {
    event.confidence = input.confidence;
  }

  return event;
};

export const sanitizePIIEvent = (event: PIIEvent): PIIEvent => {
  const sanitized: PIIEvent = {
    event_id: event.event_id,
    timestamp: event.timestamp,
    event_type: event.event_type,
    platform: event.platform,
    session_id: event.session_id
  };

  if (event.category) {
    sanitized.category = event.category;
  }

  if (event.severity) {
    sanitized.severity = event.severity;
  }

  if (typeof event.confidence === 'number') {
    sanitized.confidence = event.confidence;
  }

  if (typeof event.prompt_length === 'number') {
    sanitized.prompt_length = event.prompt_length;
  }

  if (typeof event.action_latency_ms === 'number') {
    sanitized.action_latency_ms = event.action_latency_ms;
  }

  if (typeof event.char_count === 'number') {
    sanitized.char_count = event.char_count;
  }

  if (typeof event.pii_found === 'boolean') {
    sanitized.pii_found = event.pii_found;
  }

  if (typeof event.latency_ms === 'number') {
    sanitized.latency_ms = event.latency_ms;
  }

  return sanitized;
};
