# QA Test Plan

## Unit Tests

- Email regex
- Phone regex
- SSN regex
- Credit card regex + Luhn
- API key patterns
- National ID patterns
- Severity scoring
- Masking functions

## Integration Tests

- Content script loads on ChatGPT
- Content script loads on Claude
- Adapter captures input and triggers detection
- Warning UI renders for detections
- Critical/High blocks submit
- Settings persist via storage
- Dashboard renders aggregates

## Regression Tests

- Daily selector checks for ChatGPT and Claude
- Verify input element detection
- Verify submit interception
- Verify warning injection

## Performance Tests

- Scan <=2000 chars in <100ms p95
- Warning render <500ms
- Typing overhead <50ms
- Memory <20MB

## Security Tests

- No prompt or PII stored
- CSP compliance
- Shadow DOM isolation
- Analytics opt-in respected
