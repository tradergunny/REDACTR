# Soft Capsule — Inline PII Highlight Design Spec

**Style:** Soft Capsule  
**Context:** REDACTR Phase 4 — Inline PII highlighting inside ChatGPT and Claude prompt input fields  
**Aesthetic:** Premium, privacy-first, enterprise-grade (Stripe/Linear/Notion tier — not browser validation errors)

---

## Core Concept

Detected PII text is wrapped in a rounded pill with a tinted background, subtle border, and a small leading icon. It communicates "this is protected" — not "you made an error." Think Linear tags, Stripe metadata badges.

---

## Critical Technical Constraint

**You cannot inject HTML inside a `<textarea>` (ChatGPT) or directly modify a `contenteditable` DOM managed by ProseMirror (Claude).**

The solution is an **overlay div** strategy:
- A transparent `<div>` is positioned exactly on top of the input element
- The overlay mirrors the input's text content and font metrics (family, size, line-height, padding, letter-spacing, scroll position)
- All text in the overlay is `color: transparent` — EXCEPT PII spans, which render as Soft Capsule pills
- The overlay has `pointer-events: none` so the real input stays fully interactive
- Scroll and resize are synced via listeners (scroll event + ResizeObserver)
- The overlay lives inside a Shadow DOM container to avoid style bleed

This approach works identically for both platforms.

---

## Visual Treatment

| Property | Value |
|----------|-------|
| Shape | Rounded pill (`border-radius: 100px`) |
| Background | Severity color at 7-8% opacity |
| Border | 1px solid, severity color at 20-25% opacity |
| Leading icon | Inline SVG, 12px, severity-specific shield variant |
| Padding | `1px 12px 1px 8px` (extra left for icon) |
| Margin | `0 2px` horizontal |
| Font | Inherits from input (do not change font-family) |
| Transition | `all 0.25s cubic-bezier(0.16, 1, 0.3, 1)` |

---

## Severity Color Palette

Trust-first, desaturated — avoids pure red/yellow/green error conventions.

### Critical — Deep Indigo
```
Base:         #6366F1
Surface:      rgba(99, 102, 241, 0.08)
Border:       rgba(99, 102, 241, 0.25)
Border-hover: rgba(99, 102, 241, 0.40)
Surface-hover:rgba(99, 102, 241, 0.12)
Glow:         rgba(99, 102, 241, 0.15)
Icon:         shield-alert (filled)
```

### High — Muted Plum
```
Base:         #9D7BEA
Surface:      rgba(157, 123, 234, 0.08)
Border:       rgba(157, 123, 234, 0.20)
Border-hover: rgba(157, 123, 234, 0.35)
Surface-hover:rgba(157, 123, 234, 0.12)
Glow:         rgba(157, 123, 234, 0.12)
Icon:         shield (filled)
```

### Medium — Teal
```
Base:         #3DADA8
Surface:      rgba(61, 173, 168, 0.07)
Border:       rgba(61, 173, 168, 0.20)
Border-hover: rgba(61, 173, 168, 0.35)
Surface-hover:rgba(61, 173, 168, 0.10)
Glow:         rgba(61, 173, 168, 0.10)
Icon:         shield-outline
```

### Low — Cool Slate
```
Base:         #64748B
Surface:      rgba(100, 116, 139, 0.07)
Border:       rgba(100, 116, 139, 0.20)
Border-hover: rgba(100, 116, 139, 0.30)
Surface-hover:rgba(100, 116, 139, 0.10)
Glow:         rgba(100, 116, 139, 0.08)
Icon:         info-circle-outline
```

---

## Hover State

| Property | Change |
|----------|--------|
| Background | Opacity increases from 7-8% → 12% |
| Border | Opacity increases from 20-25% → 35-40% |
| Transform | `translateY(-1px)` — pill lifts slightly |
| Box-shadow | `0 4px 12px rgba(0, 0, 0, 0.2)` |
| Tooltip | Appears above pill after 100ms delay |

---

## Tooltip

Appears above the capsule pill on hover/focus.

