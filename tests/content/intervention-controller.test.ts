import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlatformAdapter } from '../../src/content/adapters/types';
import { InterventionController } from '../../src/content/intervention/controller';
import type { DetectionResult } from '../../src/content/pii/types';
import type { PIIEvent } from '../../src/shared/events';

const flushAsync = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createChromeMock = (): typeof chrome => {
  const syncStore: Record<string, unknown> = {};

  return {
    storage: {
      sync: {
        get: async (key?: string | string[] | Record<string, unknown>) => {
          if (typeof key === 'string') {
            return { [key]: syncStore[key] };
          }

          if (Array.isArray(key)) {
            return key.reduce<Record<string, unknown>>((accumulator, entry) => {
              accumulator[entry] = syncStore[entry];
              return accumulator;
            }, {});
          }

          return { ...syncStore, ...(key ?? {}) };
        },
        set: async (value: Record<string, unknown>) => {
          Object.assign(syncStore, value);
        }
      } as chrome.storage.SyncStorageArea,
      local: {
        get: async () => ({}),
        set: async () => undefined
      } as unknown as chrome.storage.LocalStorageArea
    }
  } as unknown as typeof chrome;
};

interface ControllerFixture {
  controller: InterventionController;
  input: HTMLTextAreaElement;
  submitButton: HTMLButtonElement;
  submitSpy: ReturnType<typeof vi.fn>;
  events: PIIEvent[];
}

