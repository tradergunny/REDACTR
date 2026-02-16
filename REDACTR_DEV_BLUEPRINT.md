# REDACTR — Developer Blueprint

**Version:** 2.0  
**Last Updated:** 2026-02-16  
**Purpose:** Full-stack development instruction guide for Cursor / Claude  
**Status:** Implementation-Ready  

---

## 0) Product Summary

REDACTR is a real-time PII protection layer for AI chatbots — a Chrome extension (Manifest V3) that detects and intervenes on sensitive data leakage before users submit prompts to ChatGPT and Claude.

**Core Value:** "Catches sensitive data before it leaves your browser — real-time, local-first, non-intrusive."

**Architecture Principle:** Everything runs locally in the browser. No backend, no external API calls. All PII detection is regex-based, all data stays in `chrome.storage`.

---

## 1) Scope — What to Build (MVP)

| Capability | Notes | Success Metric |
|------------|-------|----------------|
| Real-time prompt PII inspection | Content scripts + PII engine | Detection latency <100ms |
| PII severity classification (Critical/High/Medium/Low) | Risk prioritization | 95%+ precision on test corpus |
| Mask/redact suggestions | One-click replacement | 25%+ suggestion acceptance |
| Allowlist/whitelist rules | Reduce false positive fatigue | Override rate <15% |
| Pre-submit interception + confirmation | Block Critical/High until acknowledged | Intercept success rate 99%+ |
| Dashboard: PII incidents, trends, categories, outcomes | New-tab page, 800×600px | Loads <2s |
| Settings + policy controls | Category toggles, sensitivity slider | Settings persist across sessions |
| ChatGPT adapter | `chat.openai.com` | 99% injection success |
| Claude adapter | `claude.ai` | 99% injection success |

**Out of scope for MVP:** Google Docs adapter, prompt quality coaching, hallucination detection, AI-powered rewriting, SSO, team/admin dashboard, any backend server.

---

## 2) System Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CONTEXT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐    │
│  │  Content Script  │◄──►│ Platform Adapter  │◄──►│   Target Platform   │    │
│  │                  │    │  (ChatGPT/Claude) │    │   (chat.openai.com  │    │
│  │  - DOM Observer  │    │                   │    │    claude.ai)        │    │
│  │  - Text Capture  │    │  - detectInput()  │    │                     │    │
│  │  - UI Injection  │    │  - captureText()  │    └─────────────────────┘    │
│  └────────┬─────────┘    │  - onSubmit()     │                              │
│           │              │  - renderUI()     │                              │
│           │              └──────────────────-┘                              │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐                               │
│  │  PII Detection   │◄──►│  Warning/Action   │                              │
│  │     Engine       │    │    UI Layer       │                              │
│  │                  │    │                   │                              │
│  │  - Regex rules   │    │  - Banners        │                              │
│  │  - Severity      │    │  - Highlights     │                              │
│  │  - Masking       │    │  - Modals         │                              │
│  └────────┬─────────┘    └──────────────────-┘                              │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Service Worker   │◄──────────────────────────────────────────────────────┤
│  │                  │                                                        │
│  │  - Message hub   │    ┌──────────────────┐    ┌─────────────────────┐    │
│  │  - State mgmt    │◄──►│  Local Storage    │    │  Analytics Pipeline │    │
│  │  - Analytics     │    │  (chrome.storage) │    │  (Plausible/custom) │    │
│  └─────────────────-┘    └──────────────────-┘    └─────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| Content Script | DOM observation, text interception, UI injection | TypeScript, MutationObserver |
| Platform Adapter | Platform-specific DOM selectors, submit interception | TypeScript (interface-driven) |
| PII Detection Engine | Pattern matching, severity scoring, masking | TypeScript, Regex, Luhn algorithm |
| Warning/Action UI | Visual feedback, user interaction handling | Shadow DOM, CSS-in-JS |
| Service Worker | Cross-tab state, analytics dispatch, settings sync | Manifest V3 service worker |
| Local Storage | Settings, allowlists, event buffer | chrome.storage.sync/local |
| Analytics Pipeline | Privacy-preserving telemetry | Plausible or custom events |

