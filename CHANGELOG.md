# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Docs: Aligned blueprint/spec/docs with implemented Phase 1-4 behavior and current contracts.
  - Files: `README.md`, `PRD.md`, `REDACTR_BUILD_GUIDE.md`, `REDACTR_DEV_BLUEPRINT.md`, `TEST_CASES.md`, `QA_TEST_PLAN.md`, `DASHBOARD_SPEC.md`
  - Behavior: updated stale pre-implementation status text; corrected active intervention flow terminology (`Redact`/`Ignore`/`Redact All`/`Send Anyway`), adapter contract references, and dashboard data-source event mapping to current schema.
  - Behavior: split validation docs into implemented-now vs planned-phase coverage for Settings (Phase 5) and Dashboard (Phase 6).
  - Validation: docs consistency scan completed (deprecated terms restricted to explicit legacy/deprecation context); `npm test` passed on February 26, 2026 (`20` files, `698` tests).

- Intervention: Restored immediate contenteditable redaction using explicit span operations with live range tracking.
  - Files: `src/content/intervention/controller.ts`, `src/content/intervention/types.ts`
  - Behavior: `Redact`/`Undo`/`Redact All`/`Reset` now mutate contenteditable prompts immediately again without using broad diff synthesis.
  - Behavior: contenteditable replacements now track per-item live offsets (`liveRange`, `liveExpectedText`) so far-apart redactions remain index-safe after length shifts.
  - Behavior: contenteditable no longer uses diff-based fallback or `setText` fallback; failed applies stay fail-safe (skip operation, preserve current text/state).
  - Behavior: `Redact All` in contenteditable is atomic (all-or-none) against the current editor text.

- Tests: Added immediate contenteditable regression coverage for index shift, undo targeting, atomic redact-all, and no-submit re-mutation.
  - Files: `tests/content/intervention-controller.test.ts`, `tests/adapters/hooks.test.ts`
  - Behavior: verifies multi-paragraph far-apart replacements preserve structure and only mutate matched spans.
  - Validation: `npm test` and `npm run build` passed on February 25, 2026 (`20` files, `698` tests).

- Intervention: Deferred contenteditable redaction preview to submit-time to prevent Redact-click formatting collapse.
  - Files: `src/content/intervention/controller.ts`
  - Behavior: for contenteditable editors, `Redact`/`Undo`/`Redact All`/`Reset` update intervention state only and no longer mutate prompt text immediately.
  - Behavior: redaction text mutations for contenteditable now occur only during submit flow via safe replacement path; if apply fails, submit aborts and items revert to pending.

- Tests: Added contenteditable deferred-preview regression coverage.
  - Files: `tests/content/intervention-controller.test.ts`
  - Behavior: verifies Redact does not change prompt text immediately, submit applies masking when safe, and replacement failure keeps text unchanged with no send.
  - Validation: `npm test -- --run tests/content/intervention-controller.test.ts tests/adapters/hooks.test.ts` and `npm test` passed on February 25, 2026 (`20` files, `694` tests).

- Intervention: Disabled destructive contenteditable fallback on redaction apply failure.
  - Files: `src/content/intervention/controller.ts`
  - Behavior: if in-place replacement cannot be applied, controller no longer falls back to `setText` for contenteditable; it restores local state to the current captured text and reverts resolved redactions back to pending.
  - Behavior: submit now aborts when a required contenteditable redaction update fails, preventing false "redacted" send state.

- Tests: Added contenteditable replacement-failure regression for safe no-op behavior.
  - Files: `tests/content/intervention-controller.test.ts`
  - Behavior: verifies failed replacement keeps original text unchanged and item remains actionable (`Redact` visible, no `Undo` state).
  - Validation: `npm test -- --run tests/content/intervention-controller.test.ts tests/adapters/hooks.test.ts` and `npm test` passed on February 25, 2026 (`20` files, `693` tests).

