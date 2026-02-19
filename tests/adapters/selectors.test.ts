import { describe, expect, it } from 'vitest';

import { ChatGPTAdapter } from '../../src/content/adapters/chatgpt';
import { ClaudeAdapter } from '../../src/content/adapters/claude';

const clearDom = (): void => {
  document.body.innerHTML = '';
};

describe('adapter selector fallback', () => {
  it('ChatGPT input prefers visible ProseMirror composer over hidden textarea fallback', () => {
    clearDom();
    document.body.innerHTML = `
      <textarea class="wcDTda_fallbackTextarea" name="prompt-textarea" style="display: none;"></textarea>
      <div contenteditable="true" class="ProseMirror" id="prompt-textarea"><p>123</p></div>
    `;

    const adapter = new ChatGPTAdapter();
    const input = adapter.detectInputElement();

    expect(input).toBeInstanceOf(HTMLElement);
    expect(input?.id).toBe('prompt-textarea');
    expect(input?.tagName).toBe('DIV');
  });

  it('ChatGPT input uses primary selector first', () => {
    clearDom();
    document.body.innerHTML = `
      <textarea id="prompt-textarea"></textarea>
      <textarea aria-label="Message"></textarea>
    `;

    const adapter = new ChatGPTAdapter();
    const input = adapter.detectInputElement();

    expect(input).toBeInstanceOf(HTMLTextAreaElement);
    expect(input?.id).toBe('prompt-textarea');
  });

  it('ChatGPT input falls back to aria selector', () => {
    clearDom();
    document.body.innerHTML = `<textarea aria-label="Message ChatGPT"></textarea>`;

    const adapter = new ChatGPTAdapter();

    expect(adapter.detectInputElement()).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('ChatGPT input falls back to heuristic textarea', () => {
    clearDom();
    document.body.innerHTML = '<textarea></textarea>';

    const adapter = new ChatGPTAdapter();

    expect(adapter.detectInputElement()).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('ChatGPT submit button falls back from primary to aria', () => {
    clearDom();
    document.body.innerHTML = '<button aria-label="Send message"></button>';

    const adapter = new ChatGPTAdapter();

    expect(adapter.getSubmitButton()).toBeInstanceOf(HTMLButtonElement);
  });

  it('ChatGPT exposes icon anchor and input wrapper', () => {
    clearDom();
    document.body.innerHTML = `
      <form id="composer">
        <textarea id="prompt-textarea"></textarea>
        <button data-testid="send-button">Send</button>
      </form>
    `;

    const adapter = new ChatGPTAdapter();
    const iconAnchor = adapter.getIconAnchor();
    const inputWrapper = adapter.getInputAreaWrapper();
    const iconPlacement = adapter.getIconPlacement();

    expect(iconAnchor).toBeInstanceOf(HTMLElement);
    expect(inputWrapper).toBeInstanceOf(HTMLElement);
    expect(iconAnchor?.id).toBe('composer');
    expect(inputWrapper?.id).toBe('composer');
    expect(iconPlacement.placement).toBe('inside-right');
  });

  it('Claude input uses primary contenteditable selector', () => {
    clearDom();
    document.body.innerHTML = '<div contenteditable="true" role="textbox"></div>';

    const adapter = new ClaudeAdapter();

    expect(adapter.detectInputElement()).toBeInstanceOf(HTMLElement);
  });

  it('Claude input falls back to heuristic contenteditable', () => {
    clearDom();
    document.body.innerHTML = '<div contenteditable="true"></div>';

    const adapter = new ClaudeAdapter();

    expect(adapter.detectInputElement()).toBeInstanceOf(HTMLElement);
  });

  it('Claude submit button falls back from primary to aria', () => {
    clearDom();
    document.body.innerHTML = '<button aria-label="Send"></button>';

    const adapter = new ClaudeAdapter();

    expect(adapter.getSubmitButton()).toBeInstanceOf(HTMLButtonElement);
  });

  it('Claude submit button falls back to heuristic button', () => {
    clearDom();
    document.body.innerHTML = '<button>Send now</button>';

    const adapter = new ClaudeAdapter();

    expect(adapter.getSubmitButton()).toBeInstanceOf(HTMLButtonElement);
  });

  it('Claude exposes icon anchor and input wrapper', () => {
    clearDom();
    document.body.innerHTML = `
      <form id="composer">
        <div contenteditable="true" role="textbox"></div>
        <button aria-label="Send">Send</button>
      </form>
    `;

    const adapter = new ClaudeAdapter();
    const iconAnchor = adapter.getIconAnchor();
    const inputWrapper = adapter.getInputAreaWrapper();
    const iconPlacement = adapter.getIconPlacement();

    expect(iconAnchor).toBeInstanceOf(HTMLElement);
    expect(inputWrapper).toBeInstanceOf(HTMLElement);
    expect(iconAnchor?.id).toBe('composer');
    expect(inputWrapper?.id).toBe('composer');
    expect(iconPlacement.placement).toBe('inside-right');
  });
});
