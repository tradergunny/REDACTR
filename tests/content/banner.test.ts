import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InterventionPanel } from '../../src/content/intervention/panel';
import type { InterventionItem, InterventionViewModel, RedactionFormat } from '../../src/content/intervention/types';
import type { DetectionResult } from '../../src/content/pii/types';

const formatOptions: RedactionFormat[] = [
  { id: 'token', label: '[EMAIL]', mask: '[EMAIL]' },
  { id: 'partial', label: 'j***@example.com', mask: 'j***@example.com' },
  { id: 'redacted', label: '[REDACTED]', mask: '[REDACTED]' }
];

const baseDetection: DetectionResult = {
  text: 'john@example.com',
  category: 'email',
  severity: 'medium',
  confidence: 0.91,
  startIndex: 0,
  endIndex: 16,
  suggestedMask: 'j***@example.com',
  rule: 'email.pattern',
  validationStage: 'validated',
  decision: 'warn',
  scoreSignals: [],
  scoreBreakdown: {
    baseConfidence: 0.9,
    contextBonus: 0,
    signalDelta: 0.01,
    codePenalty: 0,
    finalConfidence: 0.91
  }
};

const buildItem = (overrides: Partial<InterventionItem> = {}): InterventionItem => ({
  id: 'email:john@example.com:0',
  identity: {
    groupKey: 'email:john@example.com',
    occurrence: 0,
    key: 'email:john@example.com:0'
  },
  detection: baseDetection,
  status: 'pending',
  selectedFormatId: 'partial',
  selectedMask: 'j***@example.com',
  formats: formatOptions,
  ...overrides
});

const buildModel = (items: InterventionItem[] = []): InterventionViewModel => ({
  platformId: 'chatgpt',
  items,
  highestSeverity: items.length ? items[0].detection.severity : null,
  pendingCount: items.filter((item) => item.status === 'pending').length,
  redactedCount: items.filter((item) => item.status === 'redacted').length,
  ignoredCount: items.filter((item) => item.status === 'ignored').length,
  blockedPendingCount: items.filter(
    (item) => item.status === 'pending' && (item.detection.severity === 'critical' || item.detection.severity === 'high')
  ).length,
  severityCounts: {
    critical: items.filter((item) => item.detection.severity === 'critical').length,
    high: items.filter((item) => item.detection.severity === 'high').length,
    medium: items.filter((item) => item.detection.severity === 'medium').length,
    low: items.filter((item) => item.detection.severity === 'low').length
  }
});

const getIconShadow = (): ShadowRoot => {
  const host = document.querySelector<HTMLElement>('[data-redactr-icon-host="true"]');
  const shadow = host?.shadowRoot;

  if (!shadow) {
    throw new Error('icon shadow root missing');
  }

  return shadow;
};

const getPanelShadow = (): ShadowRoot => {
  const host = document.querySelector<HTMLElement>('[data-redactr-panel-host="true"]');
  const shadow = host?.shadowRoot;

  if (!shadow) {
    throw new Error('panel shadow root missing');
  }

  return shadow;
};

