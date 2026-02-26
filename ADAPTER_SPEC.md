# Platform Adapter Spec

## Interface
```typescript
interface PlatformAdapter {
  readonly platformId: 'chatgpt' | 'claude';
  readonly platformName: string;
  readonly supportedUrls: RegExp[];

  detectInputElement(): HTMLElement | null;
  getInputType(): 'textarea' | 'contenteditable' | 'input';
  captureText(): string;
  setText(nextText: string): void;
  applyTextReplacements(baseText: string, replacements: TextReplacement[]): boolean;
  onTextChanged(callback: (text: string) => void): () => void;
  getSubmitButton(): HTMLElement | null;
  onSubmitIntercept(callback: (event: Event) => boolean): () => void;
  getIconAnchor(): HTMLElement | null;
  getIconPlacement(): IconPlacementConfig;
  getInputAreaWrapper(): HTMLElement | null;
  renderInlineHighlight(range: TextRange, severity: Severity): void;
  cleanup(): void;
}
```

## Supported Platforms

| Platform | Input Element | Submit Button | Icon Anchor | Notes |
| --- | --- | --- | --- | --- |
| ChatGPT | `div#prompt-textarea[contenteditable="true"]` or `textarea#prompt-textarea` | `button[data-testid="send-button"]` (with fallbacks) | Composer wrapper near the active input | Supports both contenteditable and textarea composers |
| Claude | `div[contenteditable="true"]` | `button[data-testid*="send"]` / `button[aria-label*="Send"]` | Composer wrapper near the active input | Uses contenteditable text-node extraction and range-safe replacements |

## Selector Resilience Strategy

- Primary: `data-testid` attributes
- Secondary: `aria-label` or role selectors
- Fallback: structural heuristics
- Monitoring: daily smoke tests with Playwright

## Icon Injection Strategy

- Find the input area's parent wrapper (the div containing the textarea/contenteditable + send button)
- Append the REDACTR icon as a last-child sibling OUTSIDE the input element but INSIDE the wrapper
- This keeps the icon adjacent to the input without injecting into volatile internal DOM
- Default placement is inside-right (`right: 8px`, `bottom: 8px`) via `getIconPlacement()`
- If overlapping known platform floating controls, nudge icon by ~40px
  - ChatGPT: scroll/jump affordances
  - Claude: attachment overlay controls
- Icon is wrapped in Shadow DOM for style isolation

## Popover Positioning

- Anchor popover to the icon element
- Prefer floating below-left of the icon; flip above icon when viewport space is insufficient below
- Ensure panel doesn't clip viewport edges (right and top/bottom constraints)
- Panel dismisses on: close button, outside click, Escape key

## Event Hooks

- onTextChanged must debounce at 300ms
- Paste/input events feed the same debounced scan pipeline
- onSubmitIntercept must return false to block

## Cleanup

- Disconnect MutationObserver
- Remove injected icon and popover panel
- Unsubscribe listeners
