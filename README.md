# REDACTR

PII protection layer for AI chatbots as a Chrome extension (Manifest V3). All detection runs locally in the browser. No backend services.

## Status

Implemented in this repo through:
- Phase 1 Foundation
- Phase 2 Platform Adapters
- Phase 3 PII Detection Engine
- Phase 4 Intervention UX and Submit Control

Planned next:
- Phase 5 Settings expansion
- Phase 6 Dashboard

## Scope (MVP)

- Real-time PII scanning in ChatGPT and Claude
- Severity-based warnings and submit interception
- Per-item and batch redaction controls
- Allowlist controls
- Dashboard in a new tab (planned)
- Settings panel expansion (planned)

## Non-Goals (MVP)

- Google Docs adapter
- Prompt coaching or AI rewriting
- SSO or team admin console
- Any cloud processing or storage of prompts

## Target Platforms

- Chrome 120+
- Edge 120+

## Stack

- TypeScript
- Vite + CRXJS
- Manifest V3 service worker
- Vitest + jsdom

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

## Development Setup

1. `npm install`
2. `npm run dev`
3. Load unpacked extension in Chrome from `dist/`
4. Verify injection on ChatGPT or Claude

## Validation Commands

- `npm test`
- `npm run build`
