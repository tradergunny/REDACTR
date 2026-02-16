# PII Rulebook

## Categories and Severity

| Category | Severity | Notes |
| --- | --- | --- |
| credit_card | Critical | Regex + Luhn validation |
| bank_account | Critical | Pattern + context keywords |
| ssn | Critical | Simple pattern |
| api_key | Critical | Prefix detection |
| password | High | Context keyword match |
| passport | High | Country-specific patterns |
| national_id | High | Country-specific patterns |
| email | Medium | RFC 5322 subset |
| phone | Medium | International formats |
| employee_name | Medium | Context + capitalization heuristics |
| address | Low | Named entity hints |

## Initial Pattern Examples

- Email: `\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b`
- SSN: `\b\d{3}-\d{2}-\d{4}\b`
- Credit card (coarse): `\b(?:\d[ -]*?){13,19}\b`
- API keys:
  - AWS: `\bAKIA[0-9A-Z]{16}\b`
  - Stripe: `\bsk_live_[0-9a-zA-Z]{24,}\b`
  - OpenAI: `\bsk-[A-Za-z0-9]{20,}\b`

Note: Final regex should be tested against the corpus and tuned for precision.

## Luhn Validation (Credit Cards)

```typescript
function luhnCheck(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}
```

## Masking Rules

| Category | Mask Format |
| --- | --- |
| email | `f***@domain.com` |
| phone | `***-***-1234` |
| ssn | `***-**-1234` |
| credit_card | `****-****-****-1234` |
| api_key | `sk-1234****` |
| default | `[REDACTED]` |

## False Positive Mitigation

- Allowlist support with pattern-based exclusions
- Reduce severity inside code blocks
- Context keywords for passwords and bank accounts
- Minimum length thresholds for numeric patterns
