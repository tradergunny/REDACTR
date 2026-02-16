# Threat Model

## Assets

- Prompt text in memory
- Detection results (in-memory only)
- Settings and allowlist in storage
- Event metadata in local storage

## Threats and Mitigations

| Threat | Impact | Mitigation |
| --- | --- | --- |
| Prompt exfiltration | High | No network calls, local-only processing |
| DOM selector breakage | High | Adapter fallback selectors, regression checks |
| Storage leakage via XSS | Medium | Shadow DOM isolation, no untrusted HTML storage |
| Supply chain compromise | High | Lockfile, dependency auditing |
| Excessive permissions | Medium | Minimal MV3 permissions |

## Trust Boundaries

- Platform DOM (untrusted)
- Extension content script (trusted)
- Service worker and storage (trusted)
- Optional analytics endpoint (trusted, opt-in)
