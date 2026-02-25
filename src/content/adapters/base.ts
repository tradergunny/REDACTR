import type {
  IconPlacementConfig,
  InputType,
  PlatformAdapter,
  PlatformId,
  Severity,
  TextRange
} from './types';

const DEBOUNCE_MS = 300;

export type SelectorResolver<T extends HTMLElement> = () => T | null;

const normalizeNewlines = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');

export const normalizeCapturedText = (text: string): string =>
  normalizeNewlines(text).replace(/\n{3,}/g, '\n\n').trim();

export const queryFirst = <T extends HTMLElement>(
  selectors: string[],
  root: ParentNode = document
): T | null => {
  for (const selector of selectors) {
    const match = root.querySelector<T>(selector);
    if (match) {
      return match;
    }
  }

  return null;
};

export const pickByFallback = <T extends HTMLElement>(
  resolvers: SelectorResolver<T>[]
): T | null => {
  for (const resolve of resolvers) {
    const result = resolve();
    if (result) {
      return result;
    }
  }

  return null;
};

export const isVisibleElement = (element: HTMLElement): boolean => {
  if (element.hasAttribute('hidden')) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

const isModifierEnter = (event: KeyboardEvent): boolean =>
  event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;

const clampRange = (
  range: TextRange,
  textLength: number
): { start: number; end: number } => {
  const boundedStart = Math.min(Math.max(range.startIndex, 0), textLength);
  const boundedEnd = Math.min(Math.max(range.endIndex, boundedStart), textLength);

  if (boundedEnd === boundedStart) {
    return {
      start: boundedStart,
      end: Math.min(textLength, boundedStart + 1)
    };
  }

  return {
    start: boundedStart,
    end: boundedEnd
  };
};

const getTextNodes = (root: Node): Text[] => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) {
      textNodes.push(current);
    }
    current = walker.nextNode();
  }

  return textNodes;
};

const selectContentEditableRange = (
  element: HTMLElement,
  range: TextRange
): void => {
  const text = element.textContent ?? '';
  if (!text.length) {
    element.focus();
    return;
  }

  const { start, end } = clampRange(range, text.length);
  const textNodes = getTextNodes(element);

  if (!textNodes.length) {
    element.focus();
    return;
  }

  let cursor = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;

  for (const node of textNodes) {
    const nodeText = node.textContent ?? '';
    const nodeEnd = cursor + nodeText.length;

    if (!startNode && start <= nodeEnd) {
      startNode = node;
      startOffset = Math.max(0, start - cursor);
    }

    if (!endNode && end <= nodeEnd) {
      endNode = node;
      endOffset = Math.max(0, end - cursor);
    }

    if (startNode && endNode) {
      break;
    }

    cursor = nodeEnd;
  }

  const fallbackNode = textNodes[textNodes.length - 1];
  if (!startNode) {
    startNode = fallbackNode;
    startOffset = (startNode.textContent ?? '').length;
  }

  if (!endNode) {
    endNode = fallbackNode;
    endOffset = (endNode.textContent ?? '').length;
  }

  const selection = window.getSelection();
  if (!selection) {
    element.focus();
    return;
  }

  const browserRange = document.createRange();
  browserRange.setStart(startNode, startOffset);
  browserRange.setEnd(endNode, endOffset);

  selection.removeAllRanges();
  selection.addRange(browserRange);
  element.focus();
};

export abstract class BasePlatformAdapter implements PlatformAdapter {
  readonly platformId: PlatformId;
  readonly platformName: string;
  readonly supportedUrls: RegExp[];

  private readonly disposers = new Set<() => void>();

  protected constructor(
    platformId: PlatformId,
    platformName: string,
    supportedUrls: RegExp[]
  ) {
    this.platformId = platformId;
    this.platformName = platformName;
    this.supportedUrls = supportedUrls;
  }

  abstract detectInputElement(): HTMLElement | null;

  abstract getInputType(): InputType;

  abstract captureText(): string;

  abstract getSubmitButton(): HTMLElement | null;

  protected registerDisposer(disposer: () => void): () => void {
    this.disposers.add(disposer);

    return (): void => {
      if (!this.disposers.has(disposer)) {
        return;
      }

      this.disposers.delete(disposer);
      disposer();
    };
  }

  onTextChanged(callback: (text: string) => void): () => void {
    const input = this.detectInputElement();

    if (!input) {
      return () => undefined;
    }

    let debounceHandle: number | undefined;

    const emit = (): void => {
      callback(this.captureText());
    };

    const queueEmit = (): void => {
      if (typeof debounceHandle !== 'undefined') {
        window.clearTimeout(debounceHandle);
      }

      debounceHandle = window.setTimeout(() => {
        emit();
      }, DEBOUNCE_MS);
    };

    const handleInputEvent = (): void => {
      queueEmit();
    };

    const handlePaste = (): void => {
      queueEmit();
    };

    input.addEventListener('input', handleInputEvent);
    input.addEventListener('beforeinput', handleInputEvent);
    input.addEventListener('paste', handlePaste);

    const observer = new MutationObserver(() => {
      queueEmit();
    });

    observer.observe(input, {
      characterData: true,
      childList: true,
      subtree: true
    });

    return this.registerDisposer((): void => {
      if (typeof debounceHandle !== 'undefined') {
        window.clearTimeout(debounceHandle);
      }

      observer.disconnect();
      input.removeEventListener('input', handleInputEvent);
      input.removeEventListener('beforeinput', handleInputEvent);
      input.removeEventListener('paste', handlePaste);
    });
  }

  onSubmitIntercept(callback: (event: Event) => boolean): () => void {
    const input = this.detectInputElement();
    const submitButton = this.getSubmitButton();

    if (!input || !submitButton) {
      return () => undefined;
    }

    const shouldBlock = (event: Event): boolean => {
      const callbackResult = callback(event);
      if (callbackResult !== false) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) {
        (event as Event & { stopImmediatePropagation: () => void }).stopImmediatePropagation();
      }

      return true;
    };

    const handleClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (submitButton === target || submitButton.contains(target)) {
        shouldBlock(event);
      }
    };

    const handleKeyDown = (event: Event): void => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }

      if (event.key !== 'Enter' || event.isComposing || isModifierEnter(event)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (target === input || input.contains(target)) {
        shouldBlock(event);
      }
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return this.registerDisposer((): void => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    });
  }

  getIconAnchor(): HTMLElement | null {
    return this.detectInputElement()?.parentElement ?? document.body;
  }

  getIconPlacement(): IconPlacementConfig {
    return {
      placement: 'inside-right',
      rightPx: 8,
      bottomPx: 8
    };
  }

  getInputAreaWrapper(): HTMLElement | null {
    return this.detectInputElement()?.parentElement ?? null;
  }

  renderInlineHighlight(range: TextRange, _severity: Severity): void {
    const input = this.detectInputElement();
    if (!input) {
      return;
    }

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const { start, end } = clampRange(range, input.value.length);
      input.focus();
      input.setSelectionRange(start, end);
      return;
    }

    selectContentEditableRange(input, range);
  }

  cleanup(): void {
    for (const disposer of [...this.disposers]) {
      this.disposers.delete(disposer);
      disposer();
    }
  }
}