- Adapters: Added structured text replacement API and contenteditable-safe range patching.
  - Files: `src/content/adapters/types.ts`, `src/content/adapters/base.ts`, `src/content/adapters/chatgpt.ts`, `src/content/adapters/claude.ts`
  - Behavior: introduced `applyTextReplacements(baseText, replacements)` and DOM range replacement against mapped text-node offsets to avoid full-editor `textContent` rewrites when redacting.
  - Behavior: unified contenteditable capture path via node-walk extraction so detection text and replacement mapping use the same representation.

- Intervention: Switched redaction apply flow to replacement-list execution.
  - Files: `src/content/intervention/controller.ts`
  - Behavior: controller now resolves exact redaction spans into replacement objects, applies them through adapter in-place replacement first, and falls back to full set only when needed.

- Tests: Added regression coverage for surgical contenteditable replacement path.
  - Files: `tests/adapters/hooks.test.ts`, `tests/content/intervention-controller.test.ts`
  - Behavior: verifies targeted replacement preserves paragraph structure and stale ranges no-op safely.
  - Validation: `npm test -- --run tests/adapters/hooks.test.ts tests/content/intervention-controller.test.ts` and `npm test` passed on February 25, 2026 (`20` files, `692` tests).

- Process: Established development progress logging protocol:
  - Completed implementation tasks now require a same-turn `CHANGELOG.md` update plus a short chat summary.
  - Each changelog entry should include scope tag, files touched, behavior change, and validation status.
  - Partial/in-progress work is reported in chat only; follow-up entries are used for reversions.

- Adapters: Preserved raw prompt formatting capture for replacement workflows.
  - Files: `src/content/adapters/base.ts`
  - Behavior: `normalizeCapturedText` is now pass-through so capture does not trim/collapse/normalize whitespace.

- Intervention: Enforced exact-span replacement guard for redaction apply.
  - Files: `src/content/intervention/controller.ts`
  - Behavior: replacement now proceeds only when `slice(startIndex, endIndex) === detection.text`; stale mismatches are skipped.

- Tests: Added formatting-preservation and mismatch-guard regressions.
  - Files: `tests/adapters/hooks.test.ts`, `tests/content/intervention-controller.test.ts`
  - Behavior: asserts preservation of leading/trailing spaces, triple newlines, multiline structure, and stale-span no-op replacement.
  - Validation: `npm test` passed on February 25, 2026 (`20` files, `690` tests).

- Implemented Phase 4 Intervention UX & Submit Control:
  - Rebuilt intervention UI from legacy inline banner to floating icon + Shadow DOM popover panel:
    - removed legacy `src/content/intervention/banner.ts`
    - added `src/content/intervention/panel.ts` for icon, panel, modal, focus trap, outside/Escape dismissal, and viewport-aware positioning.
  - Refactored intervention state flow in `src/content/intervention/controller.ts`:
    - per-item state map with statuses (`pending`/`redacted`/`ignored`)
    - live in-place re-scan while panel stays open
    - state persistence only for exact `category + text` matches
    - per-prompt-only ignore behavior (cleared on submit or empty input)
    - submit blocking for unresolved Critical/High with dimmed native send button.
  - Added redaction format policy in `src/content/intervention/redaction-formats.ts`:
    - exactly 3 options per category (token, partial, `[REDACTED]`)
    - severity-based defaults (Critical/High => token, Medium/Low => partial).
  - Updated adapter contracts and implementations:
    - replaced `getWarningAnchor()` with `getIconAnchor()`
    - added `getInputAreaWrapper()`
    - removed legacy warning rendering from adapter layer.
  - Migrated event model in `src/shared/events.ts` to redesigned schema:
    - removed deprecated Phase 4 events (`pii_masked`, `pii_allowed_once`, `pii_allowlisted`, `pii_edit_requested`, `warning_shown`)
    - added/normalized `panel_opened`, `panel_closed`, `pii_item_redacted`, `pii_item_ignored`, `pii_batch_redacted`, `submit_confirmed`, `send_anyway_confirmed`
    - extended `scan_completed` with `detection_count`.
  - Updated content-script wiring in `src/content/index.ts`:
    - `scan_completed` now includes detection count
    - UI anchor sync is refreshed during adapter rebind to survive platform rerenders.
  - Reworked Phase 4 tests:
    - `tests/content/banner.test.ts` now validates icon/panel/modal behaviors, z-index tiers, dismissal controls, and flip positioning.
    - `tests/content/intervention-controller.test.ts` now validates live re-scan state preservation rules, per-prompt resets, submit blocking, and send-anyway semantics.
    - updated `tests/pii/events.test.ts` and adapter selector tests for the new contracts.

