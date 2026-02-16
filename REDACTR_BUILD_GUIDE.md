# REDACTR — Phase-by-Phase Build Guide

**Purpose:** Step-by-step instructions for building REDACTR using Codex/Cursor. Each phase lists the exact files to tag as context, the prompt to give, and the exit criteria before moving on.

**Rule:** Always tag `CHANGELOG.md` in every phase — Codex should update it with each implementation step.

---

## Phase 1: Foundation & Extension Skeleton

### Goal
MV3 scaffold, dev environment, service worker, content script bootstrapping, popup with on/off toggle.

### Tag These Files
```
prd.md
ARCHITECTURE_PII.md
CHANGELOG.md
```

### Prompt
> Implement Phase 1: Foundation & Extension Skeleton.
> 
> Set up the project with Vite + TypeScript + CRXJS. Create the Manifest V3 scaffold with minimal permissions (storage, activeTab, host_permissions for chat.openai.com, chatgpt.com, claude.ai). Implement:
> - Service worker (background.js) with message passing infrastructure
> - Content script that loads on target domains
> - Popup UI with on/off toggle that persists state via chrome.storage
> - ESLint, Prettier, Vitest configuration
> 
> Update CHANGELOG.md with all changes.

### Exit Criteria
- [ ] Extension loads in Chrome dev mode (`chrome://extensions`)
- [ ] Content script injects on ChatGPT and Claude pages
- [ ] Popup toggles extension on/off, state persists across popup open/close
- [ ] Service worker receives messages from content script
- [ ] `npm run dev` works with hot reload
- [ ] `npm run test` runs Vitest with a sample passing test
- [ ] ESLint + Prettier configured and passing

---

## Phase 2: Platform Adapter Layer

### Goal
Adapter interface + ChatGPT and Claude implementations with resilient selectors and submit interception wiring.

### Tag These Files
```
prd.md
ARCHITECTURE_PII.md
ADAPTER_SPEC.md
CHANGELOG.md
```

