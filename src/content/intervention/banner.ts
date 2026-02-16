import type { PlatformAdapter, WarningConfig } from '../adapters/types';
import type { InterventionAction, WarningViewModel } from './types';

const ACTION_ATTRIBUTE = 'data-redactr-action';
const HOST_ATTRIBUTE = 'data-redactr-warning-host';

const SEVERITY_COLORS: Record<WarningConfig['severity'], string> = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#CA8A04',
  low: '#2563EB'
};

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

const STYLE_TEXT = `
  :host {
    all: initial;
  }

  [data-redactr-warning='true'] {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0f172a;
    background: #ffffff;
    border: 2px solid var(--rd-accent);
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
    margin-bottom: 8px;
  }

  [data-redactr-warning-header='true'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  [data-redactr-warning-title='true'] {
    margin: 0;
    font-size: 14px;
    line-height: 1.3;
    color: var(--rd-accent);
  }

  [data-redactr-warning-message='true'] {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.4;
    color: #334155;
  }

  [data-redactr-warning-findings='true'] {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 140px;
    overflow-y: auto;
  }

  [data-redactr-warning-findings='true'] li {
    font-size: 12px;
    border: 1px solid #e2e8f0;
    border-left: 4px solid var(--rd-accent);
    border-radius: 6px;
    padding: 6px 8px;
    background: #f8fafc;
  }

  [data-redactr-warning-actions='true'] {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  button[${ACTION_ATTRIBUTE}] {
    font-family: inherit;
    font-size: 12px;
    line-height: 1.3;
    border-radius: 6px;
    border: 1px solid #94a3b8;
    background: #ffffff;
    color: #0f172a;
    padding: 6px 8px;
    cursor: pointer;
  }

  button[${ACTION_ATTRIBUTE}='mask_send'] {
    border-color: var(--rd-accent);
    background: color-mix(in oklab, var(--rd-accent) 12%, #ffffff);
  }

  button[${ACTION_ATTRIBUTE}='dismiss'] {
    font-size: 16px;
    line-height: 1;
    min-width: 30px;
    padding: 2px 8px;
  }

  button[${ACTION_ATTRIBUTE}]:focus-visible {
    outline: 2px solid #0ea5e9;
    outline-offset: 1px;
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

  private buildFindingItem(
    category: string,
    severity: WarningConfig['severity'],
    maskedPreview: string
  ): HTMLLIElement {
    const item = document.createElement('li');
    item.setAttribute('data-redactr-finding', 'true');
    item.setAttribute('data-severity', severity);
    item.textContent = `${toCategoryLabel(category)} (${severity}): ${maskedPreview}`;
    return item;
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
        this.onAction(action);
      });
    }

    container.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.onAction('dismiss');
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

    warning.style.setProperty('--rd-accent', SEVERITY_COLORS[model.severity]);
    warning.setAttribute('aria-live', model.blocking ? 'assertive' : 'polite');

    const title = warning.querySelector<HTMLElement>('[data-redactr-warning-title="true"]');
    if (title) {
      title.textContent = model.title;
    }

    const message = warning.querySelector<HTMLElement>('[data-redactr-warning-message="true"]');
    if (message) {
      message.textContent = model.message;
    }

    const findingsList = warning.querySelector<HTMLElement>(
      '[data-redactr-warning-findings="true"]'
    );
    if (findingsList) {
      findingsList.replaceChildren(
        ...model.findings.map((finding) =>
          this.buildFindingItem(
            finding.category,
            finding.severity,
            finding.maskedPreview
          )
        )
      );
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
