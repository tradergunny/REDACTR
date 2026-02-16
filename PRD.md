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
- **Warning/Action UI**: Banner, highlights, modal confirm, and action buttons.
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
  getWarningAnchor(): HTMLElement | null;
  renderWarning(warning: WarningConfig): HTMLElement;
  renderInlineHighlight(range: TextRange, severity: Severity): void;
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
interface PIIEvent {
  event_id: string;        // UUID
  timestamp: string;       // ISO 8601
  event_type: 'pii_detected' | 'pii_masked' | 'pii_allowed_once' |
              'pii_allowlisted' | 'pii_edit_requested' | 'warning_dismissed';
  platform: 'chatgpt' | 'claude';
  category: PIICategory;
  severity: Severity;
  confidence: number;
  prompt_length: number;   // Character count only
  action_latency_ms: number;
  session_id: string;
}
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
- **UI**: Banner above input within 500ms, color by highest severity.
- **Edge cases**: Multiple same-category items; rapid re-detection (no flicker).
- **Acceptance**:
  - Visible without scrolling.
  - ARIA labels and keyboard navigation.
  - Shadow DOM isolation.

### FR-C: Redaction/Masking
- **Trigger**: User clicks "Mask & Send".
- **Behavior**: Replace detected PII with masks, update input, auto-submit.
- **Edge cases**: Overlapping detections; multi-line text.
- **Acceptance**:
  - Non-PII text preserved exactly.
  - Ctrl+Z restores original.

### FR-D: Submit Interception
- **Trigger**: Submit click or Enter with Critical/High detected.
- **Behavior**: Prevent submit, show action buttons, Enter opens confirm modal.
- **Edge cases**: Rapid submits (debounce 200ms); selector changes.
- **Acceptance**:
  - >=99% interception success.
  - No false blocks when no PII.
  - User can always override.

### FR-E: Allowlist Controls
- **Trigger**: "Always Allow" or Settings.
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
