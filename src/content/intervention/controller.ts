import type { PlatformAdapter } from '../adapters/types';
import type { DetectionResult, Severity } from '../pii/types';
import { createInterventionEvent, type PIIEvent } from '../../shared/events';
import {
  getAllowlistEntries,
  isDetectionAllowlisted,
  type AllowlistEntry
} from '../../shared/storage';
import { InterventionPanel } from './panel';
import { buildRedactionFormats } from './redaction-formats';
import {
  buildDetectionIdentity,
  type InterventionItem,
  type InterventionViewModel,
  type PersistedItemState,
  summarizeIntervention
} from './types';

const INTERCEPT_DEBOUNCE_MS = 200;

interface InterventionControllerOptions {
  adapter: PlatformAdapter;
  sessionId: string;
  sendEvent: (event: PIIEvent) => Promise<void>;
}

interface SubmitButtonStyleSnapshot {
  opacity: string;
  filter: string;
  cursor: string;
}

const compareDetections = (left: DetectionResult, right: DetectionResult): number => {
  if (left.startIndex !== right.startIndex) {
    return left.startIndex - right.startIndex;
  }

  return right.endIndex - left.endIndex;
};

const highestSeverityFromItems = (items: InterventionItem[]): Severity | null => {
  for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
    if (items.some((item) => item.detection.severity === severity)) {
      return severity;
    }
  }

  return null;
};

export class InterventionController {
  private readonly adapter: PlatformAdapter;

  private readonly sessionId: string;

  private readonly sendEvent: (event: PIIEvent) => Promise<void>;

  private readonly panel: InterventionPanel;

  private latestText = '';

  private activeItems: InterventionItem[] = [];

  private allowlistEntries: AllowlistEntry[] = [];

  private itemStateMap = new Map<string, PersistedItemState>();

  private bypassNextSubmit = false;

  private lastInterceptedAt = 0;

  private interventionStartedAt: number | null = null;

  private dimmedSubmitButton: HTMLElement | null = null;

  private dimmedSubmitButtonStyle: SubmitButtonStyleSnapshot | null = null;

  constructor(options: InterventionControllerOptions) {
    this.adapter = options.adapter;
    this.sessionId = options.sessionId;
    this.sendEvent = options.sendEvent;

    this.panel = new InterventionPanel({
      onPanelOpened: (trigger) => {
        const model = this.buildViewModel();
        void this.emitEvent('panel_opened', {
          detection_count: model.items.length,
          highest_severity: model.highestSeverity ?? undefined,
          trigger
        });
      },
      onPanelClosed: (reason, pendingItems, durationMs) => {
        const model = this.buildViewModel();

        void this.emitEvent('panel_closed', {
          close_reason: reason,
          pending_items: pendingItems,
          duration_ms: durationMs
        });

        if (pendingItems > 0) {
          void this.emitEvent('warning_dismissed', {
            pending_items: pendingItems,
            highest_severity: model.highestSeverity ?? undefined
          });
        }
      },
      onRedactItem: (itemId, format) => {
        const item = this.getItem(itemId);
        if (!item) {
          return;
        }

        item.status = 'redacted';
        item.selectedFormatId = format.id;
        item.selectedMask = format.mask;

        this.itemStateMap.set(item.id, {
          status: item.status,
          selectedFormatId: item.selectedFormatId,
          selectedMask: item.selectedMask
        });

        void this.emitEvent('pii_item_redacted', {
          category: item.detection.category,
          severity: item.detection.severity,
          confidence: item.detection.confidence,
          redaction_format: format.label
        });

        this.render();
      },
      onIgnoreItem: (itemId) => {
        const item = this.getItem(itemId);
        if (!item) {
          return;
        }

        item.status = 'ignored';

        this.itemStateMap.set(item.id, {
          status: item.status,
          selectedFormatId: item.selectedFormatId,
          selectedMask: item.selectedMask
        });

        void this.emitEvent('pii_item_ignored', {
          category: item.detection.category,
          severity: item.detection.severity,
          confidence: item.detection.confidence
        });

        this.render();
      },
      onUndoItem: (itemId) => {
        const item = this.getItem(itemId);
        if (!item) {
          return;
        }

        item.status = 'pending';
        this.itemStateMap.set(item.id, {
          status: item.status,
          selectedFormatId: item.selectedFormatId,
          selectedMask: item.selectedMask
        });

        this.render();
      },
      onRedactAll: (itemIds) => {
        const touched: InterventionItem[] = [];

        for (const itemId of itemIds) {
          const item = this.getItem(itemId);
          if (!item || item.status !== 'pending') {
            continue;
          }

          const { defaultFormatId, formats } = buildRedactionFormats(item.detection);
          const selected =
            formats.find((entry) => entry.id === defaultFormatId) ?? formats[0];
          if (!selected) {
            continue;
          }

          item.status = 'redacted';
          item.selectedFormatId = selected.id;
          item.selectedMask = selected.mask;

          this.itemStateMap.set(item.id, {
            status: item.status,
            selectedFormatId: item.selectedFormatId,
            selectedMask: item.selectedMask
          });

          touched.push(item);
        }

        if (!touched.length) {
          return;
        }

        void this.emitEvent('pii_batch_redacted', {
          item_count: touched.length,
          categories: touched.map((item) => item.detection.category),
          severities: touched.map((item) => item.detection.severity)
        });

        this.render();
      },
      onSubmitResolved: () => {
        this.submitFromPanel({ sendAnywayConfirmed: false });
      },
      onSendAnyway: (fromConfirmation) => {
        this.submitFromPanel({ sendAnywayConfirmed: fromConfirmation });
      },
      onReset: () => {
        for (const item of this.activeItems) {
          item.status = 'pending';
          this.itemStateMap.set(item.id, {
            status: item.status,
            selectedFormatId: item.selectedFormatId,
            selectedMask: item.selectedMask
          });
        }

        this.render();
      }
    });

    void this.refreshAllowlist();
    this.syncUiAnchors();
    this.render();
  }

