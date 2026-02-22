# PII Integration Debug Report

## Executive Summary
The integration gap is in the browser capture pipeline (DOM extraction, normalization, and timing) interacting with regex behavior, not in the core detection engine orchestration. Static code review plus targeted regex probes show the strongest root-cause candidate is `phoneRule` greedily consuming adjacent phone numbers as one candidate and then dropping it via the `digits.length > 15` guard. Confidence is High for H7 and Medium for capture/timing contributors (H1, H3, H4, H5, H6, H9, H10), with H8 low-confidence edge behavior.

## Pipeline Map
1. User typing/paste/mutations are captured by adapter hooks in `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts:onTextChanged`.
- Input path: `input` + `beforeinput` events queue a 300ms debounce.
- Paste path: `paste` emits immediately.
- DOM path: `MutationObserver` queues debounce on subtree changes.

2. Platform extraction occurs in:
- `/Users/silag/Desktop/REDACTR/src/content/adapters/chatgpt.ts:captureText`
- `/Users/silag/Desktop/REDACTR/src/content/adapters/claude.ts:captureText`
- Both contenteditable paths call `parseContentEditableHtml(input.innerHTML)`.

3. Content script orchestration in `/Users/silag/Desktop/REDACTR/src/content/index.ts:setupAdapter`:
- `rebindAdapterHooks` binds adapter listeners.
- `adapter.onTextChanged(...)` triggers `scanText(text)`.
- Initial scan also runs via `scanText(adapter.captureText())`.

4. Detection call path:
- `/Users/silag/Desktop/REDACTR/src/content/index.ts:scanText`
- `/Users/silag/Desktop/REDACTR/src/content/pii/engine.ts:detectPII`

5. Rule execution:
- `detectPII` -> `collectRawMatches` -> `detectInSegment` -> each rule.
- Phone rule at `/Users/silag/Desktop/REDACTR/src/content/pii/rules/phone.ts:phoneRule.detect`.

6. Result routing to warning UI:
- `/Users/silag/Desktop/REDACTR/src/content/intervention/controller.ts:onScanResult`
- Then `render()` -> panel update (`InterventionPanel`).

## Hypotheses
### H1: `captureText()` using wrong DOM property (`innerHTML` vs `innerText` vs `textContent`)
- File: `/Users/silag/Desktop/REDACTR/src/content/adapters/chatgpt.ts`, `/Users/silag/Desktop/REDACTR/src/content/adapters/claude.ts`
- Function: `captureText`, `parseContentEditableHtml`
- Why unit tests pass: adapter tests use simplified fixtures like `<div contenteditable="true">one<br>two</div>` and assert straightforward parsing.
- Why real DOM fails: production composer DOM can include wrappers, hidden nodes, and structural elements where `innerHTML`-based flattening differs from visible/semantic text.
- Confidence: Medium
- Diagnostic:
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('composer not found');
  const parse = (html) => {
    const withLB = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li|h[1-6])>/gi, '\n');
    const c = document.createElement('div');
    c.innerHTML = withLB;
    return (c.textContent || '').replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  };
  console.log({
    innerHTML: el.innerHTML,
    textContent: el.textContent,
    innerText: el.innerText,
    parsedFromInnerHTML: parse(el.innerHTML)
  });
})();
```
- Status: POSSIBLE

### H2: Invisible/non-standard characters injected by platform (`\u00A0`, `\u200B`, soft hyphen)
- File: `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts`
- Function: `normalizeCapturedText`
- Why unit tests pass: tests do not include zero-width chars, soft hyphen, or spacing anomalies.
- Why real DOM fails: normalization currently handles CRLF and NBSP but not zero-width/invisible separators that can disrupt regex tokenization.
- Confidence: Medium
- Diagnostic:
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('composer not found');
  const raw = (el.innerText || el.textContent || '');
  const chars = [...raw].map((ch, i) => ({ i, ch, cp: 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') }));
  console.table(chars.filter(x => /\d|\s|\u00A0|\u200B|\u200C|\u200D|\u2060|\u00AD/.test(x.ch)));
})();
```
- Status: POSSIBLE

