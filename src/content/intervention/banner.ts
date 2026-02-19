import type { PlatformAdapter, Severity } from '../adapters/types';
import type { InterventionAction, WarningViewModel } from './types';

const ACTION_ATTRIBUTE = 'data-redactr-action';
const HOST_ATTRIBUTE = 'data-redactr-warning-host';
const FINDINGS_COLLAPSE_LIMIT = 4;

const CATEGORY_LABELS: Record<string, string> = {
  credit_card: 'Credit Card',
  bank_account: 'Bank Account',
  ssn: 'SSN',
  api_key: 'API Key',
  password: 'Password',
  passport: 'Passport',
  national_id: 'National ID',
  email: 'Email',
  phone: 'Phone',
  employee_name: 'Employee Name',
  address: 'Address'
};

const toCategoryLabel = (category: string): string =>
  CATEGORY_LABELS[category] ??
  category
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');

const toSeverityLabel = (severity: Severity): string =>
  severity.slice(0, 1).toUpperCase() + severity.slice(1);

const isDismissEnabled = (severity: Severity): boolean =>
  severity === 'medium' || severity === 'low';

type IconName = 'shield' | 'phone' | 'card' | 'key' | 'envelope' | 'identity';

const ICON_MARKUP: Record<IconName, string> = {
  shield:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3L19 6V12C19 16.5 16.3 19.3 12 21C7.7 19.3 5 16.5 5 12V6L12 3Z" fill="currentColor"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="8" y="3" width="8" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>',
  card:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>',
  key:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="8" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="11" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="17" y1="12" x2="17" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="19" y1="12" x2="19" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>',
  envelope:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="4,7 12,13 20,7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  identity:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="10" x2="17" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="14" x2="15" y2="14" stroke="currentColor" stroke-width="1.5"/><circle cx="7.5" cy="11" r="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
};

const toCategoryIcon = (category: string): IconName => {
  if (category === 'phone') {
    return 'phone';
  }

  if (category === 'email') {
    return 'envelope';
  }

  if (category === 'credit_card' || category === 'bank_account') {
    return 'card';
  }

  if (category === 'api_key' || category === 'password') {
    return 'key';
  }

  return 'identity';
};

const STYLE_TEXT = `
  :host {
    all: initial;
  }

  [data-redactr-warning='true'] {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    margin-bottom: 8px;
  }

  [data-redactr-zone='status'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  [data-redactr-status-summary='true'] {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  [data-redactr-status-text='true'] {
    display: inline-flex;
    gap: 4px;
    min-width: 0;
  }

  [data-redactr-zone='findings'] {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  [data-redactr-warning-findings='true'] {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  [data-redactr-finding-row='true'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
  }

  [data-redactr-finding-row='true'] + [data-redactr-finding-row='true'] {
    border-top-style: solid;
    border-top-width: 1px;
    border-top-color: currentColor;
  }

  [data-redactr-finding-mask='true'] {
    margin-left: auto;
  }

  [data-redactr-zone='actions'] {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  button[${ACTION_ATTRIBUTE}] {
    height: 30px;
    padding: 0 10px;
    margin: 0;
  }

  button[${ACTION_ATTRIBUTE}='dismiss'] {
    width: 24px;
    height: 24px;
    padding: 0;
  }

  button[data-redactr-expand-findings='true'] {
    padding: 0;
    margin: 4px 0 0;
    width: fit-content;
  }
`;

export class WarningBanner {
  private host: HTMLDivElement | null = null;

  private shadowRootRef: ShadowRoot | null = null;

  private warningElement: HTMLElement | null = null;