  private getItem(itemId: string): InterventionItem | undefined {
    return this.activeItems.find((item) => item.id === itemId);
  }

  private async emitEvent(
    eventType: Parameters<typeof createInterventionEvent>[0]['eventType'],
    payload: Parameters<typeof createInterventionEvent>[0]['payload']
  ): Promise<void> {
    await this.sendEvent(
      createInterventionEvent({
        eventType,
        platform: this.adapter.platformId,
        sessionId: this.sessionId,
        payload
      })
    );
  }

  private async refreshAllowlist(): Promise<void> {
    this.allowlistEntries = await getAllowlistEntries();
  }

  syncUiAnchors(): void {
    const iconAnchor = this.adapter.getIconAnchor() ?? this.adapter.getInputAreaWrapper();
    const panelPortalRoot = document.documentElement ?? document.body;
    this.panel.mount({
      iconAnchor,
      panelPortalRoot,
      iconPlacement: this.adapter.getIconPlacement()
    });
  }

  private buildViewModel(): InterventionViewModel {
    const summary = summarizeIntervention(this.activeItems);

    return {
      platformId: this.adapter.platformId,
      items: [...this.activeItems],
      ...summary
    };
  }

  private render(): void {
    this.syncUiAnchors();

    const model = this.buildViewModel();
    this.panel.update(model);
    this.updateSubmitButtonDimmedState(model.blockedPendingCount > 0);
  }

  private updateSubmitButtonDimmedState(blocked: boolean): void {
    const submitButton = this.adapter.getSubmitButton();

    if (!blocked) {
      this.restoreSubmitButtonStyle();
      return;
    }

    if (!submitButton) {
      return;
    }

    if (this.dimmedSubmitButton && this.dimmedSubmitButton !== submitButton) {
      this.restoreSubmitButtonStyle();
    }

    if (!this.dimmedSubmitButtonStyle) {
      this.dimmedSubmitButtonStyle = {
        opacity: submitButton.style.opacity,
        filter: submitButton.style.filter,
        cursor: submitButton.style.cursor
      };
    }

    this.dimmedSubmitButton = submitButton;
    submitButton.style.opacity = '0.45';
    submitButton.style.filter = 'grayscale(0.2)';
    submitButton.style.cursor = 'not-allowed';
    submitButton.setAttribute('data-redactr-submit-dimmed', 'true');
    submitButton.setAttribute('aria-disabled', 'true');
  }

  private restoreSubmitButtonStyle(): void {
    if (!this.dimmedSubmitButton) {
      return;
    }

    const snapshot = this.dimmedSubmitButtonStyle;

    if (snapshot) {
      this.dimmedSubmitButton.style.opacity = snapshot.opacity;
      this.dimmedSubmitButton.style.filter = snapshot.filter;
      this.dimmedSubmitButton.style.cursor = snapshot.cursor;
    }

    this.dimmedSubmitButton.removeAttribute('data-redactr-submit-dimmed');
    this.dimmedSubmitButton.removeAttribute('aria-disabled');

    this.dimmedSubmitButton = null;
    this.dimmedSubmitButtonStyle = null;
  }

  private clearPromptState(): void {
    this.activeItems = [];
    this.itemStateMap.clear();
    this.interventionStartedAt = null;
    this.render();
  }

  private createItemFromDetection(
    detection: DetectionResult,
    occurrence: number,
    previousState: PersistedItemState | undefined
  ): InterventionItem {
    const identity = buildDetectionIdentity(detection, occurrence);
    const { formats, defaultFormatId } = buildRedactionFormats(detection);

    const formatFromState = previousState
      ? formats.find((entry) => entry.id === previousState.selectedFormatId)
      : null;

    const fallbackFormat = formats.find((entry) => entry.id === defaultFormatId) ?? formats[0];

    const selectedFormat = formatFromState ?? fallbackFormat;

    return {
      id: identity.key,
      identity,
      detection,
      status: previousState?.status ?? 'pending',
      selectedFormatId: selectedFormat?.id ?? defaultFormatId,
      selectedMask: formatFromState?.mask ?? previousState?.selectedMask ?? selectedFormat?.mask ?? detection.suggestedMask,
      formats
    };
  }

