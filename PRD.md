# REDACTR Technical PRD (MVP)

**Version:** 1.0  
**Date:** 2026-02-16

## 1) Technical Scope (MVP Only)

**In scope**
- Real-time prompt PII inspection in ChatGPT and Claude.
- PII severity classification: Critical / High / Medium / Low.
- Mask/redact suggestions with one-click replacement.
- Allowlist rules to reduce false positives.
- Pre-submit interception and confirmation for Critical/High.
- Dashboard (new-tab) with incident trends and outcomes.
- Settings and policy controls with persistent storage.
- Local-only analytics pipeline (opt-in for external telemetry).

**Out of scope**
- Google Docs adapter.
- Prompt coaching, hallucination detection, or AI rewriting.
- SSO, team/admin dashboards, or backend services.
- Any cloud processing of prompts or PII.

## 2) System Overview

**High-level architecture**
- Browser-only Chrome extension (Manifest V3).
- Content script captures input, injects UI, and delegates to platform adapters.
- PII engine runs locally and synchronously with debounced input.
- Service worker manages settings, state, and event aggregation.
- Local storage via `chrome.storage` (sync/local) for settings and events.

**Component responsibilities**
- **Content Script**: DOM observation, text capture, UI injection, input/submit hooks.
- **Platform Adapter**: Platform-specific selectors, input detection, submit interception, and rendering anchors.
- **PII Detection Engine**: Regex rules, severity scoring, masking suggestions, and confidence scoring.
- **Warning/Action UI**: Floating shield icon + popover detection panel, per-item redaction controls, submit blocking, confirmation modal.
- **Service Worker**: Message hub, state coordination, settings sync, event buffer.
- **Local Storage**: Persist settings, allowlist, and event logs.

**Manifest V3 constraints**
- Minimal permissions: `storage`, `activeTab`.
- Host permissions limited to `chat.openai.com`, `chatgpt.com`, `claude.ai`.
- Content scripts only on supported URLs.
- No `webRequest` or `<all_urls>`.

## 3) Key Interfaces & Data Structures

### Platform Adapter
```typescript
interface PlatformAdapter {
  readonly platformId: 'chatgpt' | 'claude';
  readonly platformName: string;
  readonly supportedUrls: RegExp[];

  detectInputElement(): HTMLElement | null;
  getInputType(): 'textarea' | 'contenteditable' | 'input';
  captureText(): string;
  onTextChanged(callback: (text: string) => void): () => void;
  getSubmitButton(): HTMLElement | null;
  onSubmitIntercept(callback: (event: Event) => boolean): () => void;
  getIconAnchor(): HTMLElement | null;           // Input area wrapper where icon is appended as sibling
  getInputAreaWrapper(): HTMLElement | null;      // Container for popover positioning reference
  cleanup(): void;
}
```

### Detection Result
```typescript
interface DetectionResult {
  text: string;
  category: PIICategory;
  severity: Severity;
  confidence: number;     // 0.0–1.0
  startIndex: number;
  endIndex: number;
  suggestedMask: string;
  rule: string;           // Rule ID for debugging
}
```

### Event Schema
```typescript
// See EVENT_SCHEMA.md for full event interfaces.
// Summary of event types:
type EventType =
  | 'scan_completed'
  | 'panel_opened' | 'panel_closed'
  | 'pii_item_redacted' | 'pii_item_ignored' | 'pii_batch_redacted'
  | 'submit_intercepted' | 'submit_confirmed' | 'send_anyway_confirmed'
  | 'warning_dismissed'
  | 'settings_changed' | 'pattern_allowlisted'
  | 'dashboard_viewed';
```

## 4) Functional Requirements

### FR-A: Real-time PII Scanning
- **Trigger**: Text change (debounced 300ms); immediate on paste.
- **Input**: Current input text.
- **Output**: Array of `DetectionResult`.
- **Edge cases**: Empty input; very long input (>10K chars uses chunking).
- **Acceptance**:
  - <100ms analysis for <=2000 chars (p95).
  - Works for `textarea` and `contenteditable`.
  - Survives dynamic input replacement.

### FR-B: Severity-based Warning Presentation
- **Trigger**: >=1 detection result.
- **UI**: Shield icon outside input field activates with severity-colored glow + badge count. Clicking icon opens popover panel with severity summary pills and per-item detection cards.
- **Edge cases**: Multiple same-category items (separate cards); rapid re-detection updates cards in place while panel remains open.
- **Acceptance**:
  - Icon visible adjacent to input field on both platforms.
  - Panel uses dark theme, Shadow DOM isolated.
  - ARIA labels and keyboard navigation.
  - Focus trap in panel when open.

### FR-C: Redaction/Masking
- **Trigger**: User clicks "Redact" on individual detection card, or "Redact All" in panel footer.
- **Behavior**: Per-item redaction with selectable format (dropdown per card). Batch "Redact All" applies severity-driven defaults (Critical/High => token, Medium/Low => partial mask). "Send Redacted" applies all redactions to input text (reverse index order) then triggers platform submit.
- **Edge cases**: Overlapping detections (reverse index processing); user changes format after redacting (undo then re-pick); multi-line text; re-scan persistence only for exact `category + text` matches.
- **Acceptance**:
  - Non-PII text preserved exactly.
  - Category-appropriate redaction format options available.
  - Ctrl+Z restores original in input field.
  - Undo available on each resolved card in panel.

