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
  onTextChanged(callback: (text: string) => void): () => void;
  getSubmitButton(): HTMLElement | null;
  onSubmitIntercept(callback: (event: Event) => boolean): () => void;
  getIconAnchor(): HTMLElement | null;           // Returns input area wrapper where icon is appended as sibling
  getInputAreaWrapper(): HTMLElement | null;      // Returns container for popover positioning reference
  cleanup(): void;
}
```

## Supported Platforms

| Platform | Input Element | Submit Button | Icon Anchor | Notes |
| --- | --- | --- | --- | --- |
| ChatGPT | `textarea#prompt-textarea` | `button[data-testid="send-button"]` | Parent container of `textarea#prompt-textarea` (form or div wrapper) | Textarea auto-resizes |
| Claude | `div[contenteditable="true"]` | `button[aria-label*="Send"]` | Parent container of `div[contenteditable="true"]` (composer wrapper) | Requires innerHTML parsing |

## Selector Resilience Strategy

- Primary: `data-testid` attributes
- Secondary: `aria-label` or role selectors
- Fallback: structural heuristics
- Monitoring: daily smoke tests with Playwright

## Icon Injection Strategy

- Find the input area's parent wrapper (the div containing the textarea/contenteditable + send button)
- Append the REDACTR icon as a last-child sibling OUTSIDE the input element but INSIDE the wrapper
- This keeps the icon adjacent to the input without injecting into volatile internal DOM
- Position icon bottom-right, outside the input wrapper (`right: -38px`, `bottom: 8px`)
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
- Immediate scan on paste
- onSubmitIntercept must return false to block

## Cleanup

- Disconnect MutationObserver
- Remove injected icon and popover panel
- Unsubscribe listeners
