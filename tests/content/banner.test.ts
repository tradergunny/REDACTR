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

  const statusZone = document.createElement('div');
  statusZone.setAttribute('data-redactr-zone', 'status');

  const statusSummary = document.createElement('div');
  statusSummary.setAttribute('data-redactr-status-summary', 'true');
  statusZone.append(statusSummary);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('data-redactr-action', 'dismiss');
  dismiss.setAttribute('aria-label', 'Dismiss warning');
  dismiss.textContent = '×';
  statusZone.append(dismiss);

  const findingsZone = document.createElement('div');
  findingsZone.setAttribute('data-redactr-zone', 'findings');

  const findings = document.createElement('div');
  findings.setAttribute('data-redactr-warning-findings', 'true');
  findingsZone.append(findings);

  const actionsZone = document.createElement('div');
  actionsZone.setAttribute('data-redactr-zone', 'actions');
  actionsZone.setAttribute('data-redactr-warning-actions', 'true');

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
      label: 'Allow Once',
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
    actionsZone.append(button);
  }

  container.append(statusZone, findingsZone, actionsZone);
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
    const zones = shadow?.querySelectorAll('[data-redactr-zone]');
    const findings = shadow?.querySelectorAll('[data-redactr-finding-row="true"]');

    expect(host).toBeTruthy();
    expect(zones?.length).toBe(3);
    expect(findings?.length).toBe(2);
  });

  it('renders status summary and disables dismiss for high severity', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const banner = new WarningBanner(createAdapter(), vi.fn());
    banner.show(anchor, buildWarningModel('high'));

    const host = anchor
      .querySelector<HTMLElement>('[data-redactr-warning-host="true"]')
      ?.shadowRoot;
    const summary = host?.querySelector<HTMLElement>('[data-redactr-status-summary="true"]');
    const dismissButton = host?.querySelector<HTMLButtonElement>(
      'button[data-redactr-action="dismiss"]'
    );

    expect(summary?.textContent).toContain('2 sensitive items');
    expect(summary?.textContent).toContain('High');
    expect(dismissButton?.disabled).toBe(true);
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

  it('renders 4 rows + overflow expander for 5 findings and expands on click', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const findings: WarningViewModel['findings'] = Array.from({ length: 5 }, (_, index) => ({
      key: `email:john${index}@example.com:${index}:email.rule`,
      category: 'email' as const,
      severity: index === 4 ? 'high' : 'medium',
      maskedPreview: `j***${index}@example.com`,
      confidence: 0.9
    }));

    const banner = new WarningBanner(createAdapter(), vi.fn());
    banner.show(anchor, {
      severity: 'high',
      blocking: true,
      title: 'Sensitive data detected',
      message: '5 findings detected',
      findings
    });

    const shadow = anchor
      .querySelector<HTMLElement>('[data-redactr-warning-host="true"]')
      ?.shadowRoot;

    const initialRows = shadow?.querySelectorAll('[data-redactr-finding-row="true"]');
    const expandButton = shadow?.querySelector<HTMLButtonElement>(
      'button[data-redactr-expand-findings="true"]'
    );

    expect(initialRows?.length).toBe(4);
    expect(expandButton?.textContent).toBe('+ 1 more');

    expandButton?.click();

    const expandedRows = shadow?.querySelectorAll('[data-redactr-finding-row="true"]');
    const afterExpandButton = shadow?.querySelector('button[data-redactr-expand-findings="true"]');
    expect(expandedRows?.length).toBe(5);
    expect(afterExpandButton).toBeNull();
  });

  it('handles Enter for focused action and Escape to dismiss', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const onAction = vi.fn();
    const banner = new WarningBanner(createAdapter(), onAction);
    banner.show(anchor, buildWarningModel('medium'));

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

  it('ignores Escape dismiss when severity is high', () => {
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor element missing');
    }

    const onAction = vi.fn();
    const banner = new WarningBanner(createAdapter(), onAction);
    banner.show(anchor, buildWarningModel('high'));

    const warning = anchor
      .querySelector<HTMLElement>('[data-redactr-warning-host="true"]')
      ?.shadowRoot?.querySelector<HTMLElement>('[data-redactr-warning="true"]');

    warning?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onAction).not.toHaveBeenCalledWith('dismiss');
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