### H3: Text fragmented across child nodes without spaces
- File: `/Users/silag/Desktop/REDACTR/src/content/adapters/chatgpt.ts`, `/Users/silag/Desktop/REDACTR/src/content/adapters/claude.ts`
- Function: `parseContentEditableHtml`
- Why unit tests pass: fixtures do not cover adjacent inline spans with no delimiter.
- Why real DOM fails: adjacent text nodes can flatten into concatenated digits (e.g., `...2671212...`) if no explicit whitespace exists.
- Confidence: Medium
- Diagnostic:
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('composer not found');
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n.textContent);
  console.log('textNodes', nodes);
  console.log('joined(no-sep)', nodes.join(''));
  console.log('joined(pipe)', nodes.join('|'));
})();
```
- Status: POSSIBLE

### H4: MutationObserver firing on intermediate/partial DOM states
- File: `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts`
- Function: `onTextChanged`
- Why unit tests pass: tests mutate once, then flush fake timers; no real editor multi-phase commit.
- Why real DOM fails: rich editors may emit multiple mutations per keystroke/paste; debounced capture can hit transient states.
- Confidence: Medium
- Diagnostic:
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('composer not found');
  const ts = () => Math.round(performance.now());
  const snap = (tag) => console.log(tag, ts(), (el.innerText || el.textContent || '').slice(0, 200));
  ['beforeinput','input','paste','keydown','keyup'].forEach(type => {
    el.addEventListener(type, () => snap(type), true);
  });
  const mo = new MutationObserver(() => snap('mutation'));
  mo.observe(el, { childList: true, subtree: true, characterData: true });
  console.log('observer armed');
})();
```
- Status: POSSIBLE

### H5: Debounce interval capturing incomplete text
- File: `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts`
- Function: `onTextChanged` (`DEBOUNCE_MS = 300`, immediate paste path)
- Why unit tests pass: fake timers and direct assignment create deterministic settled state.
- Why real DOM fails: 300ms may still be pre-settle in editor pipelines; immediate paste callback may fire before final DOM content.
- Confidence: Medium
- Diagnostic:
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('composer not found');
  const sample = () => (el.innerText || el.textContent || '').slice(0, 300);
  const logDelayed = (tag) => {
    console.log(tag, 't+0', sample());
    setTimeout(() => console.log(tag, 't+100', sample()), 100);
    setTimeout(() => console.log(tag, 't+300', sample()), 300);
    setTimeout(() => console.log(tag, 't+500', sample()), 500);
  };
  ['beforeinput','input','paste'].forEach(type => el.addEventListener(type, () => logDelayed(type), true));
  console.log('delay sampler armed');
})();
```
- Status: POSSIBLE

### H6: Regex patterns not accounting for spacing/separator variations
- File: `/Users/silag/Desktop/REDACTR/src/content/pii/rules/phone.ts`
- Function: `phoneRule.detect`
- Why unit tests pass: corpus focuses on canonical phone shapes; no multi-phone same-line/spacing-stress scenarios.
- Why real DOM fails: repeated spaces/tabs/mixed separators may produce unexpected grouping and filtering behavior.
- Confidence: Medium
- Diagnostic:
```js
(() => {
  const PHONE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/g;
  const samples = [
    '415-555-2671 212-555-1212',
    '415-555-2671, 212-555-1212',
    '415-555-2671\n212-555-1212',
    '415-555-2671\n\n212-555-1212',
    '415  555  2671',
    '415\t555\t2671'
  ];
  for (const s of samples) console.log(s, [...s.matchAll(PHONE)].map(m => m[0]));
})();
```
- Status: POSSIBLE

### H7: Same-line PII pairs hit greedy regex and get filtered
- File: `/Users/silag/Desktop/REDACTR/src/content/pii/rules/phone.ts`
- Function: `phoneRule.detect`
- Why unit tests pass: no same-line two-number case is asserted in `/Users/silag/Desktop/REDACTR/tests/pii/categories.test.ts`.
- Why real DOM fails: regex can capture `415-555-2671 212-555-1212` as one candidate; digits become 20 and fail `digits.length > 15` guard.
- Confidence: High
- Diagnostic:
```js
(() => {
  const PHONE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/g;
  const EXT = /\s*(?:ext\.?|x)\s*\d{1,5}$/i;
  const hasSep = v => /[\s().-]/.test(v);
  const input = '415-555-2671 212-555-1212';
  for (const m of input.matchAll(PHONE)) {
    const raw = m[0].trim();
    const value = raw.replace(EXT, '');
    const digits = value.replace(/\D/g, '');
    console.log({ raw, value, digits: digits.length, passLen: digits.length >= 10 && digits.length <= 15, passSep: value.startsWith('+') || hasSep(value) });
  }
})();
```
- Status: LIKELY

### H8: Text length/chunk boundaries cut patterns
- File: `/Users/silag/Desktop/REDACTR/src/content/pii/engine.ts`
- Function: `collectRawMatches`
- Why unit tests pass: long-input chunk path has one positive email scenario and passes.
- Why real DOM fails: only plausible on very long prompts (>10k) near chunk boundaries.
- Confidence: Low
- Diagnostic:
```js
(() => {
  const t = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  const s = t ? (t.innerText || t.textContent || '') : '';
  const threshold = 10000, chunk = 4000, overlap = 128;
  console.log({ len: s.length, chunkingActive: s.length > threshold });
  if (s.length > threshold) {
    for (let off = 0; off < s.length; off += chunk) {
      const start = Math.max(0, off - overlap);
      const end = Math.min(s.length, off + chunk + overlap);
      console.log({ off, start, end, segLen: end - start });
    }
  }
})();
```
- Status: UNLIKELY

### H9: Platform-injected HTML wrappers corrupt text extraction
- File: `/Users/silag/Desktop/REDACTR/src/content/adapters/chatgpt.ts`, `/Users/silag/Desktop/REDACTR/src/content/adapters/claude.ts`
- Function: `parseContentEditableHtml`
- Why unit tests pass: no production-level wrapper complexity in fixtures.
- Why real DOM fails: wrapper nodes/controls may shift block boundaries and alter flattening.
- Confidence: Medium
- Diagnostic:
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('composer not found');
  console.log('outerHTML(head):', el.outerHTML.slice(0, 4000));
  console.log('innerHTML(head):', el.innerHTML.slice(0, 4000));
})();
```
- Status: POSSIBLE