const setupController = (): ControllerFixture => {
  document.body.innerHTML = `
    <div id="composer-wrapper">
      <textarea id="prompt-textarea"></textarea>
      <button id="send-button">Send</button>
    </div>
  `;

  const input = document.querySelector<HTMLTextAreaElement>('#prompt-textarea');
  const submitButton = document.querySelector<HTMLButtonElement>('#send-button');
  const wrapper = document.querySelector<HTMLElement>('#composer-wrapper');

  if (!input || !submitButton || !wrapper) {
    throw new Error('fixture elements missing');
  }

  const submitSpy = vi.fn();
  submitButton.addEventListener('click', submitSpy);

  const adapter: PlatformAdapter = {
    platformId: 'chatgpt',
    platformName: 'ChatGPT',
    supportedUrls: [/^https:\/\/chatgpt\.com\//i],
    detectInputElement: () => input,
    getInputType: () => 'textarea',
    captureText: () => input.value,
    setText: (nextText: string) => {
      input.value = nextText;
    },
    onTextChanged: () => () => undefined,
    getSubmitButton: () => submitButton,
    onSubmitIntercept: () => () => undefined,
    getIconAnchor: () => wrapper,
    getIconPlacement: () => ({ placement: 'inside-right', rightPx: 8, bottomPx: 8 }),
    getInputAreaWrapper: () => wrapper,
    renderInlineHighlight: () => undefined,
    cleanup: () => undefined
  };

  const events: PIIEvent[] = [];

  const controller = new InterventionController({
    adapter,
    sessionId: 'session_1',
    sendEvent: async (event) => {
      events.push(event);
    }
  });

  return {
    controller,
    input,
    submitButton,
    submitSpy,
    events
  };
};

const criticalDetection: DetectionResult = {
  text: '123-45-6789',
  category: 'ssn',
  severity: 'critical',
  confidence: 0.99,
  startIndex: 10,
  endIndex: 21,
  suggestedMask: '***-**-6789',
  rule: 'ssn.pattern',
  validationStage: 'validated',
  decision: 'block',
  scoreSignals: [],
  scoreBreakdown: {
    baseConfidence: 0.95,
    contextBonus: 0,
    signalDelta: 0.04,
    codePenalty: 0,
    finalConfidence: 0.99
  }
};

const mediumDetection: DetectionResult = {
  text: 'john@example.com',
  category: 'email',
  severity: 'medium',
  confidence: 0.9,
  startIndex: 6,
  endIndex: 22,
  suggestedMask: 'j***@example.com',
  rule: 'email.pattern',
  validationStage: 'validated',
  decision: 'warn',
  scoreSignals: [],
  scoreBreakdown: {
    baseConfidence: 0.88,
    contextBonus: 0,
    signalDelta: 0.02,
    codePenalty: 0,
    finalConfidence: 0.9
  }
};

const getPanelShadowRoot = (): ShadowRoot => {
  const host = document.querySelector<HTMLElement>('[data-redactr-panel-host="true"]');
  const shadow = host?.shadowRoot;

  if (!shadow) {
    throw new Error('panel shadow root missing');
  }

  return shadow;
};

const getIconShadowRoot = (): ShadowRoot => {
  const host = document.querySelector<HTMLElement>('[data-redactr-icon-host="true"]');
  const shadow = host?.shadowRoot;

  if (!shadow) {
    throw new Error('icon shadow root missing');
  }

  return shadow;
};

const openPanelByIcon = (): ShadowRoot => {
  const iconShadow = getIconShadowRoot();
  const shadow = getPanelShadowRoot();
  const icon = iconShadow.querySelector<HTMLButtonElement>('button[data-redactr-icon="true"]');

  if (!icon) {
    throw new Error('icon missing');
  }

  icon.click();
  return shadow;
};

describe('InterventionController', () => {
  beforeEach(() => {
    for (const host of document.querySelectorAll<HTMLElement>(
      '[data-redactr-panel-host=\"true\"], [data-redactr-icon-host=\"true\"]'
    )) {
      host.remove();
    }

    Object.defineProperty(globalThis, 'chrome', {
      value: createChromeMock(),
      configurable: true
    });
    document.body.innerHTML = '';
  });

  it('blocks submit for unresolved critical/high detections and opens panel', async () => {
    const { controller, events, submitButton } = setupController();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const result = controller.onSubmitAttempt(new Event('click'));
    await flushAsync();

    const panel = getPanelShadowRoot().querySelector<HTMLElement>('[data-redactr-panel="true"]');

    expect(result).toBe(false);
    expect(panel?.hasAttribute('hidden')).toBe(false);
    expect(submitButton.getAttribute('data-redactr-submit-dimmed')).toBe('true');
    expect(events.some((event) => event.event_type === 'submit_intercepted')).toBe(true);
    expect(events.some((event) => event.event_type === 'panel_opened')).toBe(true);
  });

  it('does not block submit for medium-only detections', () => {
    const { controller } = setupController();

    controller.onScanResult('email john@example.com', [mediumDetection]);

    const result = controller.onSubmitAttempt(new Event('click'));
    expect(result).toBe(true);
  });

  it('redact immediately masks input and undo restores exact original text', async () => {
    const { controller, input } = setupController();
    const text = 'email john@example.com';
    input.value = text;

    controller.onScanResult(text, [mediumDetection]);

    const shadow = openPanelByIcon();
    const redactButton = shadow.querySelector<HTMLButtonElement>(
      '[data-redactr-card="true"] button[data-redactr-primary="true"]'
    );
    if (!redactButton) {
      throw new Error('redact button missing');
    }

    redactButton.click();
    await flushAsync();

    expect(input.value).toBe('email j***@example.com');

    const undoButton = shadow.querySelector<HTMLButtonElement>('[data-redactr-resolved="true"] button');
    if (!undoButton) {
      throw new Error('undo button missing');
    }

    undoButton.click();
    await flushAsync();

    expect(input.value).toBe(text);
  });

  it('manual edit after redaction resets resolved state and rescans as pending', async () => {
    const { controller, input } = setupController();
    const text = 'email john@example.com';
    input.value = text;

    controller.onScanResult(text, [mediumDetection]);

    let shadow = openPanelByIcon();
    const redactButton = shadow.querySelector<HTMLButtonElement>(
      '[data-redactr-card="true"] button[data-redactr-primary="true"]'
    );
    if (!redactButton) {
      throw new Error('redact button missing');
    }

    redactButton.click();
    await flushAsync();
    expect(input.value).toBe('email j***@example.com');

    const editedText = 'email jane@example.com';
    input.value = editedText;
    controller.onScanResult(editedText, [
      {
        ...mediumDetection,
        text: 'jane@example.com',
        startIndex: 6,
        endIndex: 22,
        suggestedMask: 'j***@example.com'
      }
    ]);
    shadow = getPanelShadowRoot();

    expect(shadow.textContent).toContain('Redact');
    expect(shadow.textContent).not.toContain('Undo');
    expect(input.value).toBe(editedText);
  });

  it('reset restores full pre-redaction prompt snapshot', async () => {
    const { controller, input } = setupController();
    const text = 'email john@example.com ssn 123-45-6789';
    input.value = text;

    controller.onScanResult(text, [
      {
        ...mediumDetection,
        startIndex: 6,
        endIndex: 22
      },
      {
        ...criticalDetection,
        startIndex: 27,
        endIndex: 38
      }
    ]);

    const shadow = openPanelByIcon();
    const redactAllButton = shadow.querySelector<HTMLButtonElement>(
      '[data-redactr-footer="true"] button[data-redactr-primary="true"]'
    );
    if (!redactAllButton) {
      throw new Error('redact all button missing');
    }

    redactAllButton.click();
    await flushAsync();

    expect(input.value).toBe('email j***@example.com ssn [SSN]');

    const resetButton = shadow.querySelector<HTMLButtonElement>(
      '[data-redactr-footer="true"] button[data-redactr-muted="true"]'
    );
    if (!resetButton) {
      throw new Error('reset button missing');
    }

    resetButton.click();
    await flushAsync();

    expect(input.value).toBe(text);
  });

  it('clears per-item state after submit; ignored item is flagged again in new prompt', async () => {
    const { controller, submitSpy } = setupController();

    controller.onScanResult('email john@example.com', [mediumDetection]);

    let shadow = openPanelByIcon();

    const ignoreButton = shadow.querySelector<HTMLButtonElement>('[data-redactr-card="true"] button[data-redactr-muted="true"]');
    if (!ignoreButton) {
      throw new Error('ignore button missing');
    }

    ignoreButton.click();
    await flushAsync();

    const sendOriginal = shadow.querySelector<HTMLButtonElement>('[data-redactr-footer="true"] button[data-redactr-primary="true"]');
    if (!sendOriginal) {
      throw new Error('send original button missing');
    }

    sendOriginal.click();
    await flushAsync();

    expect(submitSpy).toHaveBeenCalledTimes(1);

    controller.onScanResult('email john@example.com', [mediumDetection]);
    shadow = getPanelShadowRoot();

    const icon = getIconShadowRoot().querySelector<HTMLButtonElement>('button[data-redactr-icon="true"]');
    icon?.click();

    expect(shadow.textContent).toContain('Redact');
    expect(
      shadow.querySelector('[data-redactr-resolved="true"][data-status="ignored"]')
    ).toBeNull();
  });

  it('send anyway keeps pending items original while preserving already-redacted items', async () => {
    const { controller, input, submitSpy, events } = setupController();

    const text = 'email john@example.com ssn 123-45-6789';
    input.value = text;

    const detections: DetectionResult[] = [
      {
        ...mediumDetection,
        startIndex: 6,
        endIndex: 22
      },
      {
        ...criticalDetection,
        startIndex: 27,
        endIndex: 38
      }
    ];

    controller.onScanResult(text, detections);

    const shadow = openPanelByIcon();

    const cardButtons = shadow.querySelectorAll<HTMLButtonElement>(
      '[data-redactr-card="true"] button[data-redactr-primary="true"]'
    );

    if (cardButtons.length < 1) {
      throw new Error('redact buttons missing');
    }

    cardButtons[0].click();
    await flushAsync();

    const sendAnyway = shadow.querySelector<HTMLButtonElement>(
      '[data-redactr-footer="true"] button[data-redactr-muted="true"]'
    );

    if (!sendAnyway) {
      throw new Error('send anyway button missing');
    }

    sendAnyway.click();

    const confirm = shadow.querySelector<HTMLButtonElement>(
      '[data-redactr-modal="true"] button[data-redactr-destructive="true"]'
    );

    if (!confirm) {
      throw new Error('send anyway confirmation button missing');
    }

    confirm.click();
    await flushAsync();

    expect(input.value).toBe('email j***@example.com ssn 123-45-6789');
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.event_type === 'send_anyway_confirmed')).toBe(true);
    expect(events.some((event) => event.event_type === 'submit_confirmed')).toBe(true);
  });

  it('clears state when input becomes empty', () => {
    const { controller } = setupController();

    controller.onScanResult('email john@example.com', [mediumDetection]);
    controller.onScanResult('', []);

    const shadow = getIconShadowRoot();
    const badge = shadow.querySelector('[data-redactr-badge="true"]');

    expect(badge).toBeNull();
  });
});
