import type {
  IconPlacementConfig,
  PlatformId
} from '../adapters/types';
import type {
  InterventionItem,
  InterventionViewModel,
  PanelCloseReason,
  PanelOpenTrigger,
  RedactionFormat
} from './types';
import { categoryLabel, isBlockingSeverity, severityLabel } from './types';

const ICON_HOST_ATTRIBUTE = 'data-redactr-icon-host';
const PANEL_HOST_ATTRIBUTE = 'data-redactr-panel-host';
const ICON_Z_INDEX = 2147483000;
const PANEL_Z_INDEX = 2147483005;
const MODAL_Z_INDEX = 2147483010;
const PANEL_WIDTH_PX = 380;
const ICON_RIGHT_OUTSIDE_PX = -38;
const ICON_RIGHT_INSIDE_PX = 8;
const ICON_BOTTOM_PX = 8;
const DEBUG_STORAGE_KEY = 'redactr:debug';

const SEVERITY_COLOR: Record<'critical' | 'high' | 'medium' | 'low', string> = {
  critical: '#FF3B5C',
  high: '#FF9F0A',
  medium: '#FFD60A',
  low: '#6CB4EE'
};

const ICON_STYLE_TEXT = `
  :host {
    all: initial;
  }

  [data-redactr-icon-root='true'] {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #F5F5F7;
  }

  [data-redactr-icon='true'] {
    position: absolute;
    right: ${ICON_RIGHT_INSIDE_PX}px;
    bottom: ${ICON_BOTTOM_PX}px;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(26, 26, 30, 0.92);
    color: #D2D2D7;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    transition: opacity 120ms ease, box-shadow 120ms ease, transform 120ms ease;
    z-index: ${ICON_Z_INDEX};
  }

  [data-redactr-icon='true'][data-state='idle'] {
    opacity: 0.4;
    box-shadow: none;
  }

  [data-redactr-icon='true'][data-state='active'] {
    opacity: 1;
  }

  [data-redactr-icon='true'][data-blocking='true'] {
    animation: redactr-pulse 1.5s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-redactr-icon='true'][data-blocking='true'] {
      animation: none;
    }
  }

  @keyframes redactr-pulse {
    0% { transform: translateY(var(--icon-offset-y, 0px)) scale(1); }
    50% { transform: translateY(var(--icon-offset-y, 0px)) scale(1.05); }
    100% { transform: translateY(var(--icon-offset-y, 0px)) scale(1); }
  }

  [data-redactr-icon='true'] svg {
    width: 14px;
    height: 14px;
  }

  [data-redactr-badge='true'] {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    background: #FF3B5C;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    border: 1px solid rgba(0, 0, 0, 0.3);
  }
`;