### 2.3 Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*"
  ],
  "content_scripts": [{
    "matches": [
      "https://chat.openai.com/*",
      "https://chatgpt.com/*",
      "https://claude.ai/*"
    ],
    "js": ["content.js"]
  }]
}
```

**Permission Rationale:**
- `storage` — Settings persistence
- `activeTab` — Minimal; only active tab access
- No `<all_urls>`, no `webRequest` — limited to target platforms only

---

## 3) Platform Adapter Contract

### 3.1 Interface

```typescript
interface PlatformAdapter {
  readonly platformId: 'chatgpt' | 'claude';
  readonly platformName: string;
  readonly supportedUrls: RegExp[];

  detectInputElement(): HTMLElement | null;
  getInputType(): 'textarea' | 'contenteditable' | 'input';
  captureText(): string;
  onTextChanged(callback: (text: string) => void): () => void; // returns cleanup fn
  getSubmitButton(): HTMLElement | null;
  onSubmitIntercept(callback: (event: Event) => boolean): () => void; // return false to prevent
  getWarningAnchor(): HTMLElement | null;
  renderWarning(warning: WarningConfig): HTMLElement;
  renderInlineHighlight(range: TextRange, severity: Severity): void;
  cleanup(): void;
}
```

### 3.2 Platform-Specific Selectors

| Platform | Input Element | Submit Button | Notes |
|----------|---------------|---------------|-------|
| ChatGPT | `textarea#prompt-textarea` | `button[data-testid="send-button"]` | Textarea auto-resizes; monitor height changes |
| Claude | `div[contenteditable="true"]` | `button[aria-label*="Send"]` | ContentEditable requires innerHTML parsing |

### 3.3 Selector Resilience Strategy

1. **Primary:** `data-testid` attributes (most stable)
2. **Fallback:** `aria-labels`, structural position
3. **Emergency:** Closest matching element via heuristics
4. **Monitoring:** Daily smoke tests (Playwright scripts) to detect DOM changes

---

## 4) PII Detection Engine

### 4.1 PII Taxonomy & Severity

| Category | Examples | Severity | Detection Approach |
|----------|----------|----------|--------------------|
| Credit Card Numbers | 16-digit Visa, MC, Amex | Critical | Regex + Luhn validation |
| Bank Accounts | Account numbers, routing numbers | Critical | Pattern + context keywords |
| SSN | XXX-XX-XXXX | Critical | Simple pattern |
| API Keys | AWS (`AKIA...`), Stripe (`sk_live_`), OpenAI (`sk-...`) | Critical | Prefix detection |
| Passwords | `password:`, `pwd=` contexts | High | Context-aware keyword match |
| Passport Numbers | Country-specific formats | High | Multiple patterns |
| National ID | Thai ID, etc. | High | Country-specific patterns |
| Email Addresses | Standard email format | Medium | RFC 5322 subset regex |
| Phone Numbers | International formats | Medium | libphonenumber-style patterns |
| Employee Names | "My name is X", "Patient: X", "Employee: X" | Medium | Context + capitalization heuristics |
| Street Addresses | Physical addresses | Low | Named entity hints |

### 4.2 Detection Result Interface

```typescript
interface DetectionResult {
  text: string;           // Matched text
  category: PIICategory;  // Enum of categories above
  severity: Severity;     // Critical | High | Medium | Low
  confidence: number;     // 0.0–1.0
  startIndex: number;     // Position in original text
  endIndex: number;
  suggestedMask: string;  // e.g., "j***@email.com"
  rule: string;           // Rule ID for debugging
}
```

### 4.3 Severity Behavior Matrix

| Severity | Color | User Experience | Auto-action |
|----------|-------|-----------------|-------------|
| Critical | Red | Banner, submit blocked until acknowledged | Pre-check "mask" option |
| High | Orange | Banner, submit requires confirmation | Show mask suggestion |
| Medium | Yellow | Non-blocking banner | Show mask option |
| Low | Blue | Info badge | Log only |

### 4.4 Masking Logic