  private actionButtons: Partial<Record<InterventionAction, HTMLButtonElement>> = {};

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly onAction: (action: InterventionAction) => void
  ) {}

  private ensureHost(anchor: HTMLElement): void {
    if (!this.host) {
      const host = document.createElement('div');
      host.setAttribute(HOST_ATTRIBUTE, 'true');
      const shadowRoot = host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = STYLE_TEXT;
      shadowRoot.append(style);

      this.host = host;
      this.shadowRootRef = shadowRoot;
    }

    if (this.host.parentElement !== anchor) {
      anchor.prepend(this.host);
    }
  }

  private buildIcon(icon: IconName): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.setAttribute('data-redactr-icon', icon);
    wrapper.innerHTML = ICON_MARKUP[icon];
    return wrapper;
  }

  private buildFindingRow(
    finding: WarningViewModel['findings'][number]
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.setAttribute('data-redactr-finding-row', 'true');
    row.setAttribute('data-severity', finding.severity);
    row.setAttribute('role', 'listitem');

    const category = document.createElement('span');
    category.setAttribute('data-redactr-finding-category', 'true');
    category.textContent = toCategoryLabel(finding.category);

    const maskedPreview = document.createElement('span');
    maskedPreview.setAttribute('data-redactr-finding-mask', 'true');
    maskedPreview.textContent = finding.maskedPreview;

    const severity = document.createElement('span');
    severity.setAttribute('data-redactr-finding-severity', 'true');
    severity.textContent = finding.severity.toUpperCase();

    row.append(
      this.buildIcon(toCategoryIcon(finding.category)),
      category,
      maskedPreview,
      severity
    );

    return row;
  }

  private renderFindingsRows(
    container: HTMLElement,
    findings: WarningViewModel['findings'],
    options: { expanded: boolean }
  ): void {
    container.setAttribute('role', 'list');

    const visibleFindings = options.expanded
      ? findings
      : findings.slice(0, FINDINGS_COLLAPSE_LIMIT);

    const rows = visibleFindings.map((finding) => this.buildFindingRow(finding));
    container.replaceChildren(...rows);

    if (findings.length <= FINDINGS_COLLAPSE_LIMIT || options.expanded) {
      return;
    }

    const remainingCount = findings.length - FINDINGS_COLLAPSE_LIMIT;
    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.setAttribute('data-redactr-expand-findings', 'true');
    expandButton.textContent = `+ ${remainingCount} more`;
    expandButton.addEventListener('click', () => {
      this.renderFindingsRows(container, findings, { expanded: true });
    });
    container.append(expandButton);
  }

  private renderStatusSummary(
    warning: HTMLElement,
    findingsCount: number,
    severity: Severity
  ): void {
    const summary = warning.querySelector<HTMLElement>('[data-redactr-status-summary="true"]');
    if (!summary) {
      return;
    }

    const count = document.createElement('span');
    count.setAttribute('data-redactr-status-count', 'true');
    count.textContent = `${findingsCount} sensitive item${findingsCount === 1 ? '' : 's'}`;

    const separator = document.createElement('span');
    separator.textContent = '·';

    const severityLabel = document.createElement('span');
    severityLabel.setAttribute('data-redactr-status-severity', 'true');
    severityLabel.textContent = toSeverityLabel(severity);

    const text = document.createElement('span');
    text.setAttribute('data-redactr-status-text', 'true');
    text.append(count, separator, severityLabel);

    summary.replaceChildren(this.buildIcon('shield'), text);
  }

  private applyDismissState(warning: HTMLElement, severity: Severity): void {
    const dismissButton = warning.querySelector<HTMLButtonElement>(
      `button[${ACTION_ATTRIBUTE}='dismiss']`
    );

    if (!dismissButton) {
      return;
    }

    const dismissEnabled = isDismissEnabled(severity);
    dismissButton.disabled = !dismissEnabled;
    dismissButton.setAttribute('aria-disabled', String(!dismissEnabled));
  }

  private wireActions(container: HTMLElement): void {
    this.actionButtons = {};

    const buttons = container.querySelectorAll<HTMLButtonElement>(`button[${ACTION_ATTRIBUTE}]`);
    for (const button of buttons) {
      const action = button.getAttribute(ACTION_ATTRIBUTE) as InterventionAction | null;
      if (!action) {
        continue;
      }

      this.actionButtons[action] = button;
      button.addEventListener('click', () => {
        if (button.disabled) {
          return;
        }

        this.onAction(action);
      });
    }

    container.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }

      if (event.key === 'Escape') {
        const dismissButton = this.actionButtons.dismiss;
        if (!dismissButton || dismissButton.disabled) {
          return;
        }

        event.preventDefault();
        dismissButton.click();
        return;
      }

      if (event.key !== 'Enter') {
        return;
      }

      const activeElement = this.shadowRootRef?.activeElement;
      if (!(activeElement instanceof HTMLButtonElement)) {
        return;
      }

      const action = activeElement.getAttribute(ACTION_ATTRIBUTE) as InterventionAction | null;
      if (!action) {
        return;
      }

      event.preventDefault();
      activeElement.click();
    });
  }

  private renderWarning(model: WarningViewModel): HTMLElement {
    const warning = this.adapter.renderWarning({
      severity: model.severity,
      blocking: model.blocking,
      title: model.title,
      message: model.message,
      findings: model.findings
    });

    warning.setAttribute('aria-live', model.blocking ? 'assertive' : 'polite');
    this.renderStatusSummary(warning, model.findings.length, model.severity);
    this.applyDismissState(warning, model.severity);

    const findingsList = warning.querySelector<HTMLElement>(
      '[data-redactr-warning-findings="true"]'
    );
    if (findingsList) {
      this.renderFindingsRows(findingsList, model.findings, { expanded: false });
    }

    this.wireActions(warning);
    return warning;
  }

  show(anchor: HTMLElement, model: WarningViewModel): void {
    this.ensureHost(anchor);

    if (!this.shadowRootRef) {
      return;
    }

    const nextWarning = this.renderWarning(model);
    if (this.warningElement) {
      this.warningElement.replaceWith(nextWarning);
    } else {
      this.shadowRootRef.append(nextWarning);
    }

    this.warningElement = nextWarning;
  }

  focusPrimaryAction(): void {
    this.actionButtons.mask_send?.focus();
  }

  isVisible(): boolean {
    return Boolean(this.warningElement && this.host?.isConnected);
  }

  unmount(): void {
    this.warningElement = null;
    this.actionButtons = {};

    if (this.host) {
      this.host.remove();
    }

    this.host = null;
    this.shadowRootRef = null;
  }
}
