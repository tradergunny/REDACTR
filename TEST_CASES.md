# Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| TC-001 | Detect critical PII | Paste a valid credit card number | Critical warning shown, submit blocked |
| TC-002 | Detect email | Type email in prompt | Medium warning shown, submit allowed |
| TC-003 | Mask and send | Click Mask & Send on detected email | Email masked, submit proceeds |
| TC-004 | Allow once | Click Allow This Time | Submit proceeds, warning suppressed for session |
| TC-005 | Always allow | Click Always Allow | Pattern added to allowlist |
| TC-006 | Allowlist enforcement | Enter allowlisted pattern | No warning shown |
| TC-007 | Claude contenteditable | Type PII in Claude | Warning shown, submit interception works |
| TC-008 | ChatGPT textarea | Type PII in ChatGPT | Warning shown, submit interception works |
| TC-009 | Long prompt | Paste >10K chars with PII | Detection works with chunking |
| TC-010 | Dashboard filters | Apply severity filter | Widgets update within 500ms |
| TC-011 | Settings persistence | Toggle category, reload | Setting persists |
| TC-012 | Analytics opt-in | Leave opt-in off | No outbound telemetry |