### H10: Claude contenteditable typed vs pasted behavior divergence
- File: `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts`, `/Users/silag/Desktop/REDACTR/src/content/adapters/claude.ts`
- Function: `onTextChanged` paste path + `captureText`
- Why unit tests pass: paste test sets textarea value before dispatching `paste`, which is not equivalent to browser/editor paste lifecycle.
- Why real DOM fails: immediate paste emit may capture stale pre-paste DOM in contenteditable editors.
- Confidence: Medium-Low
- Diagnostic:
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('Claude composer not found');
  const snap = (label) => console.log(label, JSON.stringify((el.innerText || el.textContent || '').slice(0, 240)));
  ['paste','beforeinput','input','keyup'].forEach(type => el.addEventListener(type, () => snap(type), true));
  const mo = new MutationObserver(() => snap('mutation'));
  mo.observe(el, { childList: true, subtree: true, characterData: true });
  console.log('type text, then paste same text; compare ordering + snapshots');
})();
```
- Status: POSSIBLE

## Ranked Fix List
| Rank | Hypothesis | File | Function | Confidence | Effort |
|---|---|---|---|---|---|
| 1 | H7 Greedy same-line pair | `/Users/silag/Desktop/REDACTR/src/content/pii/rules/phone.ts` | `phoneRule.detect` | High | Low-Med |
| 2 | H6 Separator/spacing variance | `/Users/silag/Desktop/REDACTR/src/content/pii/rules/phone.ts` | `phoneRule.detect` | Medium | Med |
| 3 | H3 Fragmented node collapse | `/Users/silag/Desktop/REDACTR/src/content/adapters/chatgpt.ts`, `/Users/silag/Desktop/REDACTR/src/content/adapters/claude.ts` | `parseContentEditableHtml` | Medium | Med |
| 4 | H1 Property/extraction strategy | same as H3 | `captureText` | Medium | Med |
| 5 | H4 Intermediate mutation state | `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts` | `onTextChanged` | Medium | Med |
| 6 | H5 Debounce timing mismatch | `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts` | `onTextChanged` | Medium | Low-Med |
| 7 | H9 Wrapper corruption | adapter files | `parseContentEditableHtml` | Medium | Med |
| 8 | H2 Invisible chars | `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts` | `normalizeCapturedText` | Medium | Low |
| 9 | H10 Typed vs pasted divergence | `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts` | `onTextChanged` | Medium-Low | Low-Med |
| 10 | H8 Chunk boundary | `/Users/silag/Desktop/REDACTR/src/content/pii/engine.ts` | `collectRawMatches` | Low | Low |

## Proposed Fixes (NO CODE YET)
### 1) Constrain phone matching to split adjacent numbers
- What needs to change: adjust `phoneRule` candidate strategy so adjacent phone numbers are emitted independently instead of one long candidate.
- Why this will not break unit tests: existing phone-positive cases remain valid; this targets an untested adjacency edge.
- New integration test: same-line `415-555-2671 212-555-1212` should produce two phone detections.

### 2) Add robust text pre-normalization for separators/invisible chars
- What needs to change: normalize zero-width and repeated separator variants before rule execution (or in phone-specific preprocessing).
- Why this will not break unit tests: canonical inputs are unchanged; normalization is additive for edge chars.
- New integration test: phone with zero-width joiners and irregular spacing still detects.

### 3) Replace naive contenteditable flattening with delimiter-aware extraction
- What needs to change: extract text from DOM structure with explicit block/inline boundary handling rather than only `innerHTML` textContent conversion.
- Why this will not break unit tests: current simple fixtures continue to pass; extraction becomes more faithful on complex DOM.
- New integration test: adjacent `<span>` nodes with and without literal spaces preserve intended token boundaries.

### 4) Emit scans from stable snapshots only
- What needs to change: introduce settle guard for mutation-heavy editors (e.g., re-sample after short micro-delay window before scan).
- Why this will not break unit tests: fake-timer debounce tests can be updated to include settle behavior deterministically.
- New integration test: typing burst in contenteditable should scan final consolidated text, not intermediate fragments.

### 5) Harmonize paste behavior with stable capture timing
- What needs to change: avoid immediate stale capture on `paste`; either queue to post-paste lifecycle or route through same stable debounce path.
- Why this will not break unit tests: behavior remains immediate enough from user perspective; tests should assert post-paste final content.
- New integration test: Claude typed-vs-pasted same payload yields equivalent detections.

### 6) Expand tests to real-world adapter + phone edge corpus
- What needs to change: add regression cases for same-line multi-phone, single newline, double newline, span fragmentation, invisible chars.
- Why this will not break unit tests: these are additive cases that harden existing behavior.
- New integration test: run adapter capture -> detection chain on synthetic contenteditable DOM mirroring platform wrappers.

## Diagnostics to Run in Browser
Use on both ChatGPT and Claude before any fix is applied.

### 1) Composer capture snapshot logger
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"], textarea#prompt-textarea');
  if (!el) return console.warn('composer not found');
  const parse = (html) => {
    const withLB = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li|h[1-6])>/gi, '\n');
    const c = document.createElement('div');
    c.innerHTML = withLB;
    return (c.textContent || '').replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  };
  const html = el.innerHTML || '';
  console.log({ innerHTML: html, innerText: el.innerText, textContent: el.textContent, parsed: parse(html) });
})();
```