const PANEL_STYLE_TEXT = `
  :host {
    all: initial;
  }

  /* TODO: light theme support */
  [data-redactr-panel-root='true'] {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #F5F5F7;
  }

  [data-redactr-panel='true'] {
    position: fixed;
    width: ${PANEL_WIDTH_PX}px;
    max-width: min(95vw, ${PANEL_WIDTH_PX}px);
    background: #1A1A1E;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    pointer-events: auto;
    z-index: ${PANEL_Z_INDEX};
  }

  [data-redactr-panel='true'][hidden='true'] {
    display: none;
  }

  [data-redactr-topline='true'] {
    height: 3px;
    background: var(--severity-color, #6CB4EE);
  }

  [data-redactr-header='true'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  [data-redactr-brand='true'] {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
  }

  [data-redactr-count='true'] {
    color: #9A9AA1;
    font-size: 12px;
  }

  [data-redactr-header-actions='true'] {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  [data-redactr-header-actions='true'] button,
  [data-redactr-footer='true'] button,
  [data-redactr-card-actions='true'] button,
  [data-redactr-modal-actions='true'] button {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #F5F5F7;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  [data-redactr-header-actions='true'] button {
    padding: 2px 6px;
  }

  [data-redactr-primary='true'] {
    background: rgba(52, 199, 89, 0.2) !important;
    border-color: rgba(52, 199, 89, 0.5) !important;
    color: #D8FFE3 !important;
  }

  [data-redactr-destructive='true'] {
    background: rgba(255, 59, 92, 0.2) !important;
    border-color: rgba(255, 59, 92, 0.5) !important;
    color: #FFDDE4 !important;
  }

  [data-redactr-muted='true'] {
    color: #C7C7CC !important;
  }

  [data-redactr-body='true'] {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 12px;
  }

  [data-redactr-body='true'][data-collapsed='true'] {
    display: none;
  }

  [data-redactr-pills='true'] {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  [data-redactr-pill='true'] {
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
  }

  [data-redactr-cards='true'] {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 360px;
    overflow: auto;
    padding-right: 2px;
  }

  [data-redactr-card='true'] {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  [data-redactr-card='true'][data-animate='enter'] {
    animation: redactr-enter 180ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-redactr-card='true'][data-animate='enter'] {
      animation: none;
    }
  }

  @keyframes redactr-enter {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: translateY(0); }
  }

  [data-redactr-card-header='true'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
  }

  [data-redactr-severity='true'] {
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 700;
    color: #101014;
  }

  [data-redactr-raw='true'] {
    margin: 0;
    padding: 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
    color: #EFEFF4;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  [data-redactr-select='true'] {
    width: 100%;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.05);
    color: #F5F5F7;
    padding: 6px 8px;
    font-size: 12px;
  }

  [data-redactr-card-actions='true'] {
    display: flex;
    gap: 8px;
  }

  [data-redactr-footer='true'] {
    display: flex;
    gap: 8px;
    position: sticky;
    bottom: 0;
    background: #1A1A1E;
    padding-top: 6px;
  }

  [data-redactr-trust='true'] {
    color: #9A9AA1;
    font-size: 11px;
  }

  [data-redactr-empty='true'] {
    font-size: 12px;
    color: #B0B0B6;
    text-align: center;
    padding: 16px 0;
  }

  [data-redactr-resolved='true'] {
    font-size: 12px;
    color: #DDE6FF;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  [data-redactr-resolved='true'][data-status='ignored'] [data-redactr-resolved-text='true'] {
    text-decoration: line-through;
    color: #B6B6BE;
  }

  [data-redactr-modal-overlay='true'] {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.58);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: ${MODAL_Z_INDEX};
    pointer-events: auto;
  }

  [data-redactr-modal-overlay='true'][data-open='true'] {
    display: flex;
  }

  [data-redactr-modal='true'] {
    width: 320px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #202028;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  [data-redactr-modal-title='true'] {
    font-size: 14px;
    font-weight: 700;
  }

  [data-redactr-modal-body='true'] {
    font-size: 12px;
    color: #D0D0D6;
    line-height: 1.35;
  }

  [data-redactr-modal-actions='true'] {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  [data-redactr-error='true'] {
    padding: 12px;
    font-size: 12px;
    color: #FFDDE4;
    background: rgba(255, 59, 92, 0.1);
  }
`;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SHIELD_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L19 6V12C19 16.5 16.3 19.3 12 21C7.7 19.3 5 16.5 5 12V6L12 3Z" fill="currentColor"/></svg>';

interface InterventionPanelCallbacks {
  onPanelOpened: (trigger: PanelOpenTrigger) => void;
  onPanelClosed: (
    reason: PanelCloseReason,
    pendingItems: number,
    durationMs: number
  ) => void;
  onRedactItem: (itemId: string, format: RedactionFormat) => void;
  onIgnoreItem: (itemId: string) => void;
  onUndoItem: (itemId: string) => void;
  onRedactAll: (itemIds: string[]) => void;
  onSubmitResolved: () => void;
  onSendAnyway: (fromConfirmation: boolean) => void;
  onReset: () => void;
}

export interface PanelMountOptions {
  iconAnchor: HTMLElement | null;
  panelPortalRoot?: HTMLElement | null;
  iconPlacement?: IconPlacementConfig;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const intersects = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const isOverflowClipping = (value: string): boolean =>
  ['auto', 'hidden', 'scroll', 'clip'].includes(value.trim().toLowerCase());

const isDebugEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const debugLog = (message: string, payload?: Record<string, unknown>): void => {
  if (!isDebugEnabled()) {
    return;
  }

  if (payload) {
    console.debug('[REDACTR][Panel]', message, payload);
    return;
  }

  console.debug('[REDACTR][Panel]', message);
};

const getPlatformOverlapCandidates = (platformId: PlatformId): HTMLElement[] => {
  const selectors =
    platformId === 'chatgpt'
      ? [
          'button[aria-label*="scroll" i]',
          'button[data-testid*="scroll" i]',
          'button[aria-label*="jump" i]'
        ]
      : [
          'button[aria-label*="attach" i]',
          '[data-testid*="attachment" i]',
          '[class*="attachment" i]'
        ];

  const items: HTMLElement[] = [];
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      items.push(element);
    }
  }

  return items;
};

