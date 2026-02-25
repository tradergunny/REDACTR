import type { PlatformAdapter, TextReplacement } from '../adapters/types';
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

interface ResolvedRedactionResult {
  text: string;
  replacements: TextReplacement[];
}

const applyReplacementsToString = (
  sourceText: string,
  replacements: TextReplacement[]
): string | null => {
  const ordered = [...replacements].sort((left, right) => right.startIndex - left.startIndex);
  let current = sourceText;

  for (const replacement of ordered) {
    if (
      replacement.startIndex < 0 ||
      replacement.endIndex <= replacement.startIndex ||
      replacement.endIndex > current.length
    ) {
      return null;
    }

    if (current.slice(replacement.startIndex, replacement.endIndex) !== replacement.expectedText) {
      return null;
    }

    current =
      current.slice(0, replacement.startIndex) +
      replacement.replacementText +
      current.slice(replacement.endIndex);
  }

  return current;
};

const buildDiffReplacement = (
  currentText: string,
  nextText: string
): TextReplacement[] => {
  if (currentText === nextText) {
    return [];
  }

  let prefixLength = 0;
  const maxPrefix = Math.min(currentText.length, nextText.length);
  while (
    prefixLength < maxPrefix &&
    currentText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let currentSuffixStart = currentText.length;
  let nextSuffixStart = nextText.length;
  while (
    currentSuffixStart > prefixLength &&
    nextSuffixStart > prefixLength &&
    currentText[currentSuffixStart - 1] === nextText[nextSuffixStart - 1]
  ) {
    currentSuffixStart -= 1;
    nextSuffixStart -= 1;
  }

  return [
    {
      startIndex: prefixLength,
      endIndex: currentSuffixStart,
      expectedText: currentText.slice(prefixLength, currentSuffixStart),
      replacementText: nextText.slice(prefixLength, nextSuffixStart)
    }
  ];
};

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

  private baselineText: string | null = null;

  private pendingProgrammaticText: string | null = null;

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

        if (this.isContentEditableInput()) {
          const applied = this.applyContentEditableRedact(item, format.id, format.mask);
          if (!applied) {
            this.render();
            return;
          }

          void this.emitEvent('pii_item_redacted', {
            category: item.detection.category,
            severity: item.detection.severity,
            confidence: item.detection.confidence,
            redaction_format: format.label
          });

          this.render();
          return;
        }

        item.status = 'redacted';
        item.selectedFormatId = format.id;
        item.selectedMask = format.mask;

        this.persistItemState(item);

        void this.emitEvent('pii_item_redacted', {
          category: item.detection.category,
          severity: item.detection.severity,
          confidence: item.detection.confidence,
          redaction_format: format.label
        });

        this.applyImmediatePreviewFromCurrentState();
        this.render();
      },
      onIgnoreItem: (itemId) => {
        const item = this.getItem(itemId);
        if (!item) {
          return;
        }

        item.status = 'ignored';
        item.liveRange = undefined;
        item.liveExpectedText = undefined;
        this.persistItemState(item);

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

        if (this.isContentEditableInput()) {
          if (item.status === 'ignored') {
            item.status = 'pending';
            item.liveRange = undefined;
            item.liveExpectedText = undefined;
            this.persistItemState(item);
            this.render();
            return;
          }

          if (item.status === 'redacted') {
            const undone = this.applyContentEditableUndo(item);
            if (!undone) {
              this.render();
              return;
            }
          }

          this.render();
          return;
        }

        item.status = 'pending';
        this.persistItemState(item);

        this.applyImmediatePreviewFromCurrentState();
        this.render();
      },
      onRedactAll: (itemIds) => {
        if (this.isContentEditableInput()) {
          const touched = this.applyContentEditableRedactAll(itemIds);
          if (!touched.length) {
            this.render();
            return;
          }

          void this.emitEvent('pii_batch_redacted', {
            item_count: touched.length,
            categories: touched.map((item) => item.detection.category),
            severities: touched.map((item) => item.detection.severity)
          });

          this.render();
          return;
        }

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

          this.persistItemState(item);

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

        this.applyImmediatePreviewFromCurrentState();
        this.render();
      },
      onSubmitResolved: () => {
        this.submitFromPanel({ sendAnywayConfirmed: false });
      },
      onSendAnyway: (fromConfirmation) => {
        this.submitFromPanel({ sendAnywayConfirmed: fromConfirmation });
      },
      onReset: () => {
        if (this.isContentEditableInput()) {
          this.applyContentEditableReset();
          this.render();
          return;
        }

        for (const item of this.activeItems) {
          item.status = 'pending';
          this.persistItemState(item);
        }

        this.applyImmediatePreviewFromCurrentState();
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

  private isContentEditableInput(): boolean {
    return this.adapter.getInputType() === 'contenteditable';
  }

  private persistItemState(item: InterventionItem): void {
    this.itemStateMap.set(item.id, {
      status: item.status,
      selectedFormatId: item.selectedFormatId,
      selectedMask: item.selectedMask,
      liveRange: item.liveRange
        ? {
            startIndex: item.liveRange.startIndex,
            endIndex: item.liveRange.endIndex
          }
        : undefined,
      liveExpectedText: item.liveExpectedText
    });
  }

  private persistAllItemStates(): void {
    const next = new Map<string, PersistedItemState>();

    for (const item of this.activeItems) {
      next.set(item.id, {
        status: item.status,
        selectedFormatId: item.selectedFormatId,
        selectedMask: item.selectedMask,
        liveRange: item.liveRange
          ? {
              startIndex: item.liveRange.startIndex,
              endIndex: item.liveRange.endIndex
            }
          : undefined,
        liveExpectedText: item.liveExpectedText
      });
    }

    this.itemStateMap = next;
  }

  private shiftItemRangesAfter(pivotIndex: number, delta: number, skippedItemId: string): void {
    if (delta === 0) {
      return;
    }

    for (const item of this.activeItems) {
      if (item.id === skippedItemId) {
        continue;
      }

      if (item.detection.startIndex >= pivotIndex) {
        item.detection = {
          ...item.detection,
          startIndex: item.detection.startIndex + delta,
          endIndex: item.detection.endIndex + delta
        };
      }

      if (item.liveRange && item.liveRange.startIndex >= pivotIndex) {
        item.liveRange = {
          startIndex: item.liveRange.startIndex + delta,
          endIndex: item.liveRange.endIndex + delta
        };
      }
    }
  }

  private applyContentEditableReplacements(
    baseText: string,
    replacements: TextReplacement[]
  ): { applied: boolean; nextText: string } {
    const nextText = applyReplacementsToString(baseText, replacements);
    if (nextText === null) {
      return {
        applied: false,
        nextText: baseText
      };
    }

    this.pendingProgrammaticText = nextText;
    this.latestText = nextText;
    this.baselineText = nextText;

    const applied = this.adapter.applyTextReplacements(baseText, replacements);
    if (!applied) {
      this.pendingProgrammaticText = null;
      this.latestText = baseText;
      this.baselineText = baseText;
      return {
        applied: false,
        nextText: baseText
      };
    }

    const captured = this.adapter.captureText();
    if (captured !== nextText) {
      this.pendingProgrammaticText = null;
      this.latestText = captured;
      this.baselineText = captured;
      return {
        applied: false,
        nextText: captured
      };
    }

    return {
      applied: true,
      nextText
    };
  }

  private applyContentEditableRedact(
    item: InterventionItem,
    selectedFormatId: string,
    selectedMask: string
  ): boolean {
    const baseText = this.latestText;
    const startIndex = item.detection.startIndex;
    const endIndex = item.detection.endIndex;
    const expectedText = item.detection.text;

    const replacement: TextReplacement = {
      startIndex,
      endIndex,
      expectedText,
      replacementText: selectedMask
    };

    const { applied } = this.applyContentEditableReplacements(baseText, [replacement]);
    if (!applied) {
      return false;
    }

    const delta = selectedMask.length - expectedText.length;
    this.shiftItemRangesAfter(endIndex, delta, item.id);

    item.status = 'redacted';
    item.selectedFormatId = selectedFormatId;
    item.selectedMask = selectedMask;
    item.liveRange = {
      startIndex,
      endIndex: startIndex + selectedMask.length
    };
    item.liveExpectedText = selectedMask;
    item.detection = {
      ...item.detection,
      startIndex,
      endIndex: startIndex + selectedMask.length
    };

    this.persistAllItemStates();
    return true;
  }

  private applyContentEditableUndo(item: InterventionItem): boolean {
    const range = item.liveRange;
    const expectedText = item.liveExpectedText ?? item.selectedMask;

    if (!range) {
      return false;
    }

    const replacement: TextReplacement = {
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      expectedText,
      replacementText: item.detection.text
    };

    const baseText = this.latestText;
    const { applied } = this.applyContentEditableReplacements(baseText, [replacement]);
    if (!applied) {
      return false;
    }

    const delta = item.detection.text.length - expectedText.length;
    this.shiftItemRangesAfter(range.endIndex, delta, item.id);

    item.status = 'pending';
    item.liveRange = undefined;
    item.liveExpectedText = undefined;
    item.detection = {
      ...item.detection,
      startIndex: range.startIndex,
      endIndex: range.startIndex + item.detection.text.length
    };

    this.persistAllItemStates();
    return true;
  }

  private applyContentEditableRedactAll(itemIds: string[]): InterventionItem[] {
    const plans = itemIds
      .map((itemId) => {
        const item = this.getItem(itemId);
        if (!item || item.status !== 'pending') {
          return null;
        }

        const { defaultFormatId, formats } = buildRedactionFormats(item.detection);
        const selected = formats.find((entry) => entry.id === defaultFormatId) ?? formats[0];
        if (!selected) {
          return null;
        }

        return {
          item,
          selectedFormatId: selected.id,
          selectedMask: selected.mask,
          startIndex: item.detection.startIndex,
          endIndex: item.detection.endIndex
        };
      })
      .filter((entry) => entry !== null)
      .sort((left, right) => right.startIndex - left.startIndex);

    if (!plans.length) {
      return [];
    }

    const replacements: TextReplacement[] = plans.map((plan) => ({
      startIndex: plan.startIndex,
      endIndex: plan.endIndex,
      expectedText: plan.item.detection.text,
      replacementText: plan.selectedMask
    }));

    const { applied } = this.applyContentEditableReplacements(this.latestText, replacements);
    if (!applied) {
      return [];
    }

    for (const plan of plans) {
      const delta = plan.selectedMask.length - plan.item.detection.text.length;
      this.shiftItemRangesAfter(plan.endIndex, delta, plan.item.id);

      plan.item.status = 'redacted';
      plan.item.selectedFormatId = plan.selectedFormatId;
      plan.item.selectedMask = plan.selectedMask;
      plan.item.liveRange = {
        startIndex: plan.startIndex,
        endIndex: plan.startIndex + plan.selectedMask.length
      };
      plan.item.liveExpectedText = plan.selectedMask;
      plan.item.detection = {
        ...plan.item.detection,
        startIndex: plan.startIndex,
        endIndex: plan.startIndex + plan.selectedMask.length
      };
    }

    this.persistAllItemStates();
    return plans.map((plan) => plan.item);
  }

  private applyContentEditableReset(): boolean {
    const redacted = this.activeItems
      .filter((item) => item.status === 'redacted')
      .map((item) => {
        const range = item.liveRange;
        const expectedText = item.liveExpectedText ?? item.selectedMask;
        if (!range) {
          return null;
        }

        return {
          item,
          range,
          expectedText
        };
      })
      .filter((entry) => entry !== null)
      .sort((left, right) => right.range.startIndex - left.range.startIndex);

    if (!redacted.length) {
      for (const item of this.activeItems) {
        item.status = 'pending';
        item.liveRange = undefined;
        item.liveExpectedText = undefined;
      }
      this.persistAllItemStates();
      return true;
    }

    const replacements: TextReplacement[] = redacted.map((entry) => ({
      startIndex: entry.range.startIndex,
      endIndex: entry.range.endIndex,
      expectedText: entry.expectedText,
      replacementText: entry.item.detection.text
    }));

    const { applied } = this.applyContentEditableReplacements(this.latestText, replacements);
    if (!applied) {
      return false;
    }

    for (const entry of redacted) {
      const delta = entry.item.detection.text.length - entry.expectedText.length;
      this.shiftItemRangesAfter(entry.range.endIndex, delta, entry.item.id);
      entry.item.status = 'pending';
      entry.item.liveRange = undefined;
      entry.item.liveExpectedText = undefined;
      entry.item.detection = {
        ...entry.item.detection,
        startIndex: entry.range.startIndex,
        endIndex: entry.range.startIndex + entry.item.detection.text.length
      };
    }

    for (const item of this.activeItems) {
      if (item.status === 'ignored') {
        item.status = 'pending';
        item.liveRange = undefined;
        item.liveExpectedText = undefined;
      }
    }

    this.persistAllItemStates();
    return true;
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
    this.baselineText = null;
    this.pendingProgrammaticText = null;
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
      liveRange: previousState?.liveRange
        ? {
            startIndex: previousState.liveRange.startIndex,
            endIndex: previousState.liveRange.endIndex
          }
        : undefined,
      liveExpectedText: previousState?.liveExpectedText,
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
        selectedMask: item.selectedMask,
        liveRange: item.liveRange
          ? {
              startIndex: item.liveRange.startIndex,
              endIndex: item.liveRange.endIndex
            }
          : undefined,
        liveExpectedText: item.liveExpectedText
      });
    }

    this.itemStateMap = nextStateMap;

    return nextItems;
  }

  private resolveSelectedRedactions(
    baseText: string,
    items: InterventionItem[]
  ): ResolvedRedactionResult {
    const redacted = items
      .filter((item) => item.status === 'redacted')
      .sort((left, right) => right.detection.startIndex - left.detection.startIndex);

    let result = baseText;
    const replacements: TextReplacement[] = [];

    for (const item of redacted) {
      const { startIndex, endIndex } = item.detection;

      if (startIndex < 0 || endIndex <= startIndex || endIndex > result.length) {
        continue;
      }

      if (result.slice(startIndex, endIndex) !== item.detection.text) {
        continue;
      }

      replacements.push({
        startIndex,
        endIndex,
        expectedText: item.detection.text,
        replacementText: item.selectedMask
      });
      result = result.slice(0, startIndex) + item.selectedMask + result.slice(endIndex);
    }

    return {
      text: result,
      replacements
    };
  }

  private updateInputText(
    baseText: string,
    nextText: string,
    replacements: TextReplacement[]
  ): boolean {
    const currentText = this.latestText;

    this.pendingProgrammaticText = nextText;
    this.latestText = nextText;

    if (replacements.length) {
      const updatedInPlace = this.adapter.applyTextReplacements(baseText, replacements);
      if (updatedInPlace) {
        if (this.isContentEditableInput()) {
          this.baselineText = nextText;
        }
        return true;
      }
    }

    if (this.isContentEditableInput()) {
      this.pendingProgrammaticText = null;
      this.latestText = currentText;
      this.baselineText = currentText;
      return false;
    }

    const fallbackDiffReplacements = buildDiffReplacement(currentText, nextText);
    if (fallbackDiffReplacements.length) {
      const updatedFromCurrent = this.adapter.applyTextReplacements(
        currentText,
        fallbackDiffReplacements
      );
      if (updatedFromCurrent) {
        return true;
      }
    }

    this.adapter.setText(nextText);
    return true;
  }

  private resetResolvedRedactionsToPending(): void {
    for (const item of this.activeItems) {
      if (item.status !== 'redacted') {
        continue;
      }

      item.status = 'pending';
      item.liveRange = undefined;
      item.liveExpectedText = undefined;
      this.persistItemState(item);
    }
  }

  private handleRedactionApplyFailure(): void {
    this.pendingProgrammaticText = null;
    this.latestText = this.adapter.captureText();
    this.baselineText = this.latestText;
    this.resetResolvedRedactionsToPending();
    this.render();
  }

  private hasResolvedDecisions(): boolean {
    return this.activeItems.some((item) => item.status !== 'pending');
  }

  private getRedactionBaselineText(): string {
    return this.baselineText ?? this.latestText;
  }

  private shouldApplyImmediatePreview(): boolean {
    return this.adapter.getInputType() !== 'contenteditable';
  }

  private applyImmediatePreviewFromCurrentState(): void {
    if (!this.shouldApplyImmediatePreview()) {
      return;
    }

    const baseText = this.getRedactionBaselineText();
    const resolved = this.resolveSelectedRedactions(
      baseText,
      this.activeItems
    );
    const nextText = resolved.text;

    if (nextText === this.latestText) {
      return;
    }

    const updated = this.updateInputText(baseText, nextText, resolved.replacements);
    if (!updated) {
      this.handleRedactionApplyFailure();
    }
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
    const baseText = this.getRedactionBaselineText();
    const resolved = this.resolveSelectedRedactions(
      baseText,
      this.activeItems
    );
    const updatedText = resolved.text;

    if (updatedText !== this.latestText) {
      const updated = this.updateInputText(baseText, updatedText, resolved.replacements);
      if (!updated) {
        this.handleRedactionApplyFailure();
        return;
      }
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
    if (this.pendingProgrammaticText !== null && text === this.pendingProgrammaticText) {
      this.pendingProgrammaticText = null;
      this.latestText = text;
      return;
    }

    const previousText = this.latestText;
    const hadResolvedDecisions = this.hasResolvedDecisions();
    const textChanged = text !== previousText;

    this.latestText = text;

    if (!text.length) {
      this.clearPromptState();
      return;
    }

    if (hadResolvedDecisions && textChanged) {
      this.itemStateMap.clear();
    }

    this.baselineText = text;

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
