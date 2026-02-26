# Test Cases

## Implemented (Phases 1-4)

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| TC-001 | Detect critical PII | Paste a valid credit card number | Critical/high detection appears in panel, submit blocked until resolved or Send Anyway confirmation |
| TC-002 | Detect medium PII | Type email in prompt | Medium detection appears in panel, submit allowed |
| TC-003 | Per-item redact | Click Redact on detected email card | Email span is redacted, card moves to resolved state with Undo |
| TC-004 | Per-item ignore (session only) | Click Ignore on detected item | Item is marked ignored for current prompt only; state resets on submit/empty input |
| TC-005 | Batch redact | Click Redact All on multiple pending items | All pending items resolve to redacted state; contenteditable path is atomic |
| TC-006 | Submit interception flow | Attempt submit with unresolved Critical/High items | Native submit is blocked, panel opens, Send Anyway requires confirmation |
| TC-007 | Claude contenteditable | Type PII in Claude | Detection panel updates and submit interception works |
| TC-008 | ChatGPT composer | Type PII in ChatGPT | Detection panel updates and submit interception works |
| TC-009 | Long prompt | Paste >10K chars with PII | Detection works with chunking and remains responsive |
| TC-010 | Analytics opt-in default | Leave opt-in off | No outbound telemetry is sent |

## Planned-Phase Validation (Phases 5-6)

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| TC-011 | Settings persistence | Toggle category setting, reload | Setting persists via `chrome.storage.sync` and applies immediately |
| TC-012 | Allowlist from Settings | Add allowlist entry in Settings, enter matching text | Matching text is suppressed from warnings |
| TC-013 | Dashboard filters | Apply severity/platform/category filters | All widgets update within target response time |
