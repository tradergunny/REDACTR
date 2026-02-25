import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTAdapter } from '../../src/content/adapters/chatgpt';
import { ClaudeAdapter } from '../../src/content/adapters/claude';

const flushDebounce = async (): Promise<void> => {
  vi.advanceTimersByTime(300);
  await Promise.resolve();
};

describe('adapter hooks and lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('captures ChatGPT textarea text', () => {
    document.body.innerHTML = '<textarea id="prompt-textarea">hello world</textarea>';
    const adapter = new ChatGPTAdapter();

    expect(adapter.captureText()).toBe('hello world');
  });

  it('updates ChatGPT textarea text via setText', () => {
    document.body.innerHTML = '<textarea id="prompt-textarea">hello world</textarea>';
    const textarea = document.querySelector<HTMLTextAreaElement>('#prompt-textarea');
    const adapter = new ChatGPTAdapter();

    if (!textarea) {
      throw new Error('textarea missing in test');
    }

    const inputSpy = vi.fn();
    textarea.addEventListener('input', inputSpy);

    adapter.setText('masked');

    expect(textarea.value).toBe('masked');
    expect(inputSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes ChatGPT icon and input anchors', () => {
    document.body.innerHTML = `
      <form id="composer">
        <textarea id="prompt-textarea">hello</textarea>
        <button data-testid="send-button">Send</button>
      </form>
    `;
    const adapter = new ChatGPTAdapter();

    expect(adapter.getIconAnchor()?.id).toBe('composer');
    expect(adapter.getInputAreaWrapper()?.id).toBe('composer');
    expect(adapter.getIconPlacement().placement).toBe('inside-right');
  });

  it('captures ChatGPT ProseMirror contenteditable text', () => {
    document.body.innerHTML = `
      <textarea class="wcDTda_fallbackTextarea" name="prompt-textarea" style="display: none;"></textarea>
      <div contenteditable="true" class="ProseMirror" id="prompt-textarea"><p>123</p></div>
    `;
    const adapter = new ChatGPTAdapter();

    expect(adapter.captureText()).toBe('123');
  });

  it('updates ChatGPT contenteditable text via setText', () => {
    document.body.innerHTML = `
      <textarea class="wcDTda_fallbackTextarea" name="prompt-textarea" style="display: none;"></textarea>
      <div contenteditable="true" class="ProseMirror" id="prompt-textarea"><p>123</p></div>
    `;
    const editable = document.querySelector<HTMLElement>('div[contenteditable="true"]');
    const adapter = new ChatGPTAdapter();

    if (!editable) {
      throw new Error('contenteditable missing in test');
    }

    const inputSpy = vi.fn();
    editable.addEventListener('input', inputSpy);

    adapter.setText('masked');

    expect(editable.textContent).toBe('masked');
    expect(inputSpy).toHaveBeenCalledTimes(1);
  });

  it('captures Claude contenteditable text from innerHTML', () => {
    document.body.innerHTML = '<div contenteditable="true">one<br>two</div>';
    const adapter = new ClaudeAdapter();

    expect(adapter.captureText()).toBe('one\ntwo');
  });

  it('updates Claude contenteditable text via setText', () => {
    document.body.innerHTML = '<div contenteditable="true">one<br>two</div>';
    const editable = document.querySelector<HTMLElement>('div[contenteditable="true"]');
    const adapter = new ClaudeAdapter();

    if (!editable) {
      throw new Error('contenteditable missing in test');
    }

    const inputSpy = vi.fn();
    editable.addEventListener('input', inputSpy);

    adapter.setText('masked');

    expect(editable.textContent).toBe('masked');
    expect(inputSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes Claude icon and input anchors', () => {
    document.body.innerHTML = `
      <form id="composer">
        <div contenteditable="true" role="textbox">hello</div>
        <button aria-label="Send">Send</button>
      </form>
    `;
    const adapter = new ClaudeAdapter();

    expect(adapter.getIconAnchor()?.id).toBe('composer');
    expect(adapter.getInputAreaWrapper()?.id).toBe('composer');
    expect(adapter.getIconPlacement().placement).toBe('inside-right');
  });

  it('fires onTextChanged with debounce on typing', async () => {
    document.body.innerHTML = '<textarea id="prompt-textarea"></textarea>';
    const textarea = document.querySelector('textarea');
    const adapter = new ChatGPTAdapter();
    const callback = vi.fn();

    const unsubscribe = adapter.onTextChanged(callback);

    if (!textarea) {
      throw new Error('textarea missing in test');
    }

    textarea.value = 'a';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.value = 'ab';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    await flushDebounce();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('ab');

    unsubscribe();
    adapter.cleanup();
  });

  it('fires onTextChanged with debounce on paste', async () => {
    document.body.innerHTML = '<textarea id="prompt-textarea"></textarea>';
    const textarea = document.querySelector('textarea');
    const adapter = new ChatGPTAdapter();
    const callback = vi.fn();

    const unsubscribe = adapter.onTextChanged(callback);

    if (!textarea) {
      throw new Error('textarea missing in test');
    }

    textarea.value = 'pasted';
    textarea.dispatchEvent(new Event('paste', { bubbles: true }));

    await flushDebounce();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('pasted');

    unsubscribe();
    adapter.cleanup();
  });

  it('captures settled content on paste for contenteditable editors', async () => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox">before</div>';
    const editable = document.querySelector('div[contenteditable="true"]');
    const adapter = new ClaudeAdapter();
    const callback = vi.fn();

    const unsubscribe = adapter.onTextChanged(callback);

    if (!editable) {
      throw new Error('contenteditable missing in test');
    }

    editable.dispatchEvent(new Event('paste', { bubbles: true }));
    editable.innerHTML = 'after';

    await Promise.resolve();
    await flushDebounce();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('after');

    unsubscribe();
    adapter.cleanup();
  });

  it('produces equivalent capture for typed and pasted content', async () => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox"></div>';
    const editable = document.querySelector('div[contenteditable="true"]');
    const adapter = new ClaudeAdapter();
    const callback = vi.fn();
    const payload = '415-555-2671 212-555-1212';

    const unsubscribe = adapter.onTextChanged(callback);

    if (!editable) {
      throw new Error('contenteditable missing in test');
    }

    editable.innerHTML = payload;
    editable.dispatchEvent(new Event('input', { bubbles: true }));
    await flushDebounce();
    const typedCapture = callback.mock.lastCall?.[0];

    callback.mockClear();

    editable.innerHTML = '';
    editable.dispatchEvent(new Event('paste', { bubbles: true }));
    editable.innerHTML = payload;

    await Promise.resolve();
    await flushDebounce();
    const pastedCapture = callback.mock.lastCall?.[0];

    expect(typedCapture).toBe(payload);
    expect(pastedCapture).toBe(payload);

    unsubscribe();
    adapter.cleanup();
  });

  it('fires onTextChanged when mutation observer detects changes', async () => {
    document.body.innerHTML = '<div contenteditable="true">alpha</div>';
    const editable = document.querySelector('div[contenteditable="true"]');
    const adapter = new ClaudeAdapter();
    const callback = vi.fn();

    const unsubscribe = adapter.onTextChanged(callback);

    if (!editable) {
      throw new Error('contenteditable missing in test');
    }

    editable.innerHTML = 'beta';

    await Promise.resolve();
    await flushDebounce();

    expect(callback).toHaveBeenCalled();
    expect(callback).toHaveBeenLastCalledWith('beta');

    unsubscribe();
    adapter.cleanup();
  });

  it('blocks submit click and Enter when callback returns false', () => {
    document.body.innerHTML = `
      <textarea id="prompt-textarea"></textarea>
      <button data-testid="send-button">Send</button>
    `;

    const button = document.querySelector('button');
    const textarea = document.querySelector('textarea');

    if (!button || !textarea) {
      throw new Error('required elements missing in test');
    }

    const adapter = new ChatGPTAdapter();
    const callback = vi.fn(() => false);
    const unsubscribe = adapter.onSubmitIntercept(callback);

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(clickEvent);

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(enterEvent);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(enterEvent.defaultPrevented).toBe(true);

    unsubscribe();
    adapter.cleanup();
  });

  it('does not block submit when callback returns true', () => {
    document.body.innerHTML = `
      <textarea id="prompt-textarea"></textarea>
      <button data-testid="send-button">Send</button>
    `;

    const button = document.querySelector('button');

    if (!button) {
      throw new Error('button missing in test');
    }

    const adapter = new ChatGPTAdapter();
    const callback = vi.fn(() => true);
    const unsubscribe = adapter.onSubmitIntercept(callback);

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(clickEvent);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(clickEvent.defaultPrevented).toBe(false);

    unsubscribe();
    adapter.cleanup();
  });

  it('renders inline highlight for textarea without throwing', () => {
    document.body.innerHTML = '<textarea id="prompt-textarea">abcdef</textarea>';
    const adapter = new ChatGPTAdapter();

    expect(() =>
      adapter.renderInlineHighlight(
        {
          startIndex: 1,
          endIndex: 4
        },
        'medium'
      )
    ).not.toThrow();

    adapter.cleanup();
  });

  it('renders inline highlight for contenteditable without throwing', () => {
    document.body.innerHTML = `
      <textarea class="wcDTda_fallbackTextarea" name="prompt-textarea" style="display: none;"></textarea>
      <div contenteditable="true" class="ProseMirror" id="prompt-textarea"><p>alpha beta</p></div>
    `;
    const adapter = new ChatGPTAdapter();

    expect(() =>
      adapter.renderInlineHighlight(
        {
          startIndex: 0,
          endIndex: 5
        },
        'high'
      )
    ).not.toThrow();

    adapter.cleanup();
  });

  it('cleanup removes listeners and observers and is idempotent', async () => {
    document.body.innerHTML = '<textarea id="prompt-textarea"></textarea>';
    const textarea = document.querySelector('textarea');

    if (!textarea) {
      throw new Error('textarea missing in test');
    }

    const adapter = new ChatGPTAdapter();
    const callback = vi.fn();

    adapter.onTextChanged(callback);
    adapter.cleanup();
    adapter.cleanup();

    textarea.value = 'after-cleanup';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await flushDebounce();

    expect(callback).not.toHaveBeenCalled();
  });
});