  private rebuildItems(detections: DetectionResult[]): InterventionItem[] {
    const nextItems: InterventionItem[] = [];
    const groupCounters = new Map<string, number>();

    const sorted = [...detections].sort(compareDetections);

    for (const detection of sorted) {
      const groupKey = `${detection.category}:${detection.text}`;
      const nextOccurrence = groupCounters.get(groupKey) ?? 0;
      groupCounters.set(groupKey, nextOccurrence + 1);

      const identity = buildDetectionIdentity(detection, nextOccurrence);
      const previousState = this.itemStateMap.get(identity.key);

      nextItems.push(this.createItemFromDetection(detection, nextOccurrence, previousState));
    }

    const nextStateMap = new Map<string, PersistedItemState>();
    for (const item of nextItems) {
      nextStateMap.set(item.id, {
        status: item.status,
        selectedFormatId: item.selectedFormatId,
        selectedMask: item.selectedMask
      });
    }

    this.itemStateMap = nextStateMap;

    return nextItems;
  }

  private applySelectedRedactions(
    baseText: string,
    items: InterventionItem[]
  ): string {
    const redacted = items
      .filter((item) => item.status === 'redacted')
      .sort((left, right) => right.detection.startIndex - left.detection.startIndex);

    let result = baseText;

    for (const item of redacted) {
      const { startIndex, endIndex } = item.detection;

      if (startIndex < 0 || endIndex <= startIndex || endIndex > result.length) {
        continue;
      }

      result = result.slice(0, startIndex) + item.selectedMask + result.slice(endIndex);
    }

    return result;
  }

  private updateInputText(nextText: string): void {
    const input = this.adapter.detectInputElement();
    if (!input) {
      return;
    }

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      input.value = nextText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    input.textContent = nextText;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private submitWithBypass(): void {
    this.bypassNextSubmit = true;

    const submitButton = this.adapter.getSubmitButton();
    if (submitButton) {
      submitButton.click();
      return;
    }

    const input = this.adapter.detectInputElement();
    if (!input) {
      return;
    }

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      })
    );
  }

  private submitFromPanel(options: { sendAnywayConfirmed: boolean }): void {
    if (!this.activeItems.length) {
      return;
    }

    const model = this.buildViewModel();
    const updatedText = this.applySelectedRedactions(this.latestText, this.activeItems);

    if (updatedText !== this.latestText) {
      this.latestText = updatedText;
      this.updateInputText(updatedText);
    }

    const actionLatencyMs =
      this.interventionStartedAt === null
        ? undefined
        : Date.now() - this.interventionStartedAt;

    void this.emitEvent('submit_confirmed', {
      redacted_count: model.redactedCount,
      ignored_count: model.ignoredCount,
      total_detected: model.items.length,
      action_latency_ms: actionLatencyMs
    });

    if (options.sendAnywayConfirmed) {
      void this.emitEvent('send_anyway_confirmed', {
        highest_severity: highestSeverityFromItems(this.activeItems) ?? undefined,
        item_count: model.pendingCount
      });
    }

    this.submitWithBypass();
    this.clearPromptState();
  }

  onScanResult(text: string, detections: DetectionResult[]): void {
    this.latestText = text;

    if (!text.length) {
      this.clearPromptState();
      return;
    }

    const filteredDetections = detections.filter((detection) => {
      if (detection.decision === 'ignore') {
        return false;
      }

      return !isDetectionAllowlisted(detection, this.allowlistEntries);
    });

    this.activeItems = this.rebuildItems(filteredDetections);

    if (this.activeItems.length && this.interventionStartedAt === null) {
      this.interventionStartedAt = Date.now();
    }

    if (!this.activeItems.length) {
      this.interventionStartedAt = null;
    }

    this.render();
  }

  onSubmitAttempt(_event: Event): boolean {
    if (this.bypassNextSubmit) {
      this.bypassNextSubmit = false;
      return true;
    }

    const model = this.buildViewModel();

    if (model.blockedPendingCount === 0) {
      return true;
    }

    const now = Date.now();
    if (now - this.lastInterceptedAt >= INTERCEPT_DEBOUNCE_MS) {
      this.lastInterceptedAt = now;
      void this.emitEvent('submit_intercepted', {
        highest_severity: model.highestSeverity ?? undefined,
        pending_count: model.blockedPendingCount
      });
    }

    if (!this.panel.isOpen()) {
      this.panel.openPanel('blocked_submit');
    }

    return false;
  }

  cleanup(): void {
    this.restoreSubmitButtonStyle();
    this.panel.cleanup();
    this.activeItems = [];
    this.itemStateMap.clear();
  }
}
