# Event Schema

## Event Model

```typescript
interface PIIEvent {
  event_id: string;        // UUID
  timestamp: string;       // ISO 8601
  event_type: 'scan_completed' | 'warning_shown' | 'pii_detected' |
              'pii_masked' | 'pii_allowed_once' | 'pii_allowlisted' |
              'pii_edit_requested' | 'warning_dismissed' |
              'submit_intercepted' | 'dashboard_viewed' |
              'settings_changed';
  platform: 'chatgpt' | 'claude';
  category?: PIICategory;
  severity?: Severity;
  confidence?: number;
  prompt_length?: number;
  action_latency_ms?: number;
  session_id: string;
}
```

## Storage Rules

- Store only metadata, never prompt text or matched PII
- Local storage only
- 30-day rolling retention

## Aggregation Rules

- Daily rollups for trend charts
- Counts grouped by severity and category
- Outcomes grouped by action type

## Example Event

```json
{
  "event_id": "c2db8f8a-2a45-4d73-9fd0-2ddc50f21c02",
  "timestamp": "2026-02-16T18:00:00Z",
  "event_type": "pii_detected",
  "platform": "chatgpt",
  "category": "email",
  "severity": "medium",
  "confidence": 0.92,
  "prompt_length": 312,
  "action_latency_ms": 480,
  "session_id": "sess_01"
}
```