### FR-D: Submit Interception
- **Trigger**: Submit click or Enter with Critical/High PII detected and unresolved.
- **Behavior**: Block submit, dim platform send button, clicking blocked send auto-opens REDACTR panel. User must resolve all Critical/High items (Redact or Ignore). "Send Anyway" for Critical/High uses confirmation modal and submits pending items as original text while keeping already-applied redactions. Medium/Low never block submit.
- **Edge cases**: Rapid submits (debounce 200ms); user closes panel without resolving (submit stays blocked); platform changes submit mechanism; per-prompt decisions clear on submit or empty input.
- **Acceptance**:
  - >=99% interception success.
  - No false blocks when no PII.
  - User can always override via Send Anyway → confirmation.
  - Dimmed send button provides clear visual feedback.

### FR-E: Allowlist Controls
- **Trigger**: Settings panel only (allowlisting is not available from the detection panel; "Ignore" in the panel is session-only).
- **Storage**: `chrome.storage.sync`.
- **Limits**: Cap 100 entries (FIFO eviction).
- **Acceptance**:
  - Allowlisted patterns never trigger warnings.
  - Import/export JSON supported.
  - View/edit in Settings.

### FR-F: Dashboard
- **Location**: New-tab page (min 800x600px).
- **Widgets**: Summary, severity chart, top categories, outcomes, trend line, history table.
- **Filters**: Time range, platform, severity, category.
- **Acceptance**:
  - Loads <2s.
  - Chart render <1s after data load.
  - Filter response <500ms.

### FR-G: Settings Panel
- **Sections**: Detection, Notifications, Privacy, About.
- **Controls**: Category toggles, sensitivity slider, submit blocking toggle, analytics opt-in, clear data, reset defaults.
- **Acceptance**:
  - Persists via `chrome.storage.sync`.
  - Changes take effect immediately without reload.

## 5) Non-Functional Requirements

**Performance**
- Typing overhead <50ms per keystroke.
- Scan latency <100ms for <=2000 chars (p95).
- Warning render <500ms from detection.
- Popup load <1s cold start.
- Dashboard render <2s.

**Reliability**
- Extension crash rate <0.1% of sessions.
- Detection availability 99.9% while active.
- Submit interception success >=99%.
- Sync reliability 99% for settings.

**Security & Privacy**
- No PII transmission; prompt text never stored.
- Analytics opt-in only.
- Storage uses Chrome encrypted storage.
- UI isolated via Shadow DOM.
- CSP compliant (no inline scripts, no eval).

**Accessibility**
- Keyboard navigation for all actions.
- ARIA labels for interactive elements.
- WCAG AA contrast (>=4.5:1).
- Respects `prefers-reduced-motion`.
- Focus management for modals.

**Compatibility**
- Chrome 120+ and Edge 120+.

## 6) Data & Privacy

**Data flow rules**
- Prompt text processed in-memory only.
- No PII content stored or transmitted.
- Metadata events stored locally; external telemetry only if opt-in.

**Retention**
- Settings: indefinite, user controlled.
- Event log: rolling 30 days, user can clear.
- Allowlist: indefinite, max 100 entries.

**Analytics**
- External telemetry disabled by default.
- Explicit user consent required to enable.

## 7) Test Strategy

**Unit tests**
- Regex validity for email, phone, SSN, CC + Luhn, API keys, national IDs.
- Severity scoring for all categories.
- Masking functions for all categories.

**Integration tests**
- Content script loads on ChatGPT and Claude.
- Adapter captures input and triggers detection.
- Detection results render warning UI.
- Critical/High blocks submit.
- Settings persist via storage.
- Dashboard widgets reflect event data.

**Regression & performance**
- Daily Playwright selector checks for ChatGPT/Claude.
- Benchmark: <=2000 chars scan <100ms.
- Warning render <500ms.
- Memory footprint <20MB.

## 8) Risks & Mitigations

- **High false positives**: Allowlist + code-block detection + tuning.
- **Platform DOM changes**: Adapter fallback selectors + daily smoke tests.
- **Claude contenteditable instability**: Early POC + alternative capture methods.
- **Warning fatigue**: Aggregate banners, severity tuning.
- **Performance on long prompts**: Chunked processing >10K chars.
- **Storage quotas**: 30-day pruning, allowlist cap.

## 9) Open Technical Questions

- Best heuristic for detecting code blocks in `contenteditable` rich text.
- Strategy for reliable submit interception if platforms change to non-standard submit flows.
- Event aggregation granularity for dashboard (real-time vs. on-demand).

## 10) Appendix

**Glossary (technical)**
- **PII**: Personally Identifiable Information.
- **Adapter**: Platform-specific DOM abstraction layer.
- **Allowlist**: User-defined exclusions from detection.
- **Shadow DOM**: Encapsulated DOM subtree for UI isolation.
- **Manifest V3**: Chrome extension platform using service workers.
- **Luhn Algorithm**: Credit card checksum validation.
- **Contenteditable**: Rich text editing attribute used by Claude.
- **Debounce**: Limits function execution frequency.
- **CSP**: Content Security Policy.

**References**
- Chrome MV3: https://developer.chrome.com/docs/extensions/mv3/intro/
- Content Scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Storage API: https://developer.chrome.com/docs/extensions/reference/storage/
- Web Store Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Shadow DOM: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM
- MutationObserver: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