- Implemented Phase 3 PII Detection Engine:
  - Added full PII detection contracts and rule registry with 11 categories: `credit_card`, `bank_account`, `ssn`, `api_key`, `password`, `passport`, `national_id`, `email`, `phone`, `employee_name`, and `address`.
  - Added category detectors with Thai + US coverage for country-specific identifiers, including Luhn validation for credit card detection and Thai 13-digit checksum validation for national IDs.
  - Added deterministic masking utility (`generateMask`) across all PII categories.
  - Added code-block context analysis for fenced/inline backticks and `<code>/<pre>` tags to downgrade severity and reduce false positives.
  - Added overlap resolution and confidence scoring pipeline in `detectPII()` with long-input chunking (>10K chars).
- Wired detection into content-script text-change flow (reusing existing 300ms debounce + immediate paste behavior) and added `scan_completed` event emission with latency + prompt length metadata only.
- Added shared event typing/utilities and background event ingestion with privacy-preserving sanitization and local retention storage.
- Added Phase 3 test coverage:
  - 100+ corpus-driven category cases
  - rule behavior tests (code-block downgrade, overlap handling, chunking)
  - Luhn and mask unit tests
  - event privacy tests
  - p95 latency performance guard for 2000-char inputs

- Implemented Phase 2 Platform Adapter Layer:
  - Added full `PlatformAdapter` contract and shared adapter utilities for selector fallback, event lifecycle management, and cleanup.
  - Added ChatGPT adapter with resilient 3-tier input/submit selectors, textarea capture, text-change observation, and submit interception hooks.
  - Added Claude adapter with resilient 3-tier input/submit selectors, contenteditable HTML-to-text capture, text-change observation, and submit interception hooks.
  - Added platform adapter factory with URL-based auto-detection for `chatgpt.com`, `chat.openai.com`, and `claude.ai`.
- Updated content script to initialize adapters when enabled, wire text-change and submit-intercept debug hooks, and teardown observers/listeners on state changes/unload.
- Added Phase 2 unit test coverage using `jsdom` for:
  - adapter factory platform detection
  - selector fallback behavior
  - text capture and text-change hooks
  - submit interception (click + Enter block/non-block)
  - cleanup/idempotent lifecycle behavior
- Updated Vitest environment to `jsdom` and added `jsdom` as a development dependency.

- Phase 1 foundation scaffold using Vite + TypeScript + CRXJS
- Added Manifest V3 extension skeleton with minimal permissions:
  - `storage`, `activeTab`
  - host permissions for `chat.openai.com`, `chatgpt.com`, and `claude.ai`
- Added background service worker with runtime message handling for:
  - content script bootstrap events
  - extension enabled state read/write
  - state broadcast to active target-domain tabs
- Added content script bootstrap for supported hosts with:
  - service worker handshake message
  - extension enabled-state marker updates
  - runtime listener for enabled-state changes
- Added popup UI with persistent on/off toggle backed by `chrome.storage.sync`
- Added development and quality tooling:
  - ESLint flat config (`eslint.config.js`)
  - Prettier config (`.prettierrc.json`, `.prettierignore`)
  - Vitest config (`vitest.config.ts`) and sample passing test
- Added initial project configuration:
  - `package.json` scripts for `dev`, `build`, `lint`, `test`, and formatting
  - TypeScript config (`tsconfig.json`)
  - Vite + CRX manifest wiring (`vite.config.ts`, `manifest.config.ts`)
- Fixed Vite extension dev-mode connectivity by binding dev server to all interfaces with a fixed port (`5173`, `strictPort`) to avoid localhost resolution and port-drift issues
- Fixed CRX dev service-worker load failures by enabling Vite dev-server CORS so extension-origin requests can load `@crx/client-worker` and `@vite/env`
