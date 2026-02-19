import type {
  DetectionDecision,
  DetectionMode,
  PIICategory,
  Severity
} from '../content/pii/types';

export type PlatformId = 'chatgpt' | 'claude';

export type PIIEventType =
  | 'scan_completed'
  | 'panel_opened'
  | 'panel_closed'
  | 'pii_item_redacted'
  | 'pii_item_ignored'
  | 'pii_batch_redacted'
  | 'submit_intercepted'
  | 'submit_confirmed'
  | 'send_anyway_confirmed'
  | 'warning_dismissed'
  | 'dashboard_viewed'
  | 'settings_changed'
  | 'pattern_allowlisted';

export interface PIIEvent {
  event_id: string;
  timestamp: string;
  event_type: PIIEventType;
  platform: PlatformId;
  session_id: string;
  category?: PIICategory;
  severity?: Severity;
  confidence?: number;
  decision?: DetectionDecision;
  shadow_decision?: DetectionDecision | 'mixed';
  suppressed_reason?: string;
  rule_version?: string;
  mode?: DetectionMode;
  prompt_length?: number;
  action_latency_ms?: number;
  char_count?: number;
  pii_found?: boolean;
  latency_ms?: number;
  detection_count?: number;
  highest_severity?: Severity;
  trigger?: 'icon_click' | 'blocked_submit';
  close_reason?: 'icon_click' | 'outside_click' | 'escape' | 'close_button';
  pending_items?: number;
  duration_ms?: number;
  redaction_format?: string;
  item_count?: number;
  categories?: PIICategory[];
  severities?: Severity[];
  pending_count?: number;
  redacted_count?: number;
  ignored_count?: number;
  total_detected?: number;
  filters_applied?: string[];
  setting_key?: string;
  old_value?: string;
  new_value?: string;
  is_regex?: boolean;
}

export interface ScanCompletedEventInput {
  platform: PlatformId;
  promptLength: number;
  piiFound: boolean;
  detectionCount: number;
  latencyMs: number;
  sessionId: string;
  mode?: DetectionMode;
  ruleVersion?: string;
  decision?: DetectionDecision;
  shadowDecision?: DetectionDecision | 'mixed';
  suppressedReason?: string;
}

export interface InterventionEventInput {
  eventType: Exclude<PIIEventType, 'scan_completed'>;
  platform: PlatformId;
  sessionId: string;
  payload?: Partial<Omit<PIIEvent, 'event_id' | 'timestamp' | 'event_type' | 'platform' | 'session_id'>>;
}

export const createScanCompletedEvent = (
  input: ScanCompletedEventInput
): PIIEvent => {
  const now = new Date().toISOString();
  const roundedLatencyMs = Number(input.latencyMs.toFixed(2));

  const event: PIIEvent = {
    event_id: crypto.randomUUID(),
    timestamp: now,
    event_type: 'scan_completed',
    platform: input.platform,
    session_id: input.sessionId,
    prompt_length: input.promptLength,
    char_count: input.promptLength,
    pii_found: input.piiFound,
    detection_count: input.detectionCount,
    latency_ms: roundedLatencyMs
  };

  if (input.mode) {
    event.mode = input.mode;
  }

  if (input.ruleVersion) {
    event.rule_version = input.ruleVersion;
  }

  if (input.decision) {
    event.decision = input.decision;
  }

  if (input.shadowDecision) {
    event.shadow_decision = input.shadowDecision;
  }

  if (input.suppressedReason) {
    event.suppressed_reason = input.suppressedReason;
  }

  return event;
};

export const createInterventionEvent = (
  input: InterventionEventInput
): PIIEvent => ({
  event_id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  event_type: input.eventType,
  platform: input.platform,
  session_id: input.sessionId,
  ...(input.payload ?? {})
});

export const sanitizePIIEvent = (event: PIIEvent): PIIEvent => {
  const sanitized: PIIEvent = {
    event_id: event.event_id,
    timestamp: event.timestamp,
    event_type: event.event_type,
    platform: event.platform,
    session_id: event.session_id
  };
  const mutableSanitized = sanitized as unknown as Record<string, unknown>;

  const copyKeys: Array<keyof PIIEvent> = [
    'category',
    'severity',
    'confidence',
    'decision',
    'shadow_decision',
    'suppressed_reason',
    'rule_version',
    'mode',
    'prompt_length',
    'action_latency_ms',
    'char_count',
    'pii_found',
    'latency_ms',
    'detection_count',
    'highest_severity',
    'trigger',
    'close_reason',
    'pending_items',
    'duration_ms',
    'redaction_format',
    'item_count',
    'categories',
    'severities',
    'pending_count',
    'redacted_count',
    'ignored_count',
    'total_detected',
    'filters_applied',
    'setting_key',
    'old_value',
    'new_value',
    'is_regex'
  ];

  for (const key of copyKeys) {
    const value = event[key];

    if (typeof value === 'undefined') {
      continue;
    }

    mutableSanitized[key] = Array.isArray(value) ? [...value] : value;
  }

  return sanitized;
};