### Prompt
> Implement Phase 2: Platform Adapter Layer.
> 
> Follow the PlatformAdapter interface from the PRD and ADAPTER_SPEC.md. Build:
> - PlatformAdapter TypeScript interface
> - ChatGPT adapter (textarea#prompt-textarea, send button, text change via MutationObserver)
> - Claude adapter (contenteditable div, send button, innerHTML parsing)
> - 3-tier selector fallback strategy (data-testid → aria-label → heuristic)
> - Submit interception hooks (click + Enter key)
> - Text change observation with cleanup lifecycle
> - Adapter factory that auto-detects which platform based on URL
> 
> Update CHANGELOG.md.

### Exit Criteria
- [ ] Adapter factory correctly identifies ChatGPT vs Claude from URL
- [ ] `captureText()` returns current input text on both platforms
- [ ] `onTextChanged()` fires callback when user types (both platforms)
- [ ] `onSubmitIntercept()` can prevent form submission on both platforms
- [ ] `cleanup()` removes all observers and listeners
- [ ] Fallback selectors activate when primary selector fails
- [ ] Unit tests for adapter factory and selector fallback logic

---

## Phase 3: PII Detection Engine

### Goal
Full regex rulebook, severity scoring, Luhn validation, masking utilities, debounce pipeline.

### Tag These Files
```
prd.md
PII_RULEBOOK.md
EVENT_SCHEMA.md
CHANGELOG.md
```

### Prompt
> Implement Phase 3: PII Detection Engine.
> 
> Follow PII_RULEBOOK.md for all regex patterns and severity mappings. Build:
> - Detection engine that takes a string and returns DetectionResult[]
> - Regex patterns for all 11 PII categories (credit card, bank account, SSN, API keys, passwords, passport, national ID, email, phone, employee names, addresses)
> - Luhn algorithm validation for credit card numbers
> - Severity classification (Critical/High/Medium/Low) per PII_RULEBOOK.md
> - Confidence scoring (0.0–1.0)
> - generateMask() function for all categories
> - Code block context detection (backticks, <code>, <pre>) to reduce severity or skip
> - 300ms debounce wrapper with immediate-on-paste mode
> - Unit tests: 100+ test cases across all categories per PII_RULEBOOK.md
> 
> Follow EVENT_SCHEMA.md for the scan_completed event structure.
> Update CHANGELOG.md.

### Exit Criteria
- [ ] All 11 PII categories detected correctly
- [ ] Luhn validation rejects invalid CC numbers
- [ ] ≥95% precision on test corpus
- [ ] <100ms scan latency on 2000-char input
- [ ] Code blocks reduce detection severity appropriately
- [ ] Masking produces correct output for every category
- [ ] Debounce fires at 300ms; paste triggers immediate scan
- [ ] 100+ unit tests passing

---

## Phase 4: Intervention UX & Submit Control

### Goal
Shadow DOM warning banners, severity color-coding, all 5 user actions, submit blocking for Critical/High.

### Tag These Files
```
prd.md
ADAPTER_SPEC.md
ARCHITECTURE_PII.md
EVENT_SCHEMA.md
CHANGELOG.md
```

### Prompt
> Implement Phase 4: Intervention UX & Submit Control.
> 
> Build the warning/action UI layer:
> - Shadow DOM container injected via adapter's getWarningAnchor()
> - Warning banner with severity color-coding (Critical=red #DC2626, High=orange #EA580C, Medium=yellow #CA8A04, Low=blue #2563EB)
> - Multiple detections grouped in a single banner (anti-fatigue)
> - Masked preview of detected PII in the banner
> - 5 action buttons: Mask & Send, Edit Prompt, Allow This Time, Always Allow, Dismiss (×)
> - Submit blocking: Critical/High blocks submit until user picks an action
> - Mask & Send: replace PII spans (reverse index order for overlaps) → update input → auto-submit
> - Edit Prompt: focus input, highlight PII spans inline
> - Allow This Time: submit as-is, suppress for session
> - Always Allow: add to allowlist (wire to storage, full implementation in Phase 5)
> - Keyboard accessibility: Tab through actions, Enter to select, Escape to dismiss
> - ARIA labels on all interactive elements
> - Emit events per EVENT_SCHEMA.md (pii_masked, pii_edit_requested, pii_allowed_once, warning_dismissed, submit_intercepted)
> 
> Update CHANGELOG.md.

### Exit Criteria
- [ ] Banner appears within 500ms of detection
- [ ] Color-coding matches severity correctly
- [ ] Multiple findings aggregated in one banner
- [ ] Submit blocked for Critical/High — cannot submit until action taken
- [ ] Medium/Low warnings are non-blocking
- [ ] "Mask & Send" replaces PII correctly and triggers submit
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] ARIA labels present on all interactive elements
- [ ] Shadow DOM isolates styles from platform CSS
- [ ] No false blocks on clean (non-PII) prompts
- [ ] All action events emitted correctly

---

## Phase 5: Settings + Allowlist

### Goal
Settings panel UI, category toggles, sensitivity slider, allowlist CRUD, chrome.storage.sync.

### Tag These Files
```
prd.md
SETTINGS_SPEC.md
EVENT_SCHEMA.md
CHANGELOG.md
```

### Prompt
> Implement Phase 5: Settings + Allowlist.
> 
> Follow SETTINGS_SPEC.md. Build:
> - Settings panel in popup with sections: Detection, Notifications, Privacy, About
> - Detection: per-category on/off toggles for all 11 PII types; sensitivity slider (Relaxed/Standard/Strict)
> - Notifications: submit blocking toggle (Critical/High), sound toggle
> - Privacy: analytics opt-in toggle, "Clear all local data" button with confirmation dialog
> - About: version, links
> - All settings persist via chrome.storage.sync — changes take effect immediately, no reload
> - Reset-to-defaults option with confirmation
> - Validate on read: handle corrupt storage gracefully → reset to defaults
> - Allowlist management panel: view, edit, delete individual entries
> - "Always Allow" from warning banner → adds exact match to allowlist
> - Manual entry of exact match or regex patterns in settings
> - Import/export allowlist as JSON
> - Max 100 entries with FIFO eviction
> - Warning when >20 entries suggesting review
> - Emit settings_changed events per EVENT_SCHEMA.md
> 
> Update CHANGELOG.md.

### Exit Criteria
- [ ] All settings sections render correctly
- [ ] Category toggles disable/enable specific PII detection in real-time
- [ ] Sensitivity slider changes detection behavior immediately
- [ ] Settings persist across sessions and devices (chrome.storage.sync)
- [ ] Allowlisted patterns never trigger warnings
- [ ] Allowlist import/export works (JSON)
- [ ] FIFO eviction at 100 entries
- [ ] Reset-to-defaults works with confirmation
- [ ] Corrupt storage handled gracefully
- [ ] settings_changed events emitted

---

## Phase 6: Dashboard + Event Aggregation

### Goal
New-tab dashboard page with 6 widgets, 4 filter dimensions, Chart.js, 30-day rolling storage.

### Tag These Files
```
prd.md
DASHBOARD_SPEC.md
EVENT_SCHEMA.md
PERFORMANCE.md
CHANGELOG.md
```

### Prompt
> Implement Phase 6: Dashboard + Event Aggregation.
> 
> Follow DASHBOARD_SPEC.md. Build:
> - New-tab dashboard page opened via chrome.tabs.create({ url: 'dashboard.html' })
> - Popup gets a compact status summary + "Open Full Dashboard" link
> - Minimum viewport: 800px wide × 600px tall, responsive for larger screens
> - 6 widgets:
>   1. Protection Summary (stat cards: total scanned, PII detected count, percentage)
>   2. Severity Breakdown (bar or donut chart: Critical/High/Medium/Low)
>   3. Top PII Categories (ranked list with percentage bars)
>   4. Intervention Outcomes (pie chart: Masked/Allowed/Edited/Allowlisted/Dismissed)
>   5. Trend Over Time (line chart: incidents per day, past 30 days)
>   6. History (scrollable paginated table: timestamp, platform, category, severity, action)
> - Use Chart.js for all charts
> - 4 filters (apply across all widgets simultaneously):
>   1. Time Range: Today, 7 days, 30 days, Custom date picker
>   2. Platform: All, ChatGPT only, Claude only
>   3. Severity: All, Critical only, High+, Medium+, Low+
>   4. Category: multi-select dropdown (Email, National ID, Credit Card/CCV, Phone, Employee Names, API Keys, SSN, Bank Account, Passwords, Other)
> - Event storage: chrome.storage.local, 30-day rolling retention with auto-prune
> - Dashboard aggregation: compute on demand from raw events
> - Performance: page load <2s, chart render <1s, filter response <500ms
> - Emit dashboard_viewed events per EVENT_SCHEMA.md
> 
> Update CHANGELOG.md.

### Exit Criteria
- [ ] Dashboard opens as new tab (not in popup)
- [ ] All 6 widgets render with correct data
- [ ] Charts display properly (Chart.js)
- [ ] All 4 filters work and apply across all widgets simultaneously
- [ ] 30-day auto-prune working
- [ ] Page loads <2s
- [ ] Filter response <500ms
- [ ] Data accuracy: spot-check 10+ events match between raw storage and dashboard
- [ ] Popup shows compact status + "Open Full Dashboard" link
- [ ] Empty state handled (no data yet → onboarding message)

---

## Phase 7: Hardening, Beta, Launch Readiness

### Goal
Automated regression, performance/security/accessibility audits, store-readiness artifacts.

### Tag These Files
```
prd.md
QA_TEST_PLAN.md
TEST_CASES.md
PERFORMANCE.md
SECURITY.md
THREAT_MODEL.md
PRIVACY_POLICY.md
RELEASE.md
CHANGELOG.md
```

### Prompt
> Implement Phase 7: Hardening, Beta, Launch Readiness.
> 
> Follow QA_TEST_PLAN.md, TEST_CASES.md, PERFORMANCE.md, SECURITY.md, and THREAT_MODEL.md. Build/verify:
> - Automated Playwright regression scripts for daily selector health checks on ChatGPT and Claude (input detection, submit interception, warning injection)
> - Performance profiling pass:
>   - Typing overhead <50ms
>   - Scan latency <100ms (2000 chars)
>   - Warning render <500ms
>   - Popup cold start <1s
>   - Dashboard load <2s
>   - Memory <20MB
> - Security audit:
>   - Zero external network calls from content scripts (verify with DevTools Network tab)
>   - No inline scripts, no eval(), no Function() constructors
>   - Shadow DOM isolation verified
>   - Storage validation on read
>   - CSP headers compliant
> - Accessibility audit:
>   - Keyboard navigation (Tab, Enter, Escape) on all interactive elements
>   - ARIA labels present and correct
>   - Color contrast WCAG AA (4.5:1)
>   - prefers-reduced-motion respected
>   - Focus trap in modals
> - Integration test suite covering all flows from QA_TEST_PLAN.md
> - Fix any critical/high bugs found during audits
> - Finalize PRIVACY_POLICY.md with real contact info
> - Finalize RELEASE.md with Chrome Web Store submission checklist
> - Prepare store assets: description, screenshots spec, category
> 
> Update CHANGELOG.md with all hardening changes.

### Exit Criteria
- [ ] Playwright regression scripts pass on both platforms
- [ ] All performance targets met
- [ ] Security audit: zero external network calls confirmed
- [ ] Accessibility audit: all WCAG AA requirements pass
- [ ] <5 open critical bugs
- [ ] All integration tests pass
- [ ] PRIVACY_POLICY.md finalized
- [ ] RELEASE.md checklist complete
- [ ] Chrome Web Store submission package ready

---

## Quick Reference: File Tag Cheat Sheet

| Phase | Always Tag | Phase-Specific Tags |
|-------|-----------|-------------------|
| **1 — Foundation** | `prd.md`, `CHANGELOG.md` | `ARCHITECTURE_PII.md` |
| **2 — Adapters** | `prd.md`, `CHANGELOG.md` | `ARCHITECTURE_PII.md`, `ADAPTER_SPEC.md` |
| **3 — PII Engine** | `prd.md`, `CHANGELOG.md` | `PII_RULEBOOK.md`, `EVENT_SCHEMA.md` |
| **4 — Warning UX** | `prd.md`, `CHANGELOG.md` | `ADAPTER_SPEC.md`, `ARCHITECTURE_PII.md`, `EVENT_SCHEMA.md` |
| **5 — Settings** | `prd.md`, `CHANGELOG.md` | `SETTINGS_SPEC.md`, `EVENT_SCHEMA.md` |
| **6 — Dashboard** | `prd.md`, `CHANGELOG.md` | `DASHBOARD_SPEC.md`, `EVENT_SCHEMA.md`, `PERFORMANCE.md` |
| **7 — Hardening** | `prd.md`, `CHANGELOG.md` | `QA_TEST_PLAN.md`, `TEST_CASES.md`, `PERFORMANCE.md`, `SECURITY.md`, `THREAT_MODEL.md`, `PRIVACY_POLICY.md`, `RELEASE.md` |

---

## Tips for Working with Codex

1. **One phase at a time.** Don't skip ahead. Verify exit criteria before starting the next phase.
2. **Tag only what's needed.** More files = more context noise. The cheat sheet above is optimized for signal.
3. **Always tag CHANGELOG.md.** Every phase should produce changelog entries.
4. **Review generated code before moving on.** Codex may produce plausible but incorrect implementations — especially for DOM selectors and regex patterns.
5. **If Codex asks clarifying questions,** reference the specific section of `prd.md` that answers it.
6. **If a phase fails exit criteria,** tell Codex what failed and ask it to fix specifically that. Don't re-prompt the entire phase.
7. **After Phase 3 (PII Engine),** manually test detection on real ChatGPT/Claude prompts before proceeding — this is the critical gate.

---

*End of REDACTR_BUILD_GUIDE.md*
