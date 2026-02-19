import {
  BasePlatformAdapter,
  isVisibleElement,
  normalizeCapturedText,
  pickByFallback,
  queryFirst
} from './base';
import type { IconPlacementConfig } from './types';

const CHATGPT_URLS = [/^https:\/\/chatgpt\.com\//i, /^https:\/\/chat\.openai\.com\//i];

const CHATGPT_INPUT_PRIMARY = [
  'div#prompt-textarea.ProseMirror[contenteditable="true"]',
  'div#prompt-textarea[contenteditable="true"]',
  'div.ProseMirror[contenteditable="true"]'
];

const CHATGPT_TEXTAREA_PRIMARY = [
  'textarea#prompt-textarea',
  'textarea[name="prompt-textarea"]',
  'textarea[data-testid="prompt-textarea"]'
];

const CHATGPT_INPUT_SECONDARY = [
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][aria-label*="Message" i]',
  'textarea[aria-label*="Message" i]',
  'textarea[aria-label*="prompt" i]'
];

const CHATGPT_BUTTON_PRIMARY = ['button[data-testid="send-button"]'];

const CHATGPT_BUTTON_SECONDARY = [
  'button[aria-label*="Send" i]',
  'button[aria-label*="send message" i]'
];

const queryVisibleFirst = <T extends HTMLElement>(selectors: string[]): T | null => {
  for (const selector of selectors) {
    const matches = [...document.querySelectorAll<T>(selector)];
    const visibleMatch = matches.find((match) => isVisibleElement(match));
    if (visibleMatch) {
      return visibleMatch;
    }
  }

  return null;
};

const isContentEditableElement = (element: HTMLElement): boolean =>
  element.isContentEditable || element.getAttribute('contenteditable') === 'true';

const parseContentEditableHtml = (html: string): string => {
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n');

  const container = document.createElement('div');
  container.innerHTML = withLineBreaks;

  return normalizeCapturedText(container.textContent ?? '');
};

const pickHeuristicEditable = (): HTMLElement | null => {
  const candidates = [...document.querySelectorAll<HTMLElement>('div[contenteditable="true"]')].filter((candidate) =>
    isVisibleElement(candidate)
  );

  const nearComposer = candidates.find((candidate) =>
    Boolean(candidate.closest('.wcDTda_prosemirror-parent, form, main, [role="main"], section'))
  );

  return nearComposer ?? candidates[0] ?? null;
};

const pickHeuristicTextarea = (): HTMLTextAreaElement | null => {
  const candidates = [...document.querySelectorAll<HTMLTextAreaElement>('textarea')];

  const visible = candidates.filter((candidate) => isVisibleElement(candidate));

  const nearComposer = visible.find((candidate) => {
    const section = candidate.closest('form, main, [role="main"], [data-testid]');
    return Boolean(section);
  });

  return nearComposer ?? visible[0] ?? null;
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
    input.closest<HTMLElement>('.wcDTda_prosemirror-parent') ??
    input.closest<HTMLElement>('[data-testid*="composer" i]') ??
    input.closest<HTMLElement>('form, section, main, [role="main"]') ??
    input.parentElement;

  return wrapper ?? null;
};

export class ChatGPTAdapter extends BasePlatformAdapter {
  constructor() {
    super('chatgpt', 'ChatGPT', CHATGPT_URLS);
  }

  detectInputElement(): HTMLElement | null {
    return pickByFallback<HTMLElement>([
      () => queryVisibleFirst<HTMLElement>(CHATGPT_INPUT_PRIMARY),
      () => queryVisibleFirst<HTMLTextAreaElement>(CHATGPT_TEXTAREA_PRIMARY),
      () => queryVisibleFirst<HTMLElement>(CHATGPT_INPUT_SECONDARY),
      () => pickHeuristicEditable(),
      () => pickHeuristicTextarea()
    ]);
  }

  getInputType(): 'textarea' | 'contenteditable' {
    const input = this.detectInputElement();
    if (input && isContentEditableElement(input)) {
      return 'contenteditable';
    }

    return 'textarea';
  }

  captureText(): string {
    const input = this.detectInputElement();

    if (!input) {
      return '';
    }

    if (input instanceof HTMLTextAreaElement) {
      return normalizeCapturedText(input.value);
    }

    if (isContentEditableElement(input)) {
      return parseContentEditableHtml(input.innerHTML);
    }

    return '';
  }

  getSubmitButton(): HTMLElement | null {
    return pickByFallback<HTMLElement>([
      () => queryFirst<HTMLButtonElement>(CHATGPT_BUTTON_PRIMARY),
      () => queryFirst<HTMLButtonElement>(CHATGPT_BUTTON_SECONDARY),
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