```typescript
function generateMask(text: string, category: PIICategory): string {
  switch (category) {
    case 'email':
      const [local, domain] = text.split('@');
      return `${local[0]}***@${domain}`;
    case 'phone':
      return text.replace(/\d(?=\d{4})/g, '*');
    case 'ssn':
      return `***-**-${text.slice(-4)}`;
    case 'credit_card':
      return `****-****-****-${text.slice(-4)}`;
    case 'api_key':
      return `${text.slice(0, 8)}****`;
    default:
      return '[REDACTED]';
  }
}
```

### 4.5 False Positive Mitigation

| Issue | Mitigation |
|-------|------------|
| Over-detection | Allowlist system; "Don't warn again for this pattern" |
| Code snippets flagged | Detect code block context (backticks, `<code>` tags); reduce severity |
| Missed PII | Start conservative (higher sensitivity); tune from feedback |
| Partial matches | Require context confirmation; flag as "possible" with lower confidence |

### 4.6 Performance Targets

| Metric | Target |
|--------|--------|
| Analysis latency (≤2000 chars) | <100ms (p95) |
| Typing overhead | <50ms per keystroke |
| Memory footprint | <20MB |
| Debounce interval | 300ms (immediate on paste) |

---

## 5) Intervention UX

### 5.1 Pre-submit Interception Flow

```
User types prompt
       │
       ▼
  Text captured (debounced 300ms)
       │
       ▼
  PII Detection Engine analyzes
       │
       ├─── No PII found ───► Normal submission allowed
       │
       └─── PII detected
               │
               ▼
        Show warning banner
               │
               ├─── Severity: Critical/High
               │         │
               │         ▼
               │    Block submit until user action:
               │    [Mask & Send] [Edit Prompt] [Send Anyway]
               │
               └─── Severity: Medium/Low
                         │
                         ▼
                    Non-blocking warning:
                    User can submit immediately
                    Banner shows suggestion
```

### 5.2 Warning Banner Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️  REDACTR detected sensitive data                    [×]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔴 Credit Card Number (Critical)                                │
│     "4532-xxxx-xxxx-1234"                                        │
│                                                                  │
│  🟠 Email Address (Medium)                                       │
│     "john.doe@company.com"                                       │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Mask & Send]  [Edit Prompt]  [Allow This Time]  [Always Allow] │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 User Actions

| Action | Behavior | Analytics Event |
|--------|----------|-----------------|
| Mask & Send | Replace PII with masked version, auto-submit | `pii_masked` |
| Edit Prompt | Focus input, highlight PII locations | `pii_edit_requested` |
| Allow This Time | Submit with PII, suppress for this session | `pii_allowed_once` |
| Always Allow | Add pattern to allowlist permanently | `pii_allowlisted` |
| Dismiss (×) | Close banner, no action | `warning_dismissed` |

### 5.4 Anti-Fatigue Design

| Problem | Solution |
|---------|----------|
| Warning fatigue | Aggregate multiple findings in single banner |
| Repeated false positives | One-click allowlist; "Don't warn for this pattern" |
| Disrupting workflow | Non-blocking for Medium/Low; keyboard shortcuts |
| Learning curve | Progressive disclosure; minimal first-run onboarding |

**Safe Defaults:**
- Extension enabled by default
- All PII categories enabled
- Submit blocking ON for Critical/High (user can disable)
- Analytics opt-in (privacy-first)

---

## 6) Dashboard Specification

### 6.1 Layout & Sizing

**IMPORTANT:** The dashboard opens as a **new tab page** (not in the popup). Chrome extension popup max is 800×600px and is too cramped for charts. The dashboard should be a full new-tab page that is responsive but designed for a minimum viewport of **800px wide × 600px tall**.

- Popup: simple status overview + link to "Open Full Dashboard" in new tab
- Dashboard page: `chrome.tabs.create({ url: 'dashboard.html' })`

### 6.2 Core Widgets