### 2) Phone regex candidate inspector with filter reasons
```js
(() => {
  const PHONE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/g;
  const EXT = /\s*(?:ext\.?|x)\s*\d{1,5}$/i;
  const DATE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
  const hasSep = v => /[\s().-]/.test(v);
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"], textarea#prompt-textarea');
  if (!el) return console.warn('composer not found');
  const text = (el.innerText || el.textContent || '').trim();
  const out = [];
  for (const m of text.matchAll(PHONE)) {
    const raw = m[0].trim();
    const value = raw.replace(EXT, '');
    const digits = value.replace(/\D/g, '');
    out.push({
      raw,
      digitsLen: digits.length,
      passDate: !DATE.test(value),
      passLen: digits.length >= 10 && digits.length <= 15,
      passSep: value.startsWith('+') || hasSep(value)
    });
  }
  console.table(out);
})();
```

### 3) Event timing tracer (typed/paste/mutation)
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"], textarea#prompt-textarea');
  if (!el) return console.warn('composer not found');
  const now = () => Math.round(performance.now());
  const snap = () => (el.innerText || el.textContent || '').slice(0, 260);
  const log = (type) => {
    console.log(type, now(), 't+0', snap());
    setTimeout(() => console.log(type, now(), 't+100', snap()), 100);
    setTimeout(() => console.log(type, now(), 't+300', snap()), 300);
    setTimeout(() => console.log(type, now(), 't+500', snap()), 500);
  };
  ['beforeinput','input','paste','keydown','keyup'].forEach(t => el.addEventListener(t, () => log(t), true));
  const mo = new MutationObserver(() => log('mutation'));
  mo.observe(el, { childList: true, subtree: true, characterData: true });
  console.log('timing tracer armed');
})();
```

### 4) Invisible character scanner around numeric content
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"], textarea#prompt-textarea');
  if (!el) return console.warn('composer not found');
  const t = (el.innerText || el.textContent || '');
  const rows = [...t].map((ch, i) => ({ i, ch, cp: 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') }));
  console.table(rows.filter(r => /\d|\u00A0|\u200B|\u200C|\u200D|\u2060|\u00AD|\s/.test(r.ch)));
})();
```