export class InterventionPanel {
  private iconHost: HTMLDivElement | null = null;

  private panelHost: HTMLDivElement | null = null;

  private iconShadowRootRef: ShadowRoot | null = null;

  private panelShadowRootRef: ShadowRoot | null = null;

  private iconButton: HTMLButtonElement | null = null;

  private panelElement: HTMLDivElement | null = null;

  private modalOverlay: HTMLDivElement | null = null;

  private model: InterventionViewModel | null = null;

  private open = false;

  private collapsed = false;

  private openedAt: number | null = null;

  private lastFocusedElement: HTMLElement | null = null;

  private mountedIconAnchor: HTMLElement | null = null;

  private mountedPanelPortalRoot: HTMLElement | null = null;

  private iconOffsetY = 0;

  private previousItemIds = new Set<string>();

  private iconPlacement: IconPlacementConfig = {
    placement: 'inside-right',
    rightPx: ICON_RIGHT_INSIDE_PX,
    bottomPx: ICON_BOTTOM_PX
  };

  private readonly anchorPositionSnapshots = new Map<HTMLElement, string>();

  private anchorResizeObserver: ResizeObserver | null = null;

  private rafHandle: number | null = null;

  constructor(private readonly callbacks: InterventionPanelCallbacks) {}

  private ensureHosts(): void {
    if (!this.iconHost) {
      this.iconHost = document.createElement('div');
      this.iconHost.setAttribute(ICON_HOST_ATTRIBUTE, 'true');
      this.iconHost.style.position = 'absolute';
      this.iconHost.style.inset = '0';
      this.iconHost.style.pointerEvents = 'none';

      const shadow = this.iconHost.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ICON_STYLE_TEXT;

      const root = document.createElement('div');
      root.setAttribute('data-redactr-icon-root', 'true');

      const icon = document.createElement('button');
      icon.type = 'button';
      icon.setAttribute('data-redactr-icon', 'true');
      icon.setAttribute('aria-label', 'REDACTR: no items detected');
      icon.setAttribute('role', 'button');
      icon.innerHTML = SHIELD_ICON;

      root.append(icon);
      shadow.append(style, root);

      this.iconShadowRootRef = shadow;
      this.iconButton = icon;

      icon.addEventListener('click', () => {
        debugLog('icon_click', {
          open: this.open,
          itemCount: this.model?.items.length ?? 0
        });

        if (this.open) {
          this.close('icon_click');
          return;
        }

        this.openPanel('icon_click');
      });
    }

    if (!this.panelHost) {
      this.panelHost = document.createElement('div');
      this.panelHost.setAttribute(PANEL_HOST_ATTRIBUTE, 'true');
      this.panelHost.style.position = 'fixed';
      this.panelHost.style.inset = '0';
      this.panelHost.style.pointerEvents = 'none';
      this.panelHost.style.zIndex = String(PANEL_Z_INDEX - 1);

      const shadow = this.panelHost.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = PANEL_STYLE_TEXT;

      const root = document.createElement('div');
      root.setAttribute('data-redactr-panel-root', 'true');

      const panel = document.createElement('div');
      panel.setAttribute('data-redactr-panel', 'true');
      panel.setAttribute('hidden', 'true');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'REDACTR detection panel');
      panel.setAttribute('aria-modal', 'true');

      const modalOverlay = document.createElement('div');
      modalOverlay.setAttribute('data-redactr-modal-overlay', 'true');
      modalOverlay.setAttribute('data-open', 'false');

      root.append(panel, modalOverlay);
      shadow.append(style, root);

      this.panelShadowRootRef = shadow;
      this.panelElement = panel;
      this.modalOverlay = modalOverlay;

      document.addEventListener('mousedown', this.handleDocumentPointer, true);
      document.addEventListener('keydown', this.handleDocumentKeyDown, true);
      document.addEventListener('scroll', this.handleWindowGeometryChange, true);
      window.addEventListener('resize', this.handleWindowGeometryChange);

      if (typeof window.ResizeObserver === 'function') {
        this.anchorResizeObserver = new window.ResizeObserver(() => {
          this.scheduleLayoutRecompute();
        });
      }
    }
  }

  private readonly handleWindowGeometryChange = (): void => {
    this.scheduleLayoutRecompute();
  };

  private scheduleLayoutRecompute(): void {
    if (this.rafHandle !== null) {
      return;
    }

    this.rafHandle = window.requestAnimationFrame(() => {
      this.rafHandle = null;

      if (this.open) {
        this.positionPanel();
      }

      this.applyIconOverlapNudge();
    });
  }

  private readonly handleDocumentPointer = (event: MouseEvent): void => {
    if (!this.open) {
      return;
    }

    if (this.isEventInside(event)) {
      return;
    }

    this.close('outside_click');
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close('escape');
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const trapRoot = this.modalOverlay?.getAttribute('data-open') === 'true'
      ? this.modalOverlay
      : this.panelElement;

    if (!trapRoot) {
      return;
    }

    const focusable = [...trapRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (element) => !element.hasAttribute('disabled') && element.offsetParent !== null
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.panelShadowRootRef?.activeElement as HTMLElement | null;

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
      return;
    }

    if (event.shiftKey && (!active || active === first)) {
      event.preventDefault();
      last.focus();
    }
  };

  private isEventInside(event: Event): boolean {
    const path = event.composedPath();
    return Boolean(
      (this.iconHost && path.includes(this.iconHost)) ||
        (this.panelHost && path.includes(this.panelHost)) ||
        (this.iconButton && path.includes(this.iconButton)) ||
        (this.panelElement && path.includes(this.panelElement)) ||
        (this.modalOverlay && path.includes(this.modalOverlay))
    );
  }

  private ensureAnchorPositioning(anchor: HTMLElement): void {
    const style = window.getComputedStyle(anchor);
    if (style.position !== 'static') {
      return;
    }

    if (!this.anchorPositionSnapshots.has(anchor)) {
      this.anchorPositionSnapshots.set(anchor, anchor.style.position);
    }

    anchor.style.position = 'relative';
  }

  private restoreAnchorPosition(anchor: HTMLElement): void {
    const original = this.anchorPositionSnapshots.get(anchor);
    if (typeof original === 'undefined') {
      return;
    }

    anchor.style.position = original;
    this.anchorPositionSnapshots.delete(anchor);
  }

  private applyIconPlacement(anchor: HTMLElement): void {
    if (!this.iconButton) {
      return;
    }

    const placement = this.iconPlacement.placement;
    const bottom = this.iconPlacement.bottomPx ?? ICON_BOTTOM_PX;

    let right = this.iconPlacement.rightPx ?? ICON_RIGHT_INSIDE_PX;
    if (placement === 'outside-right') {
      const style = window.getComputedStyle(anchor);
      const clipsChildren = [style.overflow, style.overflowX, style.overflowY].some(
        isOverflowClipping
      );
      right = clipsChildren
        ? ICON_RIGHT_INSIDE_PX
        : (this.iconPlacement.rightPx ?? ICON_RIGHT_OUTSIDE_PX);
    }

    this.iconButton.style.right = `${right}px`;
    this.iconButton.style.bottom = `${bottom}px`;
  }

  mount(options: PanelMountOptions): void {
    this.ensureHosts();

    const fallbackPortalRoot = document.documentElement ?? document.body;
    const safePanelPortalRoot = options.panelPortalRoot && options.panelPortalRoot.isConnected
      ? options.panelPortalRoot
      : fallbackPortalRoot;

    const fallbackIconAnchor = document.body ?? fallbackPortalRoot;
    const safeIconAnchor = options.iconAnchor && options.iconAnchor.isConnected
      ? options.iconAnchor
      : fallbackIconAnchor;

    this.iconPlacement = options.iconPlacement ?? {
      placement: 'inside-right',
      rightPx: ICON_RIGHT_INSIDE_PX,
      bottomPx: ICON_BOTTOM_PX
    };

    if (!this.iconHost || !this.panelHost) {
      return;
    }

    if (
      this.mountedIconAnchor &&
      this.mountedIconAnchor !== safeIconAnchor
    ) {
      this.restoreAnchorPosition(this.mountedIconAnchor);
      this.anchorResizeObserver?.unobserve(this.mountedIconAnchor);
    }

    this.ensureAnchorPositioning(safeIconAnchor);

    if (
      this.mountedIconAnchor !== safeIconAnchor ||
      this.iconHost.parentElement !== safeIconAnchor
    ) {
      safeIconAnchor.append(this.iconHost);
      this.mountedIconAnchor = safeIconAnchor;
      this.anchorResizeObserver?.observe(safeIconAnchor);
    }

    if (
      this.mountedPanelPortalRoot !== safePanelPortalRoot ||
      this.panelHost.parentElement !== safePanelPortalRoot
    ) {
      safePanelPortalRoot.append(this.panelHost);
      this.mountedPanelPortalRoot = safePanelPortalRoot;
    }

    this.applyIconPlacement(safeIconAnchor);
    this.scheduleLayoutRecompute();

    debugLog('mount', {
      iconAnchorTag: safeIconAnchor.tagName,
      panelPortalTag: safePanelPortalRoot.tagName,
      placement: this.iconPlacement.placement
    });
  }

  private colorForSeverity(severity: InterventionItem['detection']['severity'] | null): string {
    if (!severity) {
      return '#6CB4EE';
    }

    return SEVERITY_COLOR[severity];
  }

  private applyIconState(model: InterventionViewModel): void {
    if (!this.iconButton) {
      return;
    }

    const hasDetections = model.items.length > 0;
    this.iconButton.setAttribute('data-state', hasDetections ? 'active' : 'idle');
    this.iconButton.setAttribute('data-blocking', String(model.blockedPendingCount > 0));
    this.iconButton.style.setProperty(
      'box-shadow',
      hasDetections
        ? `0 0 0 1px ${this.colorForSeverity(model.highestSeverity)} inset, 0 0 14px ${this.colorForSeverity(model.highestSeverity)}66`
        : 'none'
    );

    this.iconButton.style.setProperty('--icon-offset-y', `${-this.iconOffsetY}px`);
    this.iconButton.style.transform = `translateY(${-this.iconOffsetY}px)`;

    const badge = this.iconButton.querySelector('[data-redactr-badge="true"]');
    if (hasDetections) {
      if (!badge) {
        const next = document.createElement('span');
        next.setAttribute('data-redactr-badge', 'true');
        next.textContent = String(model.items.length);
        this.iconButton.append(next);
      } else {
        badge.textContent = String(model.items.length);
      }
    } else {
      badge?.remove();
    }

    const label = model.items.length
      ? `REDACTR: ${model.items.length} items detected`
      : 'REDACTR: no items detected';
    this.iconButton.setAttribute('aria-label', label);
  }

  private buildPills(model: InterventionViewModel): HTMLElement {
    const pills = document.createElement('div');
    pills.setAttribute('data-redactr-pills', 'true');

    const entries: Array<[keyof InterventionViewModel['severityCounts'], number]> = [
      ['critical', model.severityCounts.critical],
      ['high', model.severityCounts.high],
      ['medium', model.severityCounts.medium],
      ['low', model.severityCounts.low]
    ];

    for (const [severity, count] of entries) {
      if (!count) {
        continue;
      }

      const pill = document.createElement('span');
      pill.setAttribute('data-redactr-pill', 'true');
      pill.style.background = `${SEVERITY_COLOR[severity]}33`;
      pill.style.color = SEVERITY_COLOR[severity];
      pill.textContent = `${severityLabel(severity)} ${count}`;
      pills.append(pill);
    }

    return pills;
  }

  private buildItemCard(item: InterventionItem, animate: boolean): HTMLElement {
    const card = document.createElement('article');
    card.setAttribute('data-redactr-card', 'true');
    card.setAttribute('data-item-id', item.id);
    if (animate) {
      card.setAttribute('data-animate', 'enter');
    }

    if (item.status !== 'pending') {
      const resolved = document.createElement('div');
      resolved.setAttribute('data-redactr-resolved', 'true');
      resolved.setAttribute('data-status', item.status);

      const resolvedText = document.createElement('span');
      resolvedText.setAttribute('data-redactr-resolved-text', 'true');
      resolvedText.textContent =
        item.status === 'redacted'
          ? `✓ ${categoryLabel(item.detection.category)} -> ${item.selectedMask}`
          : `✕ ${categoryLabel(item.detection.category)} — ignored`;

      const undo = document.createElement('button');
      undo.type = 'button';
      undo.textContent = 'Undo';
      undo.setAttribute('aria-label', `Undo ${categoryLabel(item.detection.category)} action`);
      undo.addEventListener('click', () => {
        this.callbacks.onUndoItem(item.id);
      });

      resolved.append(resolvedText, undo);
      card.append(resolved);
      return card;
    }

    const header = document.createElement('div');
    header.setAttribute('data-redactr-card-header', 'true');

    const title = document.createElement('strong');
    title.textContent = `${categoryLabel(item.detection.category)} · ${Math.round(
      item.detection.confidence * 100
    )}%`;

    const severity = document.createElement('span');
    severity.setAttribute('data-redactr-severity', 'true');
    severity.style.background = SEVERITY_COLOR[item.detection.severity];
    severity.textContent = severityLabel(item.detection.severity).toUpperCase();

    header.append(title, severity);

    const raw = document.createElement('pre');
    raw.setAttribute('data-redactr-raw', 'true');
    raw.textContent = item.detection.text;

    const select = document.createElement('select');
    select.setAttribute('data-redactr-select', 'true');
    select.setAttribute('aria-label', `Redaction format for ${categoryLabel(item.detection.category)}`);

    for (const format of item.formats) {
      const option = document.createElement('option');
      option.value = format.id;
      option.textContent = format.label;
      select.append(option);
    }

    select.value = item.selectedFormatId;

    const actions = document.createElement('div');
    actions.setAttribute('data-redactr-card-actions', 'true');

    const redact = document.createElement('button');
    redact.type = 'button';
    redact.setAttribute('data-redactr-primary', 'true');
    redact.textContent = 'Redact';
    redact.setAttribute('aria-label', `Redact ${categoryLabel(item.detection.category)}`);
    redact.addEventListener('click', () => {
      const selected = item.formats.find((format) => format.id === select.value) ?? item.formats[0];
      if (!selected) {
        return;
      }

      this.callbacks.onRedactItem(item.id, selected);
    });

    const ignore = document.createElement('button');
    ignore.type = 'button';
    ignore.setAttribute('data-redactr-muted', 'true');
    ignore.textContent = 'Ignore';
    ignore.setAttribute('aria-label', `Ignore ${categoryLabel(item.detection.category)}`);
    ignore.addEventListener('click', () => {
      this.callbacks.onIgnoreItem(item.id);
    });

    actions.append(redact, ignore);
    card.append(header, raw, select, actions);
    return card;
  }

  private buildFooter(model: InterventionViewModel): HTMLElement {
    const footer = document.createElement('div');
    footer.setAttribute('data-redactr-footer', 'true');

    if (model.pendingCount > 0) {
      const redactAll = document.createElement('button');
      redactAll.type = 'button';
      redactAll.setAttribute('data-redactr-primary', 'true');
      redactAll.textContent = `Redact All (${model.pendingCount})`;
      redactAll.setAttribute('aria-label', `Redact all ${model.pendingCount} pending items`);
      redactAll.addEventListener('click', () => {
        const pendingItemIds = model.items
          .filter((item) => item.status === 'pending')
          .map((item) => item.id);
        this.callbacks.onRedactAll(pendingItemIds);
      });

      const sendAnyway = document.createElement('button');
      sendAnyway.type = 'button';
      sendAnyway.setAttribute('data-redactr-muted', 'true');
      sendAnyway.textContent = 'Send Anyway';
      sendAnyway.setAttribute('aria-label', 'Send prompt without resolving all pending items');
      sendAnyway.addEventListener('click', () => {
        if (model.highestSeverity && isBlockingSeverity(model.highestSeverity)) {
          this.showSendAnywayModal();
          return;
        }

        this.callbacks.onSendAnyway(false);
      });

      footer.append(redactAll, sendAnyway);
      return footer;
    }

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.setAttribute('data-redactr-primary', 'true');
    submit.textContent = model.redactedCount > 0 ? 'Send Redacted' : 'Send Original';
    submit.setAttribute('aria-label', submit.textContent);
    submit.addEventListener('click', () => {
      this.callbacks.onSubmitResolved();
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.setAttribute('data-redactr-muted', 'true');
    reset.textContent = 'Reset';
    reset.setAttribute('aria-label', 'Reset intervention decisions for this prompt');
    reset.addEventListener('click', () => {
      this.callbacks.onReset();
    });

    footer.append(submit, reset);
    return footer;
  }

  private renderModal(): void {
    if (!this.modalOverlay || !this.model) {
      return;
    }

    this.modalOverlay.replaceChildren();

    const modal = document.createElement('div');
    modal.setAttribute('data-redactr-modal', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Send with sensitive data confirmation');

    const title = document.createElement('div');
    title.setAttribute('data-redactr-modal-title', 'true');
    title.textContent = 'Send with sensitive data?';

    const body = document.createElement('div');
    body.setAttribute('data-redactr-modal-body', 'true');
    body.textContent =
      'Your prompt still includes pending sensitive items. Pending items will be sent as original text; redactions you already applied will stay applied.';

    const actions = document.createElement('div');
    actions.setAttribute('data-redactr-modal-actions', 'true');

    const back = document.createElement('button');
    back.type = 'button';
    back.setAttribute('data-redactr-primary', 'true');
    back.textContent = 'Go Back';
    back.setAttribute('aria-label', 'Go back to review detected items');
    back.addEventListener('click', () => {
      this.hideSendAnywayModal();
    });

    const send = document.createElement('button');
    send.type = 'button';
    send.setAttribute('data-redactr-destructive', 'true');
    send.textContent = 'Send Anyway';
    send.setAttribute('aria-label', 'Confirm send anyway');
    send.addEventListener('click', () => {
      this.hideSendAnywayModal();
      this.callbacks.onSendAnyway(true);
    });

    actions.append(back, send);
    modal.append(title, body, actions);
    this.modalOverlay.append(modal);
  }

  private showSendAnywayModal(): void {
    if (!this.modalOverlay) {
      return;
    }

    this.renderModal();
    this.modalOverlay.setAttribute('data-open', 'true');

    const firstFocusable = this.modalOverlay.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();
  }

  private hideSendAnywayModal(): void {
    if (!this.modalOverlay) {
      return;
    }

    this.modalOverlay.setAttribute('data-open', 'false');
    this.modalOverlay.replaceChildren();
  }

  private buildPanel(model: InterventionViewModel): HTMLElement {
    const container = document.createElement('div');

    const topLine = document.createElement('div');
    topLine.setAttribute('data-redactr-topline', 'true');
    topLine.style.setProperty('--severity-color', this.colorForSeverity(model.highestSeverity));

    const header = document.createElement('div');
    header.setAttribute('data-redactr-header', 'true');

    const brand = document.createElement('div');
    brand.setAttribute('data-redactr-brand', 'true');
    brand.textContent = 'REDACTR';

    const count = document.createElement('span');
    count.setAttribute('data-redactr-count', 'true');
    count.textContent = `${model.items.length} item${model.items.length === 1 ? '' : 's'}`;
    brand.append(count);

    const headerActions = document.createElement('div');
    headerActions.setAttribute('data-redactr-header-actions', 'true');

    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.textContent = this.collapsed ? '▸' : '▾';
    collapse.setAttribute('aria-label', this.collapsed ? 'Expand panel' : 'Collapse panel');
    collapse.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.render();
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close panel');
    close.addEventListener('click', () => {
      this.close('close_button');
    });

    headerActions.append(collapse, close);
    header.append(brand, headerActions);

    const body = document.createElement('div');
    body.setAttribute('data-redactr-body', 'true');
    body.setAttribute('data-collapsed', String(this.collapsed));

    body.append(this.buildPills(model));

    const cards = document.createElement('div');
    cards.setAttribute('data-redactr-cards', 'true');

    if (!model.items.length) {
      const empty = document.createElement('div');
      empty.setAttribute('data-redactr-empty', 'true');
      empty.textContent = 'No sensitive items detected.';
      cards.append(empty);
    } else {
      for (const item of model.items) {
        const animate = this.open && !this.previousItemIds.has(item.id);
        cards.append(this.buildItemCard(item, animate));
      }
    }

    body.append(cards, this.buildFooter(model));

    const trust = document.createElement('div');
    trust.setAttribute('data-redactr-trust', 'true');
    trust.textContent = 'local-first · no data leaves your browser';
    body.append(trust);

    container.append(topLine, header, body);
    return container;
  }

  private buildRenderErrorFallback(): HTMLElement {
    const error = document.createElement('div');
    error.setAttribute('data-redactr-error', 'true');
    error.textContent =
      'REDACTR panel failed to render. Enable debug logs (localStorage redactr:debug=1) and reload.';
    return error;
  }

  private render(): void {
    if (!this.panelElement || !this.model) {
      return;
    }

    try {
      this.panelElement.replaceChildren(this.buildPanel(this.model));
      this.previousItemIds = new Set(this.model.items.map((item) => item.id));

      if (this.open) {
        this.positionPanel();
      }

      debugLog('render', {
        open: this.open,
        hidden: this.panelElement.getAttribute('hidden'),
        itemCount: this.model.items.length
      });
    } catch (error) {
      console.error('[REDACTR] Panel render failed', error);
      this.panelElement.replaceChildren(this.buildRenderErrorFallback());
    }
  }

  private applyIconOverlapNudge(): void {
    if (!this.iconButton || !this.model) {
      return;
    }

    const iconRect = this.iconButton.getBoundingClientRect();
    const overlapCandidates = getPlatformOverlapCandidates(this.model.platformId);
    const overlap = overlapCandidates.some((candidate) => intersects(iconRect, candidate.getBoundingClientRect()));

    this.iconOffsetY = overlap ? 40 : 0;
    this.iconButton.style.setProperty('--icon-offset-y', `${-this.iconOffsetY}px`);
    this.iconButton.style.transform = `translateY(${-this.iconOffsetY}px)`;
  }

  private positionPanel(): void {
    if (!this.panelElement || !this.iconButton) {
      return;
    }

    const iconRect = this.iconButton.getBoundingClientRect();
    const panelRect = this.panelElement.getBoundingClientRect();
    const panelWidth = panelRect.width || PANEL_WIDTH_PX;
    const panelHeight = panelRect.height || 420;

    const left = clamp(iconRect.right - panelWidth, 8, window.innerWidth - panelWidth - 8);

    const belowTop = iconRect.bottom + 8;
    const hasRoomBelow = belowTop + panelHeight <= window.innerHeight - 8;

    const top = hasRoomBelow
      ? belowTop
      : clamp(iconRect.top - panelHeight - 8, 8, window.innerHeight - panelHeight - 8);

    this.panelElement.style.left = `${left}px`;
    this.panelElement.style.top = `${top}px`;

    debugLog('position_panel', {
      iconRect: {
        top: Number(iconRect.top.toFixed(2)),
        left: Number(iconRect.left.toFixed(2)),
        right: Number(iconRect.right.toFixed(2)),
        bottom: Number(iconRect.bottom.toFixed(2))
      },
      panel: {
        left,
        top,
        width: panelWidth,
        height: panelHeight,
        zIndex: PANEL_Z_INDEX
      }
    });
  }

  openPanel(trigger: PanelOpenTrigger): void {
    if (!this.panelElement || !this.model || this.open) {
      return;
    }

    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    this.open = true;
    this.openedAt = Date.now();
    this.panelElement.removeAttribute('hidden');
    this.positionPanel();
    this.callbacks.onPanelOpened(trigger);

    debugLog('open_panel', {
      trigger,
      hidden: this.panelElement.getAttribute('hidden')
    });

    const firstFocusable = this.panelElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();
  }

  close(reason: PanelCloseReason): void {
    if (!this.panelElement || !this.open || !this.model) {
      return;
    }

    this.hideSendAnywayModal();

    this.open = false;
    this.panelElement.setAttribute('hidden', 'true');

    const duration = this.openedAt ? Date.now() - this.openedAt : 0;
    this.callbacks.onPanelClosed(reason, this.model.pendingCount, duration);
    this.openedAt = null;

    (this.iconButton ?? this.lastFocusedElement)?.focus();
    this.lastFocusedElement = null;
  }

  isOpen(): boolean {
    return this.open;
  }

  update(model: InterventionViewModel): void {
    this.model = model;

    this.applyIconState(model);
    this.applyIconOverlapNudge();

    if (!this.open && this.panelElement) {
      this.render();
      return;
    }

    if (this.open) {
      this.render();
    }
  }

  cleanup(): void {
    this.hideSendAnywayModal();

    document.removeEventListener('mousedown', this.handleDocumentPointer, true);
    document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    document.removeEventListener('scroll', this.handleWindowGeometryChange, true);
    window.removeEventListener('resize', this.handleWindowGeometryChange);

    if (this.rafHandle !== null) {
      window.cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    this.anchorResizeObserver?.disconnect();
    this.anchorResizeObserver = null;

    for (const [anchor, original] of this.anchorPositionSnapshots.entries()) {
      anchor.style.position = original;
    }
    this.anchorPositionSnapshots.clear();

    this.iconHost?.remove();
    this.panelHost?.remove();

    this.iconHost = null;
    this.panelHost = null;
    this.iconShadowRootRef = null;
    this.panelShadowRootRef = null;
    this.iconButton = null;
    this.panelElement = null;
    this.modalOverlay = null;
    this.mountedIconAnchor = null;
    this.mountedPanelPortalRoot = null;
    this.model = null;
    this.open = false;
    this.iconOffsetY = 0;
  }
}
