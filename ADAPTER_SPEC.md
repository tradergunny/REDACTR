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
  getWarningAnchor(): HTMLElement | null;
  renderWarning(warning: WarningConfig): HTMLElement;
  renderInlineHighlight(range: TextRange, severity: Severity): void;
  cleanup(): void;
}
```

## Supported Platforms

| Platform | Input Element | Submit Button | Notes |
| --- | --- | --- | --- |
| ChatGPT | `textarea#prompt-textarea` | `button[data-testid="send-button"]` | Textarea auto-resizes |
| Claude | `div[contenteditable="true"]` | `button[aria-label*="Send"]` | Requires innerHTML parsing |

## Selector Resilience Strategy

- Primary: `data-testid` attributes
- Secondary: `aria-label` or role selectors
- Fallback: structural heuristics
- Monitoring: daily smoke tests with Playwright

## Event Hooks

- onTextChanged must debounce at 300ms
- Immediate scan on paste
- onSubmitIntercept must return false to block

## Cleanup

- Disconnect MutationObserver
- Remove injected UI root
- Unsubscribe listeners