### 5) Fragmentation inspector (text node boundaries)
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"]');
  if (!el) return console.warn('contenteditable composer not found');
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts = [];
  let n;
  while ((n = walker.nextNode())) parts.push(n.textContent);
  console.log('nodes', parts);
  console.log('joined-no-sep', parts.join(''));
  console.log('joined-pipe', parts.join('|'));
})();
```

### 6) Chunking guard
```js
(() => {
  const el = document.querySelector('div[contenteditable="true"], #prompt-textarea, [role="textbox"][contenteditable="true"], textarea#prompt-textarea');
  if (!el) return console.warn('composer not found');
  const captured = (el.innerText || el.textContent || '').trim();
  const threshold = 10000;
  const chunk = 4000;
  const overlap = 128;
  console.log({ capturedLength: captured.length, chunkingActive: captured.length > threshold });
  if (captured.length > threshold) {
    for (let offset = 0; offset < captured.length; offset += chunk) {
      const start = Math.max(0, offset - overlap);
      const end = Math.min(captured.length, offset + chunk + overlap);
      console.log({ offset, start, end, segmentLength: end - start });
    }
  }
})();
```

## Files Tagged for Fix
- `/Users/silag/Desktop/REDACTR/src/content/pii/rules/phone.ts`: likely root cause in candidate matching/filtering for adjacent phones.
- `/Users/silag/Desktop/REDACTR/src/content/adapters/base.ts`: normalization and event/debounce/paste timing behavior.
- `/Users/silag/Desktop/REDACTR/src/content/adapters/chatgpt.ts`: contenteditable extraction/parsing fidelity.
- `/Users/silag/Desktop/REDACTR/src/content/adapters/claude.ts`: contenteditable extraction/parsing fidelity.
- `/Users/silag/Desktop/REDACTR/src/content/index.ts`: scan trigger timing/rebind sequencing if diagnostics prove orchestration contribution.
- `/Users/silag/Desktop/REDACTR/tests/pii/categories.test.ts`: add same-line multi-phone and spacing edge regressions.
- `/Users/silag/Desktop/REDACTR/tests/adapters/hooks.test.ts`: add realistic contenteditable mutation/paste and fragmented-node cases.
- `/Users/silag/Desktop/REDACTR/tests/smoke.test.ts` (or new integration test files): replace scaffold with adapter->capture->detect integration scenarios.

## Test Cases and Scenarios
1. Two phones on same line with one space.
2. Two phones separated by comma.
3. Two phones separated by one newline.
4. Two phones separated by blank line (double newline).
5. Phones split across adjacent `<span>` nodes with and without explicit spaces.
6. Phone with zero-width character inserted mid-token.
7. Phone with double spaces/tabs between groups.
8. Claude typed vs pasted parity on identical content.
9. Long prompt (>10k chars) sanity check for chunk path.

## Assumptions and Defaults
1. This report is investigation-only; no source code changes were applied.
2. Unit tests currently emphasize clean string inputs and simplified DOM fixtures.
3. There are no committed browser-level integration/e2e scripts in this repo; `/Users/silag/Desktop/REDACTR/tests/smoke.test.ts` is currently scaffold-only.
4. Highest-confidence root cause is H7, with H1/H3/H4/H5/H6/H9/H10 as plausible contributors pending browser diagnostics.