describe('InterventionPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="anchor"></div>';
  });

  it('renders idle icon state in shadow dom with z-index tiers in styles', () => {
    const callbacks = {
      onPanelOpened: vi.fn(),
      onPanelClosed: vi.fn(),
      onRedactItem: vi.fn(),
      onIgnoreItem: vi.fn(),
      onUndoItem: vi.fn(),
      onRedactAll: vi.fn(),
      onSubmitResolved: vi.fn(),
      onSendAnyway: vi.fn(),
      onReset: vi.fn()
    };

    const panel = new InterventionPanel(callbacks);
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor missing');
    }

    panel.mount({
      iconAnchor: anchor,
      panelPortalRoot: document.documentElement
    });
    panel.update(buildModel([]));

    const iconShadow = getIconShadow();
    const panelShadow = getPanelShadow();
    const icon = iconShadow.querySelector<HTMLElement>('[data-redactr-icon="true"]');
    const iconStyle = iconShadow.querySelector('style');
    const panelStyle = panelShadow.querySelector('style');

    expect(icon?.getAttribute('data-state')).toBe('idle');
    expect(iconStyle?.textContent).toContain('z-index: 2147483000');
    expect(panelStyle?.textContent).toContain('z-index: 2147483005');
    expect(panelStyle?.textContent).toContain('z-index: 2147483010');
    expect(panelStyle?.textContent).toContain('TODO: light theme support');

    panel.cleanup();
  });

  it('keeps icon inside clipping anchors to avoid overflow cut-off', () => {
    const callbacks = {
      onPanelOpened: vi.fn(),
      onPanelClosed: vi.fn(),
      onRedactItem: vi.fn(),
      onIgnoreItem: vi.fn(),
      onUndoItem: vi.fn(),
      onRedactAll: vi.fn(),
      onSubmitResolved: vi.fn(),
      onSendAnyway: vi.fn(),
      onReset: vi.fn()
    };

    const panel = new InterventionPanel(callbacks);
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor missing');
    }

    anchor.style.overflow = 'auto';

    panel.mount({
      iconAnchor: anchor,
      panelPortalRoot: document.documentElement
    });
    panel.update(buildModel([]));

    const iconShadow = getIconShadow();
    const icon = iconShadow.querySelector<HTMLElement>('[data-redactr-icon="true"]');

    expect(icon?.style.right).toBe('8px');

    panel.cleanup();
  });

  it('shows badge and toggles panel open/close from icon', () => {
    const callbacks = {
      onPanelOpened: vi.fn(),
      onPanelClosed: vi.fn(),
      onRedactItem: vi.fn(),
      onIgnoreItem: vi.fn(),
      onUndoItem: vi.fn(),
      onRedactAll: vi.fn(),
      onSubmitResolved: vi.fn(),
      onSendAnyway: vi.fn(),
      onReset: vi.fn()
    };

    const panel = new InterventionPanel(callbacks);
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor missing');
    }

    panel.mount({
      iconAnchor: anchor,
      panelPortalRoot: document.documentElement
    });
    panel.update(buildModel([buildItem()]));

    const iconShadow = getIconShadow();
    const panelShadow = getPanelShadow();
    const icon = iconShadow.querySelector<HTMLButtonElement>('button[data-redactr-icon="true"]');
    const panelElement = panelShadow.querySelector<HTMLElement>('[data-redactr-panel="true"]');

    if (!icon || !panelElement) {
      throw new Error('icon/panel missing');
    }

    expect(iconShadow.querySelector('[data-redactr-badge="true"]')?.textContent).toBe('1');

    icon.click();
    expect(callbacks.onPanelOpened).toHaveBeenCalledWith('icon_click');
    expect(panelElement.hasAttribute('hidden')).toBe(false);

    icon.click();
    expect(callbacks.onPanelClosed).toHaveBeenCalled();
    expect(panelElement.getAttribute('hidden')).toBe('true');

    panel.cleanup();
  });

  it('closes on outside click and Escape', () => {
    const callbacks = {
      onPanelOpened: vi.fn(),
      onPanelClosed: vi.fn(),
      onRedactItem: vi.fn(),
      onIgnoreItem: vi.fn(),
      onUndoItem: vi.fn(),
      onRedactAll: vi.fn(),
      onSubmitResolved: vi.fn(),
      onSendAnyway: vi.fn(),
      onReset: vi.fn()
    };

    const panel = new InterventionPanel(callbacks);
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor missing');
    }

    panel.mount({
      iconAnchor: anchor,
      panelPortalRoot: document.documentElement
    });
    panel.update(buildModel([buildItem()]));

    const iconShadow = getIconShadow();
    const icon = iconShadow.querySelector<HTMLButtonElement>('button[data-redactr-icon="true"]');
    if (!icon) {
      throw new Error('icon missing');
    }

    icon.click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(callbacks.onPanelClosed).toHaveBeenCalled();

    icon.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(callbacks.onPanelClosed).toHaveBeenCalledTimes(2);

    panel.cleanup();
  });

  it('shows explicit send-anyway modal copy for critical/high', () => {
    const callbacks = {
      onPanelOpened: vi.fn(),
      onPanelClosed: vi.fn(),
      onRedactItem: vi.fn(),
      onIgnoreItem: vi.fn(),
      onUndoItem: vi.fn(),
      onRedactAll: vi.fn(),
      onSubmitResolved: vi.fn(),
      onSendAnyway: vi.fn(),
      onReset: vi.fn()
    };

    const criticalItem = buildItem({
      id: 'ssn:123-45-6789:0',
      identity: {
        groupKey: 'ssn:123-45-6789',
        occurrence: 0,
        key: 'ssn:123-45-6789:0'
      },
      detection: {
        ...baseDetection,
        text: '123-45-6789',
        category: 'ssn',
        severity: 'critical',
        confidence: 0.99,
        suggestedMask: '***-**-6789'
      },
      selectedFormatId: 'token',
      selectedMask: '[SSN]',
      formats: [
        { id: 'token', label: '[SSN]', mask: '[SSN]' },
        { id: 'partial', label: '***-**-6789', mask: '***-**-6789' },
        { id: 'redacted', label: '[REDACTED]', mask: '[REDACTED]' }
      ]
    });

    const panel = new InterventionPanel(callbacks);
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor missing');
    }

    panel.mount({
      iconAnchor: anchor,
      panelPortalRoot: document.documentElement
    });
    panel.update(buildModel([criticalItem]));

    const iconShadow = getIconShadow();
    const panelShadow = getPanelShadow();
    const icon = iconShadow.querySelector<HTMLButtonElement>('button[data-redactr-icon="true"]');
    icon?.click();

    const sendAnyway = panelShadow.querySelector<HTMLButtonElement>('[data-redactr-footer="true"] button[data-redactr-muted="true"]');
    sendAnyway?.click();

    const modalText = panelShadow.querySelector('[data-redactr-modal-body="true"]')?.textContent ?? '';

    expect(modalText).toContain('Pending items will be sent as original text');
    expect(modalText).toContain('already applied will stay applied');

    panel.cleanup();
  });

  it('positions panel above icon when there is insufficient viewport space below', () => {
    const callbacks = {
      onPanelOpened: vi.fn(),
      onPanelClosed: vi.fn(),
      onRedactItem: vi.fn(),
      onIgnoreItem: vi.fn(),
      onUndoItem: vi.fn(),
      onRedactAll: vi.fn(),
      onSubmitResolved: vi.fn(),
      onSendAnyway: vi.fn(),
      onReset: vi.fn()
    };

    const panel = new InterventionPanel(callbacks);
    const anchor = document.querySelector<HTMLElement>('#anchor');
    if (!anchor) {
      throw new Error('anchor missing');
    }

    panel.mount({
      iconAnchor: anchor,
      panelPortalRoot: document.documentElement
    });
    panel.update(buildModel([buildItem()]));

    const iconShadow = getIconShadow();
    const panelShadow = getPanelShadow();
    const icon = iconShadow.querySelector<HTMLButtonElement>('button[data-redactr-icon="true"]');
    const panelElement = panelShadow.querySelector<HTMLDivElement>('[data-redactr-panel="true"]');

    if (!icon || !panelElement) {
      throw new Error('icon/panel missing');
    }

    const initialViewportHeight = window.innerHeight;

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 480
    });

    vi.spyOn(icon, 'getBoundingClientRect').mockReturnValue({
      x: 900,
      y: 430,
      width: 28,
      height: 28,
      top: 430,
      right: 928,
      bottom: 458,
      left: 900,
      toJSON: () => ({})
    } as DOMRect);

    vi.spyOn(panelElement, 'getBoundingClientRect').mockReturnValue({
      x: 560,
      y: 0,
      width: 360,
      height: 320,
      top: 0,
      right: 920,
      bottom: 320,
      left: 560,
      toJSON: () => ({})
    } as DOMRect);

    icon.click();

    const topValue = Number((panelElement.style.top || '0').replace('px', ''));
    expect(topValue).toBeLessThan(430);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: initialViewportHeight
    });

    panel.cleanup();
  });
});
