# QA Test Plan

## Implemented Now (Phases 1-4)

### Unit Tests

- Email regex
- Phone regex
- SSN regex
- Credit card regex + Luhn
- API key patterns
- National ID patterns
- Severity scoring and execution-mode decisions
- Masking and redaction-format functions

### Integration Tests

- Content script loads on ChatGPT
- Content script loads on Claude
- Adapter captures input and triggers detection
- Floating icon + panel UI renders for detections
- Critical/High submit blocking and Send Anyway confirmation behavior
- Contenteditable-safe replacement path and no-op failure safety
- Event tracking to background with metadata-only payloads

### Regression Tests

- Selector fallback checks for ChatGPT and Claude
- Input detection resilience across rerenders
- Submit interception via click and Enter
- Panel open/close/dismissal behavior

### Performance Tests

- Scan <=2000 chars in <100ms p95
- Warning/panel render <500ms
- Typing overhead <50ms
- Memory <20MB target envelope

### Security Tests

- No prompt or raw PII content stored
- CSP compliance
- Shadow DOM isolation
- Analytics remains opt-in

## Planned Coverage (Phases 5-6)

### Phase 5 Settings + Allowlist

- Settings sections render (Detection, Notifications, Privacy, About)
- Category toggles and detection mode changes apply immediately
- Settings persist via `chrome.storage.sync`
- Allowlist CRUD + import/export JSON + FIFO cap behavior

### Phase 6 Dashboard

- Dashboard widgets render from event storage aggregates
- Cross-widget filters (time/platform/severity/category) behave consistently
- Dashboard load/render/filter performance targets