| Widget | Description | Data Source |
|--------|-------------|-------------|
| **Protection Summary** | Total prompts scanned, count with PII detected, percentage with PII | Aggregated `scan_completed` events |
| **Severity Breakdown Chart** | Bar or donut chart: Critical / High / Medium / Low counts | `pii_detected` events, grouped by `severity` |
| **Top PII Categories** | Ranked list with percentages, e.g. Emails 45%, API Keys 20%, Bank Accounts 15%, Phone Numbers 10%, Names 5%, Other 5% | `category` field from detection events |
| **Intervention Outcomes** | Pie chart: Masked / Allowed Once / Edited / Allowlisted / Dismissed | `pii_masked`, `pii_allowed_once`, `pii_edit_requested`, `pii_allowlisted`, `warning_dismissed` |
| **Trend Over Time** | Line chart showing incidents per day for past 30 days | Time-series aggregation of `pii_detected` events |
| **History (Recent Incidents)** | Scrollable table: timestamp, platform, category, severity, action taken | Last 50–100 events, paginated |

### 6.3 Filter Dimensions

| Filter | Options | Implementation |
|--------|---------|----------------|
| **Time Range** | Today, 7 days, 30 days, Custom date range | Date filter on `timestamp` |
| **Platform** | All, ChatGPT only, Claude only | `platform` field filter |
| **Severity** | All, Critical only, High+, Medium+, etc. | `severity` field filter |
| **Category** | Multi-select dropdown: Email, National ID, Credit Card / CCV, Phone Number, Employee Names, API Keys, SSN, Bank Account, Passwords, Other | `category` field filter |

**Future Enhancement (v1.1+):** Policy-based filtering — upload a company employee list document to auto-detect employee names as PII. This would add a "Policies" settings section where admins upload a CSV/JSON of employee names that feed into the PII detection engine as a custom name dictionary.

### 6.4 Event Schema

```typescript
interface PIIEvent {
  event_id: string;        // UUID
  timestamp: string;       // ISO 8601
  event_type: 'pii_detected' | 'pii_masked' | 'pii_allowed_once' | 
              'pii_allowlisted' | 'pii_edit_requested' | 'warning_dismissed';
  platform: 'chatgpt' | 'claude';
  category: PIICategory;
  severity: Severity;
  confidence: number;
  prompt_length: number;   // Character count (NOT content)
  action_latency_ms: number; // Time from warning shown to user action
  session_id: string;
}
```

**Privacy Rule:** NEVER store actual PII text or prompt content. Only metadata.

### 6.5 Data Freshness & Storage

| Data Type | Freshness | Storage |
|-----------|-----------|---------|
| Real-time counters | <1s | In-memory (service worker) |
| Dashboard aggregates | <5min | `chrome.storage.local`, computed on demand |
| Trend data | Daily rollup | `chrome.storage.local` (30-day rolling retention) |

### 6.6 Dashboard Performance

| Metric | Target |
|--------|--------|
| Page load | <2s |
| Chart render | <1s after data load |
| Filter response | <500ms |

Use a lightweight chart library (Chart.js recommended — small bundle, good defaults).

---

## 7) Functional Requirements

### FR-A: Real-time PII Scanning

| Field | Specification |
|-------|---------------|
| Trigger | Text change in input field (debounced 300ms); immediate on paste |
| Inputs | Current input text |
| Outputs | Array of `DetectionResult` objects |
| Edge Cases | Empty input (skip), very long input (>10K chars: chunk processing) |
| Acceptance Criteria | Detection <100ms for ≤2000 chars; handles textarea and contenteditable; works when input is dynamically replaced |

### FR-B: Severity-based Warning Presentation