### Content
```
┌─────────────────────────────────────┐
│  ● Credit Card  CRITICAL            │
│─────────────────────────────────────│
│  ⌘M to mask · Tab to skip          │
└─────────────────────────────────────┘
         ▼ (arrow pointing to pill)
```

### Specs
| Property | Value |
|----------|-------|
| Background | Elevated surface color (dark: `#222639`) |
| Border | `1px solid rgba(255, 255, 255, 0.1)` |
| Border-radius | `10px` |
| Padding | `10px 14px` |
| Shadow | `0 8px 32px rgba(0, 0, 0, 0.4)` |
| Severity dot | 7px circle, severity base color |
| Category name | 12px, weight 600 |
| Severity label | 10px monospace, uppercase, letter-spacing 0.06em |
| Action hint | 11px, muted color, top border separator |
| Enter animation | 200ms spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`), 100ms delay |
| Arrow | 5px CSS triangle pointing down |
| Dismiss | Escape key or mouse leave |

---

## Animations

### Highlight Appearance (on PII detection)
- Fade-in: 300ms, `opacity: 0 → 1`
- Subtle scale: `1.00 → 1.02 → 1.00` with `cubic-bezier(0.16, 1, 0.3, 1)`
- Staggered if multiple: 50ms delay between each

### Highlight Removal (PII cleared)
- Fade-out: 200ms, `opacity: 1 → 0`

### prefers-reduced-motion
- All transforms disabled
- Opacity transitions become instant (10ms)
- No scale or translateY animations

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| No color-only indication | Shape (pill) + icon + position all indicate PII |
| Keyboard focus | Each pill: `tabindex="0"` |
| ARIA | `aria-label="Detected: {category}, {severity} severity"` |
| Tooltip on focus | Show tooltip on `:focus-visible`, not just hover |
| Dismiss tooltip | Escape key |
| Screen reader | Tooltip has `role="tooltip"`, linked via `aria-describedby` |
| Contrast | All text on tinted backgrounds must meet WCAG AA (4.5:1) |
| Motion | Respect `prefers-reduced-motion` — see above |

---

## Inline SVG Icons (no external dependencies)

### shield-alert (Critical)
```svg
<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1.5 3v3c0 2.5 1.9 4.4 4.5 5 2.6-.6 4.5-2.5 4.5-5V3L6 1z" fill="currentColor" opacity="0.9"/><path d="M6 4v2.5M6 8h.005" stroke="white" stroke-width="1.2" stroke-linecap="round"/></svg>
```

### shield (High)
```svg
<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1.5 3v3c0 2.5 1.9 4.4 4.5 5 2.6-.6 4.5-2.5 4.5-5V3L6 1z" fill="currentColor" opacity="0.7"/><path d="M4.5 6l1 1 2-2" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

### shield-outline (Medium)
```svg
<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1.5 3v3c0 2.5 1.9 4.4 4.5 5 2.6-.6 4.5-2.5 4.5-5V3L6 1z" stroke="currentColor" stroke-width="1" opacity="0.7"/></svg>
```

### info-circle (Low)
```svg
<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1" opacity="0.6"/><path d="M6 5.5V8M6 4h.005" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
```

---

## File Structure (expected output)

```
src/ui/
  highlight-overlay.ts    — Overlay div creation, positioning, font mirroring, scroll/resize sync
  soft-capsule.ts         — Capsule pill rendering, tooltip, hover/focus handlers
  severity-theme.ts       — Color maps, icon SVGs, CSS custom properties per severity
  highlight-overlay.css   — Styles (or CSS-in-JS injected into Shadow DOM)
```

---

## Integration Points

- **Input:** `DetectionResult[]` from PII detection engine (has `startIndex`, `endIndex`, `severity`, `category`, `suggestedMask`)
- **Adapter:** Uses `detectInputElement()`, `getInputType()`, `captureText()` from PlatformAdapter
- **Lifecycle:** Created when content script mounts, destroyed on `adapter.cleanup()`
- **Debounce:** Shares the same 300ms debounce as PII detection; paste triggers immediate re-render
