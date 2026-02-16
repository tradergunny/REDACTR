import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PlatformAdapter,
  WarningConfig
} from '../../src/content/adapters/types';
import { WarningBanner } from '../../src/content/intervention/banner';
import type { WarningViewModel } from '../../src/content/intervention/types';

const buildWarningSkeleton = (warning: WarningConfig): HTMLElement => {
  const container = document.createElement('section');
  container.setAttribute('data-redactr-warning', 'true');
  container.setAttribute('data-severity', warning.severity);

  const header = document.createElement('div');
  header.setAttribute('data-redactr-warning-header', 'true');

  const title = document.createElement('h2');
  title.setAttribute('data-redactr-warning-title', 'true');
  header.append(title);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('data-redactr-action', 'dismiss');
  dismiss.setAttribute('aria-label', 'Dismiss warning');
  dismiss.textContent = '×';
  header.append(dismiss);

  const message = document.createElement('p');
  message.setAttribute('data-redactr-warning-message', 'true');

  const findings = document.createElement('ul');
  findings.setAttribute('data-redactr-warning-findings', 'true');

  const actions = document.createElement('div');
  actions.setAttribute('data-redactr-warning-actions', 'true');

  const buttonSpecs: Array<{ action: string; label: string; ariaLabel: string }> = [
    {
      action: 'mask_send',
      label: 'Mask & Send',
      ariaLabel: 'Mask sensitive data and send prompt'
    },
    {
      action: 'edit_prompt',
      label: 'Edit Prompt',
      ariaLabel: 'Edit prompt and review highlighted sensitive data'
    },
    {
      action: 'allow_once',
      label: 'Allow This Time',
      ariaLabel: 'Allow this prompt once without masking'
    },
    {
      action: 'always_allow',
      label: 'Always Allow',
      ariaLabel: 'Always allow this exact pattern in future prompts'
    }
  ];

  for (const buttonSpec of buttonSpecs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = buttonSpec.label;
    button.setAttribute('data-redactr-action', buttonSpec.action);
    button.setAttribute('aria-label', buttonSpec.ariaLabel);
    actions.append(button);
  }

  container.append(header, message, findings, actions);
  return container;
};

const createAdapter = (): PlatformAdapter => ({
  platformId: 'chatgpt',
  platformName: 'ChatGPT',
  supportedUrls: [/^https:\/\/chatgpt\.com\//i],
  detectInputElement: () => null,
  getInputType: () => 'textarea',
  captureText: () => '',
  onTextChanged: () => () => undefined,
  getSubmitButton: () => null,
  onSubmitIntercept: () => () => undefined,
  getWarningAnchor: () => document.body,
  renderWarning: (warning: WarningConfig) => buildWarningSkeleton(warning),
  renderInlineHighlight: () => undefined,
  cleanup: () => undefined
});

const buildWarningModel = (
  severity: WarningViewModel['severity'] = 'critical'
): WarningViewModel => ({
  severity,
  blocking: severity === 'critical' || severity === 'high',
  title: 'Sensitive data detected',
  message: '2 findings detected',
  findings: [
    {
      key: 'email:john@example.com:0:10:email.rule',
      category: 'email',
      severity: 'medium',
      maskedPreview: 'j***@example.com',
      confidence: 0.92
    },
    {
      key: 'ssn:123-45-6789:12:23:ssn.rule',
      category: 'ssn',
      severity: 'critical',
      maskedPreview: '***-**-6789',
      confidence: 0.99
    }
  ]
});

describe('WarningBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="anchor"></div>';
  });

  it('renders grouped findings in one banner', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const banner = new WarningBanner(createAdapter(), vi.fn());
    banner.show(anchor, buildWarningModel());

    const host = anchor.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    const shadow = host?.shadowRoot;
    const findings = shadow?.querySelectorAll('[data-redactr-finding="true"]');

    expect(host).toBeTruthy();
    expect(findings?.length).toBe(2);
  });

  it('maps severity to expected color variable', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const banner = new WarningBanner(createAdapter(), vi.fn());
    banner.show(anchor, buildWarningModel('high'));

    const warning = anchor
      .querySelector<HTMLElement>('[data-redactr-warning-host="true"]')
      ?.shadowRoot?.querySelector<HTMLElement>('[data-redactr-warning="true"]');

    expect(warning?.style.getPropertyValue('--rd-accent')).toBe('#EA580C');
  });

  it('sets aria labels on all interactive controls', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const banner = new WarningBanner(createAdapter(), vi.fn());
    banner.show(anchor, buildWarningModel());

    const controls = anchor
      .querySelector<HTMLElement>('[data-redactr-warning-host="true"]')
      ?.shadowRoot?.querySelectorAll<HTMLButtonElement>('button[data-redactr-action]');

    expect(controls?.length).toBe(5);

    controls?.forEach((button) => {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('handles Enter for focused action and Escape to dismiss', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const onAction = vi.fn();
    const banner = new WarningBanner(createAdapter(), onAction);
    banner.show(anchor, buildWarningModel());

    const warning = anchor
      .querySelector<HTMLElement>('[data-redactr-warning-host="true"]')
      ?.shadowRoot?.querySelector<HTMLElement>('[data-redactr-warning="true"]');

    const maskButton = warning?.querySelector<HTMLButtonElement>(
      'button[data-redactr-action="mask_send"]'
    );

    if (!warning || !maskButton) {
      throw new Error('warning or action button missing');
    }

    maskButton.focus();
    warning.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    warning.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onAction).toHaveBeenCalledWith('mask_send');
    expect(onAction).toHaveBeenCalledWith('dismiss');
  });

  it('attaches content into Shadow DOM for style isolation', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const banner = new WarningBanner(createAdapter(), vi.fn());
    banner.show(anchor, buildWarningModel('low'));

    const host = anchor.querySelector<HTMLElement>('[data-redactr-warning-host="true"]');
    expect(host?.shadowRoot).toBeTruthy();
    expect(host?.shadowRoot?.querySelector('style')).toBeTruthy();
  });
});
