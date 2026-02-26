# REDACTR — Phase-by-Phase Build Guide

**Purpose:** Step-by-step instructions for building REDACTR using Codex/Cursor. Each phase lists the exact files to tag as context, the prompt to give, and the exit criteria before moving on.

**Rule:** Always tag `CHANGELOG.md` in every phase — Codex should update it with each implementation step.

---

## Phase 1: Foundation & Extension Skeleton

### Goal
MV3 scaffold, dev environment, service worker, content script bootstrapping, popup with on/off toggle.

### Tag These Files
```
PRD.md
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
PRD.md
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
PRD.md
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
Floating toggle icon + popover panel with per-item redaction controls, severity summary, submit blocking for Critical/High. Replaces the old inline banner model with a non-intrusive widget pattern.

### Tag These Files
```
PRD.md
ADAPTER_SPEC.md
ARCHITECTURE_PII.md
EVENT_SCHEMA.md
CHANGELOG.md
```

### Prompt
> Implement Phase 4: Intervention UX & Submit Control.
> 
> **IMPORTANT: This phase uses a REDESIGNED UI model.** The old inline warning banner is replaced with a floating icon + popover panel. Read this entire prompt before coding.
> 
> **A) REDACTR Toggle Icon**
> - Inject a small shield icon (🛡 or SVG) OUTSIDE and to the RIGHT of the platform's input area
> - Find the input area's parent container via the adapter and append the icon as a sibling element — do NOT inject inside the textarea/contenteditable
> - Icon wrapped in Shadow DOM for style isolation
> - Icon states:
>   - **Idle (no PII):** Muted/subtle shield, low opacity (~0.4), no badge
>   - **PII detected:** Icon gets severity-colored glow/pulse + numeric badge showing detection count
>   - **Critical/High detected:** More aggressive pulse animation; submit is blocked
> - Icon click toggles the popover panel open/closed
> - Icon is always visible when extension is enabled on supported pages
> 
> **B) Popover Detection Panel**
> - Anchored to the icon, floating above/to-the-left (so it doesn't clip viewport right edge)
> - Dark theme: background #1A1A1E, border rgba(255,255,255,0.08)
> - Top colored glow line matching highest severity color
> - Panel sections (top to bottom):
>   1. **Header:** REDACTR branding + detection count + collapse (▾) + close (✕) buttons
>   2. **Severity summary pills:** Horizontal row of colored pill badges showing count per severity level (Critical=red #FF3B5C, High=orange #FF9F0A, Medium=yellow #FFD60A, Low=blue #6CB4EE). Only show pills for severities that have detections.
>   3. **Detection cards:** Scrollable list (max-height 360px), one card per detection. Each card contains:
>      - Category icon + label + severity badge + confidence percentage
>      - Raw detected value in monospace code block (background rgba(0,0,0,0.3))
>      - Redaction format selector: dropdown showing available mask formats for that category (e.g., for email: "[Email]", "a***@domain.com", "[REDACTED]"). Default to first option.
>      - Two action buttons per card: **"Redact"** (green, primary) and **"Ignore"** (muted, secondary)
>      - After action: card collapses to a resolved state showing "✓ Category → [mask]" (for redact) or "✕ Category — ignored" (strikethrough) with an "Undo" button
>   4. **Footer actions:** Sticky at bottom. Two buttons:
>      - **"Redact All (N)"** — primary green CTA, applies default redaction to all pending items
>      - **"Send Anyway"** — muted secondary button. For Critical/High: triggers a confirmation modal overlay ("Send with sensitive data? Your prompt contains critical-severity PII...") with "Go Back" (primary) and "Send Anyway" (destructive). For Medium/Low only: submits immediately.
>   5. **Trust line:** Small text at very bottom: "local-first · no data leaves your browser"
> - When all items are resolved: footer changes to **"Send Redacted"** (green, if any redactions applied) or **"Send Original"** (if all ignored), plus a "Reset" button
> - Panel dismisses on: close button click, clicking outside the panel, or Escape key
> 
> **C) Submit Interception Logic**
> - When PII detected at Critical or High severity: block the platform's submit button and Enter-key submission
> - Submit is blocked UNTIL the user opens the panel and resolves all Critical/High items (redact or ignore) — they must make an explicit choice
> - Medium/Low detections do NOT block submit — badge shows but user can submit freely
> - When submit is blocked: the platform's send button should appear visually disabled/dimmed. Clicking it should open the REDACTR panel automatically.
> - After user resolves items and clicks "Send Redacted" or "Send Original": apply any redactions to the input field text (process in reverse index order to preserve positions), then trigger the platform's native submit
> 
> **D) Adapter Changes**
> - Update the PlatformAdapter interface:
>   - RENAME `getWarningAnchor()` → `getIconAnchor(): HTMLElement | null` — returns the input area's parent/wrapper where the icon should be appended as a sibling
>   - ADD `getInputAreaWrapper(): HTMLElement | null` — returns the container to position the popover relative to
>   - REMOVE legacy `renderWarning` from active adapter guidance; panel components now own rendering
> - Update ChatGPT and Claude adapters with new anchor selectors
> 
> **E) Styling & Accessibility**
> - All UI in Shadow DOM — zero style bleed to/from platform
> - Dark theme throughout (matches v0 reference aesthetic)
> - Severity colors: Critical=#FF3B5C, High=#FF9F0A, Medium=#FFD60A, Low=#6CB4EE, Success=#34C759
> - Typography: system sans-serif for labels, monospace for values/code
> - Keyboard accessibility: Tab through all interactive elements, Enter to activate, Escape to close panel
> - ARIA labels on icon (role="button", aria-label="REDACTR: N items detected"), panel (role="dialog"), all buttons
> - Focus trap inside panel when open; return focus to icon on close
> - Respect `prefers-reduced-motion` (disable pulse animations)
> - Color contrast WCAG AA (4.5:1 minimum)
> 
> **F) Events (per EVENT_SCHEMA.md)**
> Emit these events:
> - `scan_completed` — on each debounced scan (existing from Phase 3)
> - `panel_opened` — when user clicks icon to open panel
> - `panel_closed` — when panel is dismissed (with reason: icon_click | outside_click | escape | close_button)
> - `pii_item_redacted` — per individual item redacted (with: category, severity, redaction_format)
> - `pii_item_ignored` — per individual item ignored (with: category, severity)
> - `pii_batch_redacted` — when "Redact All" clicked (with: item_count, categories[])
> - `submit_intercepted` — when blocked submit is attempted (with: severity, pending_count)
> - `submit_confirmed` — when user completes the flow and sends (with: redacted_count, ignored_count, total_detected)
> - `send_anyway_confirmed` — when user bypasses via "Send Anyway" confirmation (with: severity, item_count)
> - `warning_dismissed` — when panel is closed without taking action on pending items
> 
> Update CHANGELOG.md.

### Exit Criteria
- [ ] Shield icon appears outside the input field on both ChatGPT and Claude
- [ ] Icon shows muted state when no PII, severity-colored pulse + badge when PII detected
- [ ] Clicking icon toggles popover panel
- [ ] Panel shows severity summary pills with correct counts and colors
- [ ] Each detection renders as a card with category, raw value, redaction selector, Redact/Ignore buttons
- [ ] "Redact" resolves card to green confirmed state; "Ignore" shows strikethrough; both have Undo
- [ ] Redaction format dropdown shows category-appropriate options
- [ ] "Redact All" applies default redaction to all pending items
- [ ] Submit blocked for Critical/High — platform send button dimmed, clicking it opens panel
- [ ] Medium/Low do NOT block submit
- [ ] "Send Anyway" for Critical/High triggers confirmation modal; for Medium/Low submits directly
- [ ] "Send Redacted" applies all redactions to input text (reverse index order) then submits
- [ ] Panel dismisses on close, outside click, Escape
- [ ] Keyboard navigation works (Tab, Enter, Escape) with focus trap in panel
- [ ] ARIA labels present on icon, panel, all buttons
- [ ] Shadow DOM isolates all styles from platform CSS
- [ ] No false blocks on clean (non-PII) prompts
- [ ] All events emitted correctly per updated EVENT_SCHEMA.md
- [ ] Icon injection resilient — survives platform DOM rerenders

---

## Phase 5: Settings + Allowlist

### Goal
Settings panel UI, category toggles, sensitivity slider, allowlist CRUD, chrome.storage.sync.

### Tag These Files
```
PRD.md
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
>>- Allowlisting is ONLY available through the Settings panel (not from the detection panel). The detection panel's "Ignore" action is session-only — it does not persist. Users must go to Settings to add permanent allowlist entries.
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
PRD.md
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
>   4. Intervention Outcomes (pie chart: Redacted/Batch Redacted/Ignored/Send Anyway/Dismissed)
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
PRD.md
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
| **1 — Foundation** | `PRD.md`, `CHANGELOG.md` | `ARCHITECTURE_PII.md` |
| **2 — Adapters** | `PRD.md`, `CHANGELOG.md` | `ARCHITECTURE_PII.md`, `ADAPTER_SPEC.md` |
| **3 — PII Engine** | `PRD.md`, `CHANGELOG.md` | `PII_RULEBOOK.md`, `EVENT_SCHEMA.md` |
| **4 — Warning UX** | `PRD.md`, `CHANGELOG.md` | `ADAPTER_SPEC.md`, `ARCHITECTURE_PII.md`, `EVENT_SCHEMA.md` |
| **5 — Settings** | `PRD.md`, `CHANGELOG.md` | `SETTINGS_SPEC.md`, `EVENT_SCHEMA.md` |
| **6 — Dashboard** | `PRD.md`, `CHANGELOG.md` | `DASHBOARD_SPEC.md`, `EVENT_SCHEMA.md`, `PERFORMANCE.md` |
| **7 — Hardening** | `PRD.md`, `CHANGELOG.md` | `QA_TEST_PLAN.md`, `TEST_CASES.md`, `PERFORMANCE.md`, `SECURITY.md`, `THREAT_MODEL.md`, `PRIVACY_POLICY.md`, `RELEASE.md` |

---

## Tips for Working with Codex

1. **One phase at a time.** Don't skip ahead. Verify exit criteria before starting the next phase.
2. **Tag only what's needed.** More files = more context noise. The cheat sheet above is optimized for signal.
3. **Always tag CHANGELOG.md.** Every phase should produce changelog entries.
4. **Review generated code before moving on.** Codex may produce plausible but incorrect implementations — especially for DOM selectors and regex patterns.
5. **If Codex asks clarifying questions,** reference the specific section of `PRD.md` that answers it.
6. **If a phase fails exit criteria,** tell Codex what failed and ask it to fix specifically that. Don't re-prompt the entire phase.
7. **After Phase 3 (PII Engine),** manually test detection on real ChatGPT/Claude prompts before proceeding — this is the critical gate.

---

*End of REDACTR_BUILD_GUIDE.md*
