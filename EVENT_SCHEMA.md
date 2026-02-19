# Event Schema

## Event Types
```typescript
type EventType =
  // Scanning
  | 'scan_completed'
  // Panel interactions
  | 'panel_opened'
  | 'panel_closed'
  // Per-item actions
  | 'pii_item_redacted'
  | 'pii_item_ignored'
  | 'pii_batch_redacted'
  // Submit flow
  | 'submit_intercepted'
  | 'submit_confirmed'
  | 'send_anyway_confirmed'
  // Dismissal
  | 'warning_dismissed'
  // Settings (Phase 5)
  | 'settings_changed'
  | 'pattern_allowlisted'
  // Dashboard (Phase 6)
  | 'dashboard_viewed';
```

## Event Interfaces

### Base Fields (all events)
```typescript
interface BaseEvent {
  event_id: string;        // UUID
  timestamp: string;       // ISO 8601
  event_type: EventType;
  platform: 'chatgpt' | 'claude';
  session_id: string;
}
```

### Scanning
```typescript
interface ScanCompletedEvent extends BaseEvent {
  event_type: 'scan_completed';
  char_count: number;
  pii_found: boolean;
  detection_count: number;
  latency_ms: number;
}
```

### Panel Interactions
```typescript
interface PanelOpenedEvent extends BaseEvent {
  event_type: 'panel_opened';
  detection_count: number;
  highest_severity: Severity;
  trigger: 'icon_click' | 'blocked_submit';
}

interface PanelClosedEvent extends BaseEvent {
  event_type: 'panel_closed';
  close_reason: 'icon_click' | 'outside_click' | 'escape' | 'close_button';
  pending_items: number;
  duration_ms: number;
}
```

### Per-Item Actions
```typescript
interface PIIItemRedactedEvent extends BaseEvent {
  event_type: 'pii_item_redacted';
  category: PIICategory;
  severity: Severity;
  confidence: number;
  redaction_format: string;
}

interface PIIItemIgnoredEvent extends BaseEvent {
  event_type: 'pii_item_ignored';
  category: PIICategory;
  severity: Severity;
  confidence: number;
}

interface PIIBatchRedactedEvent extends BaseEvent {
  event_type: 'pii_batch_redacted';
  item_count: number;
  categories: PIICategory[];
  severities: Severity[];
}
```

### Submit Flow
```typescript
interface SubmitInterceptedEvent extends BaseEvent {
  event_type: 'submit_intercepted';
  highest_severity: Severity;
  pending_count: number;
}

interface SubmitConfirmedEvent extends BaseEvent {
  event_type: 'submit_confirmed';
  redacted_count: number;
  ignored_count: number;
  total_detected: number;
  action_latency_ms: number;
}

interface SendAnywayConfirmedEvent extends BaseEvent {
  event_type: 'send_anyway_confirmed';
  highest_severity: Severity;
  item_count: number;
}
```

### Dismissal
```typescript
interface WarningDismissedEvent extends BaseEvent {
  event_type: 'warning_dismissed';
  pending_items: number;
  highest_severity: Severity;
}
```

### Settings (Phase 5)
```typescript
interface SettingsChangedEvent extends BaseEvent {
  event_type: 'settings_changed';
  setting_key: string;
  old_value: string;
  new_value: string;
}

interface PatternAllowlistedEvent extends BaseEvent {
  event_type: 'pattern_allowlisted';
  category: PIICategory;
  is_regex: boolean;
}
```

### Dashboard (Phase 6)
```typescript
interface DashboardViewedEvent extends BaseEvent {
  event_type: 'dashboard_viewed';
  filters_applied: string[];
}
```

## Storage Rules

- Store only metadata — never prompt text or matched PII values
- Local storage only (chrome.storage.local)
- 30-day rolling retention with auto-prune
- Events are immutable once written

## Aggregation Rules

- Daily rollups for trend charts
- Counts grouped by severity and category
- Outcomes grouped by action type (redacted / ignored / send_anyway / dismissed)

## Phase 4 Semantics

- `pii_item_ignored` is per-prompt only; ignore state is cleared on submit or when input becomes empty.
- `warning_dismissed` is emitted whenever the panel closes with one or more pending unresolved items.
- `send_anyway_confirmed` is emitted only when Critical/High flow uses modal confirmation.

## Deprecated Events (removed in Phase 4 redesign)

The following event types from the original spec no longer exist:
- `pii_masked` → replaced by `pii_item_redacted` + `pii_batch_redacted`
- `pii_allowed_once` → replaced by `pii_item_ignored`
- `pii_allowlisted` → moved to Phase 5 settings-only (`pattern_allowlisted`)
- `pii_edit_requested` → removed (replaced by per-item redaction selector)
- `warning_shown` → replaced by `panel_opened`

## Example Events
```json
{
  "event_id": "a1b2c3d4-5678-9abc-def0-123456789abc",
  "timestamp": "2026-02-19T14:30:00Z",
  "event_type": "pii_item_redacted",
  "platform": "chatgpt",
  "category": "credit_card",
  "severity": "critical",
  "confidence": 0.98,
  "redaction_format": "****-****-****-0005",
  "session_id": "sess_042"
}
```
```json
{
  "event_id": "b2c3d4e5-6789-abcd-ef01-23456789abcd",
  "timestamp": "2026-02-19T14:30:12Z",
  "event_type": "submit_confirmed",
  "platform": "chatgpt",
  "redacted_count": 3,
  "ignored_count": 1,
  "total_detected": 4,
  "action_latency_ms": 4200,
  "session_id": "sess_042"
}
```
