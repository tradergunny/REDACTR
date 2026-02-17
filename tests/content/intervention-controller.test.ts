import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PlatformAdapter,
  WarningConfig
} from '../../src/content/adapters/types';
import type { DetectionResult } from '../../src/content/pii/types';
import { InterventionController } from '../../src/content/intervention/controller';

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

const createWarningSkeleton = (warning: WarningConfig): HTMLElement => {
  const section = document.createElement('section');
  section.setAttribute('data-redactr-warning', 'true');
  section.setAttribute('data-severity', warning.severity);

  const header = document.createElement('div');
  header.setAttribute('data-redactr-warning-header', 'true');

  const title = document.createElement('h2');
  title.setAttribute('data-redactr-warning-title', 'true');
  header.append(title);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = '×';
  dismiss.setAttribute('data-redactr-action', 'dismiss');
  dismiss.setAttribute('aria-label', 'Dismiss warning');
  header.append(dismiss);

  const message = document.createElement('p');
  message.setAttribute('data-redactr-warning-message', 'true');

  const findings = document.createElement('ul');
  findings.setAttribute('data-redactr-warning-findings', 'true');

  const actions = document.createElement('div');
  actions.setAttribute('data-redactr-warning-actions', 'true');

  const actionKeys = ['mask_send', 'edit_prompt', 'allow_once', 'always_allow'];
  for (const actionKey of actionKeys) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-redactr-action', actionKey);
    button.setAttribute('aria-label', actionKey);
    button.textContent = actionKey;
    actions.append(button);
  }

  section.append(header, message, findings, actions);
  return section;
};

interface ControllerFixture {
  adapter: PlatformAdapter;
  controller: InterventionController;
  submitSpy: ReturnType<typeof vi.fn>;
  events: Array<{ event_type: string }>;
}

const setupController = (): ControllerFixture => {
  document.body.innerHTML = `
    <div id="anchor"></div>
    <textarea id="prompt-textarea"></textarea>
    <button id="send-button">Send</button>
  `;

  const input = document.querySelector<HTMLTextAreaElement>('#prompt-textarea');
  const submitButton = document.querySelector<HTMLButtonElement>('#send-button');
  const anchor = document.querySelector<HTMLElement>('#anchor');

  if (!input || !submitButton || !anchor) {
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
    onTextChanged: () => () => undefined,
    getSubmitButton: () => submitButton,
    onSubmitIntercept: () => () => undefined,
    getWarningAnchor: () => anchor,
    renderWarning: (warning: WarningConfig) => createWarningSkeleton(warning),
    renderInlineHighlight: () => undefined,
    cleanup: () => undefined
  };

  const events: Array<{ event_type: string }> = [];

  const controller = new InterventionController({
    adapter,
    sessionId: 'session_1',
    sendEvent: async (event) => {
      events.push({ event_type: event.event_type });
    }
  });

  return {
    adapter,
    controller,
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

describe('InterventionController', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'chrome', {
      value: createChromeMock(),
      configurable: true
    });
    document.body.innerHTML = '';
  });

  it('blocks submit for critical/high detections', () => {
    const { controller } = setupController();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const result = controller.onSubmitAttempt(new Event('click'));
    expect(result).toBe(false);
  });

  it('does not block submit for medium/low detections', () => {
    const { controller } = setupController();

    controller.onScanResult('email john@example.com', [mediumDetection]);

    const result = controller.onSubmitAttempt(new Event('click'));
    expect(result).toBe(true);
  });

  it('does not block submit when no detections exist', () => {
    const { controller } = setupController();

    controller.onScanResult('clean prompt', []);

    const result = controller.onSubmitAttempt(new Event('click'));
    expect(result).toBe(true);
  });

  it('masks detections in reverse order and submits', async () => {
    const { controller, submitSpy } = setupController();

    const text = 'email john@example.com ssn 123-45-6789';
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

    const host = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    const maskButton = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-redactr-action="mask_send"]'
    );

    if (!maskButton) {
      throw new Error('mask button missing');
    }

    maskButton.click();
    await flushAsync();

    const input = document.querySelector<HTMLTextAreaElement>('#prompt-textarea');
    expect(input?.value).toBe('email j***@example.com ssn ***-**-6789');
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('suppresses same detection for Allow This Time in session', async () => {
    const { controller } = setupController();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const host = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    const allowOnceButton = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-redactr-action="allow_once"]'
    );

    if (!allowOnceButton) {
      throw new Error('allow once button missing');
    }

    allowOnceButton.click();
    await flushAsync();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const nextHost = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    expect(nextHost).toBeNull();
  });

  it('persists Always Allow and suppresses detection immediately', async () => {
    const { controller, events } = setupController();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const host = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    const alwaysAllowButton = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-redactr-action="always_allow"]'
    );

    if (!alwaysAllowButton) {
      throw new Error('always allow button missing');
    }

    alwaysAllowButton.click();
    await vi.waitFor(() =>
      expect(
        events.some((event) => event.event_type === 'pii_allowlisted')
      ).toBe(true)
    );

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const nextHost = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    expect(nextHost).toBeNull();
  });

  it('uses bypass flag to avoid immediate recursive submit block', async () => {
    const { controller } = setupController();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const host = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    const maskButton = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-redactr-action="mask_send"]'
    );

    if (!maskButton) {
      throw new Error('mask button missing');
    }

    maskButton.click();
    await flushAsync();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    expect(controller.onSubmitAttempt(new Event('click'))).toBe(true);
  });

  it('dismiss hides banner but does not unblock critical submit', async () => {
    const { controller, events } = setupController();

    controller.onScanResult('ssn test 123-45-6789', [criticalDetection]);

    const host = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    const dismissButton = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-redactr-action="dismiss"]'
    );

    if (!dismissButton) {
      throw new Error('dismiss button missing');
    }

    dismissButton.click();
    await flushAsync();

    expect(controller.onSubmitAttempt(new Event('click'))).toBe(false);
    const nextHost = document.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    expect(nextHost).toBeTruthy();
    expect(events.some((event) => event.event_type === 'warning_dismissed')).toBe(true);
  });
});
