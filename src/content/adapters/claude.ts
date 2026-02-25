import {
  BasePlatformAdapter,
  isVisibleElement,
  normalizeCapturedText,
  pickByFallback,
  queryFirst
} from './base';
import type { IconPlacementConfig } from './types';

const CLAUDE_URLS = [/^https:\/\/claude\.ai\//i];

const CLAUDE_INPUT_PRIMARY = [
  'div[contenteditable="true"][data-testid*="composer" i]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]'
];

const CLAUDE_INPUT_SECONDARY = [
  '[role="textbox"][contenteditable="true"]',
  'div[aria-label*="Message" i][contenteditable="true"]',
  'div[aria-label*="Prompt" i][contenteditable="true"]'
];

const CLAUDE_BUTTON_PRIMARY = [
  'button[data-testid*="send" i]',
  'button[data-testid*="submit" i]'
];

const CLAUDE_BUTTON_SECONDARY = [
  'button[aria-label*="Send" i]',
  'button[aria-label*="send message" i]'
];

const parseContentEditableHtml = (html: string): string => {
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n');

  const container = document.createElement('div');
  container.innerHTML = withLineBreaks;

  return normalizeCapturedText(container.textContent ?? '');
};

const pickHeuristicEditable = (): HTMLElement | null => {
  const candidates = [
    ...document.querySelectorAll<HTMLElement>('div[contenteditable="true"], [role="textbox"][contenteditable="true"]')
  ].filter((candidate) => isVisibleElement(candidate));

  const nearComposer = candidates.find((candidate) => {
    const parent = candidate.closest('form, main, [role="main"], section');
    return Boolean(parent);
  });

  return nearComposer ?? candidates[0] ?? null;
};

const pickHeuristicSendButton = (input: HTMLElement | null): HTMLButtonElement | null => {
  const container = input?.closest('form, main, [role="main"], section') ?? document;
  const candidates = [...container.querySelectorAll<HTMLButtonElement>('button')].filter((button) =>
    isVisibleElement(button)
  );

  const submitLike = candidates.find((button) => {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase();
    return /send|submit|arrow up|up/.test(label);
  });

  return submitLike ?? candidates[0] ?? null;
};

const getComposerWrapper = (input: HTMLElement | null): HTMLElement | null => {
  if (!input) {
    return null;
  }

  const wrapper =
    input.closest<HTMLElement>('[data-testid*="composer" i]') ??
    input.closest<HTMLElement>('[class*="composer" i]') ??
    input.closest<HTMLElement>('form, section, main, [role="main"]') ??
    input.parentElement;

  return wrapper ?? null;
};

export class ClaudeAdapter extends BasePlatformAdapter {
  constructor() {
    super('claude', 'Claude', CLAUDE_URLS);
  }

  detectInputElement(): HTMLElement | null {
    return pickByFallback<HTMLElement>([
      () => queryFirst<HTMLElement>(CLAUDE_INPUT_PRIMARY),
      () => queryFirst<HTMLElement>(CLAUDE_INPUT_SECONDARY),
      () => pickHeuristicEditable()
    ]);
  }

  getInputType(): 'contenteditable' {
    return 'contenteditable';
  }

  captureText(): string {
    const input = this.detectInputElement();

    if (!input) {
      return '';
    }

    return parseContentEditableHtml(input.innerHTML);
  }

  setText(nextText: string): void {
    const input = this.detectInputElement();
    if (!input) {
      return;
    }

    input.textContent = nextText;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  getSubmitButton(): HTMLElement | null {
    return pickByFallback<HTMLElement>([
      () => queryFirst<HTMLButtonElement>(CLAUDE_BUTTON_PRIMARY),
      () => queryFirst<HTMLButtonElement>(CLAUDE_BUTTON_SECONDARY),
      () => pickHeuristicSendButton(this.detectInputElement())
    ]);
  }

  getIconAnchor(): HTMLElement | null {
    return getComposerWrapper(this.detectInputElement());
  }

  getIconPlacement(): IconPlacementConfig {
    return {
      placement: 'inside-right',
      rightPx: 8,
      bottomPx: 8
    };
  }

  getInputAreaWrapper(): HTMLElement | null {
    return getComposerWrapper(this.detectInputElement());
  }
}