| Field | Specification |
|-------|---------------|
| Trigger | PII engine returns ≥1 result |
| UI | Banner above input within 500ms; color-coded by highest severity; shows masked preview per item; dismissable |
| Edge Cases | Multiple same-category items (group them); rapid re-detection (don't flash banner) |
| Acceptance Criteria | Visible without scrolling; ARIA labels + keyboard nav; Shadow DOM isolation |

### FR-C: Redaction/Masking

| Field | Specification |
|-------|---------------|
| Trigger | User clicks "Mask & Send" |
| Behavior | Replace PII with masks → update input field programmatically → auto-submit |
| Edge Cases | Overlapping detections (process in reverse index order to preserve positions) |
| Acceptance Criteria | Non-PII text preserved exactly; works multi-line; Ctrl+Z restores original |

### FR-D: Submit Interception

| Field | Specification |
|-------|---------------|
| Trigger | Submit click or Enter key while Critical/High PII detected |
| Behavior | Prevent event; show action buttons prominently; Enter opens confirmation modal |
| Edge Cases | Rapid submit clicks (debounce 200ms); platform changes submit mechanism |
| Acceptance Criteria | 99%+ interception success; no false blocks on non-PII submissions; user can always override |

### FR-E: Allowlist Controls

| Field | Specification |
|-------|---------------|
| Trigger | "Always Allow" button or Settings panel |
| Storage | `chrome.storage.sync` (syncs across devices) |
| Limits | Cap at 100 entries (FIFO eviction) |
| Acceptance Criteria | Allowlisted patterns never trigger warnings; import/export as JSON; viewable/editable in Settings |

### FR-F: Dashboard

See Section 6 above for full specification.

### FR-G: Settings Panel

| Field | Specification |
|-------|---------------|
| Sections | Detection, Notifications, Privacy, About |
| Detection | Category toggles (on/off per PII type), sensitivity slider (Relaxed / Standard / Strict) |
| Notifications | Submit blocking toggle, sound toggle |
| Privacy | Analytics opt-in toggle, "Clear all local data" button |
| Acceptance Criteria | Persists via `chrome.storage.sync`; changes take effect immediately (no reload); reset-to-defaults option with confirmation dialog |

---

## 8) Non-Functional Requirements

### 8.1 Performance

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Typing overhead | <50ms per keystroke | `Performance.now()` delta |
| PII scan latency (≤2000 chars) | <100ms | 95th percentile benchmark |
| Warning render | <500ms from detection | User-perceived timing |
| Popup load | <1s cold start | Lighthouse |
| Dashboard render | <2s | Chart library init + data |

### 8.2 Reliability

| Metric | Target |
|--------|--------|
| Extension crash rate | <0.1% of sessions |
| Detection availability | 99.9% (when extension active) |
| Submit interception success | 99%+ |
| Data sync reliability | 99% (`chrome.storage.sync`) |

### 8.3 Security & Privacy

| Requirement | Implementation |
|-------------|----------------|
| No PII transmission | All detection local; events contain metadata only |
| Analytics opt-in | Disabled by default; explicit user consent |
| Storage encryption | Chrome's encrypted storage (`chrome.storage.local`) |
| Content isolation | Shadow DOM for all injected UI |
| CSP compliance | No inline scripts; no `eval()` |

### 8.4 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | All actions via Tab + Enter |
| Screen reader | ARIA labels on all interactive elements |
| Color contrast | WCAG AA (4.5:1 minimum) |
| Reduced motion | Respect `prefers-reduced-motion` |
| Focus management | Trap focus in modal; return focus after dismiss |

### 8.5 Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 120+ | Full (primary) |
| Edge | 120+ | Full (Chromium) |
| Firefox | — | Future (v1.1+) |

---

## 9) Privacy & Data Handling

### 9.1 Data Flow Rules

| Data Type | Processed | Stored | Transmitted |
|-----------|-----------|--------|-------------|
| Prompt text | ✓ (in-memory only) | ✗ Never | ✗ Never |
| Detected PII | Analyzed, masked | ✗ Never | ✗ Never |
| Event metadata | Generated | ✓ Local only | ✓ Only if analytics opt-in |
| Settings | — | ✓ `chrome.storage.sync` | Via Chrome sync |
| Allowlist | — | ✓ `chrome.storage.sync` | Via Chrome sync |

### 9.2 Retention

| Data | Retention |
|------|-----------|
| Settings | Indefinite (user-controlled) |
| Event log | 30 days rolling; user can clear manually |
| Allowlist | Indefinite (user-controlled, max 100 entries) |

### 9.3 Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Prompt exfiltration | High | No external network calls; strict CSP |
| DOM manipulation by platform | Medium | Selector resilience + fallback strategies |
| Storage leak via XSS | Medium | Shadow DOM isolation; no user content in storage |
| Extension compromise (supply chain) | High | Signed releases; dependency audits; `npm` lockfile |

---

## 10) Metrics & Telemetry

### 10.1 Event Types

All events are stored locally. Only aggregate/anonymous metrics are sent externally if user opts in.

| Event | Fields | Purpose |
|-------|--------|---------|
| `scan_completed` | platform, char_count, pii_found (bool), latency_ms | Usage tracking |
| `warning_shown` | severity, category_count, platform | Warning effectiveness |
| `pii_masked` | categories_masked, original_char_count | Masking adoption |
| `pii_allowed_once` | category, severity | Override tracking |
| `pii_allowlisted` | category, is_regex | Allowlist growth |
| `pii_edit_requested` | category, severity | Edit behavior |
| `warning_dismissed` | severity, time_visible_ms | Fatigue indicator |
| `submit_intercepted` | severity, action_taken | Interception effectiveness |
| `dashboard_viewed` | filters_applied | Dashboard engagement |
| `settings_changed` | setting_key, old_value, new_value | Settings adoption |

### 10.2 Key Quality Signals

| Signal | Formula | Red Flag If |
|--------|---------|-------------|
| False Positive Rate | allowlist_events / total_warnings × 100 | >15% |
| Override Rate | allow_once / total_warnings | >20% |
| Warning Fatigue | dismissed_in_<2s / total_warnings | >50% |
| Prevention Rate | (masked + edited) / (critical + high warnings) | <50% |

---

## 11) Build Order & Dependency Graph

### 11.1 Critical Path

```
Week 1–4: Foundation
    │
    ▼
Week 5–6: Platform Adapters (ChatGPT + Claude)
    │
    ▼
Week 7–8: PII Detection Engine  ◄── CRITICAL GATE
    │
    ▼
Week 9–10: Warning UI + Submit Interception
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
Week 11–12: Settings / Allowlist      Week 13–14: Dashboard
    │                                          │
    └──────────────┬───────────────────────────┘
                   ▼
             Week 15–16: Beta + Polish
```

### 11.2 Sprint Breakdown

**Sprint 1–2 (Weeks 1–4): Foundation**
- Study Manifest V3 architecture
- Analyze ChatGPT/Claude DOM structures → document selectors
- Set up Vite + TypeScript + CRXJS dev environment
- Configure ESLint, Prettier, Vitest
- Exit: Extension loads in Chrome dev mode; sample test passes

**Sprint 3–4 (Weeks 5–6): Core Architecture**
- Implement `manifest.json` (minimal permissions)
- Content script infrastructure (loads on target URLs)
- Platform adapter: ChatGPT
- Platform adapter: Claude
- Popup UI (on/off toggle + status)
- Service worker with message passing
- Exit: "REDACTR Active" banner visible on both platforms; popup toggles on/off

**Sprint 5–6 (Weeks 7–8): PII Detection Engine**
- Regex patterns: email, phone, SSN, CC, API keys, bank accounts, national IDs, employee names
- Luhn algorithm for CC validation
- Severity classification system
- Debounced text capture + paste handler
- Unit tests (100+ test cases)
- Exit: ≥95% precision on test corpus; <100ms analysis latency

**Sprint 7–8 (Weeks 9–10): Warning UI & Interception**
- Shadow DOM UI injection for warning banners
- Severity-based color coding
- Submit interception for Critical/High
- "Mask & Send" functionality
- All user action handlers
- Exit: Warnings appear <500ms; submit blocked for Critical/High; masking works

**Sprint 9–10 (Weeks 11–12): Settings & Allowlist**
- Settings UI (Detection, Notifications, Privacy, About sections)
- Category toggles + sensitivity slider
- Allowlist management (add, view, edit, delete, import/export JSON)
- `chrome.storage.sync` integration
- Exit: Settings persist across sessions/devices; allowlisted patterns excluded

**Sprint 11–12 (Weeks 13–14): Dashboard**
- Event schema implementation + local event storage (30-day rolling)
- Dashboard as new-tab page (800×600px minimum)
- Core widgets: Protection Summary, Severity Chart, Top Categories, Intervention Outcomes, Trend Line, History Table
- Filter controls: time range, platform, severity, category
- Chart.js integration
- Exit: Dashboard loads <2s; all widgets render; data accuracy verified

**Sprint 13–14 (Weeks 15–16): Polish & Beta**
- Bug triage and fixes
- Performance optimization (profiling pass)
- Privacy policy draft
- Chrome Web Store listing assets
- Beta testing with 20+ users
- Exit: <5 critical bugs; performance targets met; 20+ beta users active

### 11.3 Parallelizable Work

| Stream A (Core Engineering) | Stream B (Can Run in Parallel) |
|-----------------------------|-------------------------------|
| Platform adapters | UI/UX mockups and design |
| PII engine | Privacy policy draft |
| Warning UI | Chrome Web Store listing prep |
| Submit interception | Test corpus creation |

### 11.4 Unblockers

| Blocked Task | Requires |
|--------------|----------|
| Warning UI | PII engine complete (needs detection results) |
| Dashboard | Event schema defined |
| Beta testing | Warning UI + Settings complete |
| Chrome Store submission | Privacy policy approved |

---

## 12) Test Strategy

### 12.1 Unit Tests

| Module | Test Cases | Pass Threshold |
|--------|------------|----------------|
| Email regex | Valid, invalid, edge cases (100+ cases) | 100% |
| Phone regex | US, international formats (50+ cases) | 95% |
| SSN regex | Valid, invalid, partial (30 cases) | 100% |
| CC regex + Luhn | Valid cards, invalid, test numbers (50 cases) | 100% |
| API key patterns | AWS, GCP, OpenAI, Stripe, generic (40 cases) | 95% |
| National ID patterns | Thai ID, passport formats (20 cases) | 95% |
| Employee name detection | Context-based name extraction (30 cases) | 85% |
| Severity scoring | All category combinations (20 cases) | 100% |
| Masking functions | All categories (15 cases) | 100% |

### 12.2 Integration Tests

| Test | Pass Threshold |
|------|----------------|
| Content script → Adapter (loads on ChatGPT, loads on Claude) | 100% |
| Adapter → PII engine (text capture triggers detection) | 100% |
| PII engine → Warning UI (detection renders warning) | 100% |
| Warning UI → Submit intercept (Critical blocks submit) | 100% |
| Settings → Storage (sync persistence) | 100% |
| Events → Dashboard (events render in widgets) | 100% |

### 12.3 Platform Regression (Daily Automated)

Run Playwright scripts daily checking selector validity on ChatGPT and Claude for: input detection, submit interception, warning injection.

### 12.4 Performance Benchmarks

| Test | Threshold | Tool |
|------|-----------|------|
| Keystroke overhead | <50ms | `Performance.now()` |
| 2000 char scan | <100ms | Benchmark suite |
| Warning render | <500ms | Lighthouse |
| Popup cold start | <1s | Lighthouse |
| Memory footprint | <20MB | Chrome DevTools |

### 12.5 Security Tests

| Test | Expected Defense |
|------|------------------|
| XSS via prompt input | Shadow DOM isolation |
| Storage tampering | Validation on read |
| Network sniffing (analytics) | HTTPS only |

---

## 13) Risk Register (Engineering Risks)

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | High false positive rate | High | High | Tune patterns; add context detection; code block awareness |
| 2 | ChatGPT DOM changes break selectors | High | High | Adapter abstraction; 3+ fallback selectors; daily smoke tests |
| 3 | Claude DOM changes break selectors | Medium | High | Same adapter pattern; daily smoke tests |
| 4 | Warning fatigue (users dismiss everything) | Medium | High | Aggregated banners; severity tuning; allowlist UX |
| 5 | Performance degradation on long prompts | Low | High | Chunked processing for >10K chars; profiling sprints |
| 6 | Chrome Web Store rejection | Low | Critical | Pre-submission review; minimal permissions; no `<all_urls>` |
| 7 | Manifest V3 API limitations | Low | Medium | Research alternative approaches early |
| 8 | PII pattern gaps (non-US formats) | Medium | Medium | Start with US formats; i18n patterns in v1.1 |
| 9 | Shadow DOM style leakage | Low | Low | CSS isolation audit; scoped styles |
| 10 | Storage quota exceeded | Low | Low | 30-day event pruning; cap allowlist at 100 entries |
| 11 | Claude contenteditable unreliable | Medium | High | POC testing in Sprint 1; alternative capture methods |
| 12 | Dependency vulnerabilities | Low | Medium | `npm audit`; lockfile; automated scanning |

---

## 14) Decision Log (Technical Decisions)

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Detection approach | (A) Pure regex, (B) Regex + ML, (C) Cloud API | **(A) Pure regex** | MVP timeline; 95%+ achievable for structured PII; ML adds latency/complexity |
| Data storage | (A) Local-only, (B) Cloud + cache, (C) Hybrid | **(A) Local-only** | Maximum privacy; no backend needed; sufficient for individual use |
| Warning behavior | (A) Hard block, (B) Soft warning, (C) Silent log | **(B) Soft warning** | User autonomy; reduces friction; hard blocks cause workarounds |
| Submit intercept | (A) Always confirm, (B) Severity-based, (C) Never block | **(B) Severity-based** | Block Critical/High for safety; don't disrupt Medium/Low |
| Dashboard location | (A) In popup, (B) New tab, (C) Sidebar | **(B) New tab** | 800×600 minimum space for charts; popup too cramped |
| Platform priority | (A) ChatGPT first, (B) Claude first, (C) Both | **(C) Both simultaneously** | Adapter abstraction enables parallel dev |
| Chart library | (A) Chart.js, (B) D3, (C) Recharts, (D) Custom SVG | **(A) Chart.js** | Small bundle; good defaults; no framework dependency |

---

## 15) Implementation Artifacts to Generate

| Filename | Purpose | Priority |
|----------|---------|----------|
| `ARCHITECTURE_PII.md` | Deep-dive: code structure, module boundaries, data flow diagrams | P0 |
| `ADAPTER_SPEC.md` | Platform-specific adapter implementations, all selectors, fallback strategies | P0 |
| `PII_RULEBOOK.md` | Complete regex patterns, test cases, severity mappings, masking rules | P0 |
| `DASHBOARD_SPEC.md` | Wireframes, component specs, chart configs, responsive layout for 800×600 | P1 |
| `QA_TEST_PLAN.md` | Full test suites, automation scripts, regression checklists | P1 |
| `EVENT_SCHEMA.md` | Complete event schemas, storage queries, aggregation logic | P1 |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **PII** | Personally Identifiable Information — data that can identify an individual |
| **Adapter** | Platform-specific module abstracting DOM interactions |
| **Allowlist** | User-defined patterns excluded from PII detection |
| **Shadow DOM** | Encapsulated DOM subtrees isolating REDACTR UI from platform CSS |
| **Manifest V3** | Chrome extension platform (2023+) with service workers and declarative APIs |
| **Luhn Algorithm** | Checksum formula for validating credit card numbers |
| **Contenteditable** | HTML attribute for rich text editing in divs (used by Claude) |
| **Debounce** | Limits function execution frequency; prevents scan on every keystroke |
| **Service Worker** | MV3 background script replacing persistent background pages |
| **CSP** | Content Security Policy — browser security mechanism |
| **CRXJS** | Vite plugin for Chrome extension development |

---

## Appendix B: Reference Links

**Chrome Extension Development:**
- Manifest V3: https://developer.chrome.com/docs/extensions/mv3/intro/
- Content Scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Storage API: https://developer.chrome.com/docs/extensions/reference/storage/
- Web Store Policies: https://developer.chrome.com/docs/webstore/program-policies/

**PII Detection:**
- OWASP Input Validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- Luhn Algorithm: https://en.wikipedia.org/wiki/Luhn_algorithm

**Web Standards:**
- Shadow DOM: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM
- MutationObserver: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/

---

*End of REDACTR_DEV_BLUEPRINT.md v2.0*
