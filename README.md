# REDACTR

PII protection layer for AI chatbots as a Chrome extension (Manifest V3). All detection runs locally in the browser. No backend services.

## Status

Documentation scaffolding is in place. Implementation is planned and not yet present in this repo.

## Scope (MVP)

- Real-time PII scanning in ChatGPT and Claude
- Severity-based warnings and submit interception
- One-click masking
- Allowlist controls
- Dashboard in a new tab
- Settings panel

## Non-Goals (MVP)

- Google Docs adapter
- Prompt coaching or AI rewriting
- SSO or team admin console
- Any cloud processing or storage of prompts

## Target Platforms

- Chrome 120+
- Edge 120+

## Planned Stack

- TypeScript
- Vite + CRXJS
- Manifest V3 service worker
- Chart.js for dashboard charts

## Repo Docs

- `PRD.md`
- `ARCHITECTURE_PII.md`
- `ADAPTER_SPEC.md`
- `PII_RULEBOOK.md`
- `EVENT_SCHEMA.md`
- `DASHBOARD_SPEC.md`
- `SETTINGS_SPEC.md`
- `QA_TEST_PLAN.md`
- `TEST_CASES.md`
- `PERFORMANCE.md`
- `THREAT_MODEL.md`
- `RELEASE.md`
- `PRIVACY_POLICY.md`

## Development Setup (Planned)

1. Install dependencies
2. Build the extension
3. Load unpacked extension in Chrome
4. Open ChatGPT or Claude to verify injection

Note: This section will be updated once implementation exists.
