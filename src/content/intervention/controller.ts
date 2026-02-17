import type { PlatformAdapter } from '../adapters/types';
import type { DetectionResult, Severity } from '../pii/types';
import {
  createPIIActionEvent,
  type PIIActionEventType,
  type PIIEvent
} from '../../shared/events';
import {
  addAllowlistEntries,
  getAllowlistEntries,
  isDetectionAllowlisted,
  type AllowlistEntry
} from '../../shared/storage';
import { WarningBanner } from './banner';
import {
  getDetectionKey,
  getDetectionSignature,
  hasBlockingDecision,
  highestSeverity,
  type InterventionAction,
  type WarningViewModel
} from './types';

const INTERCEPT_DEBOUNCE_MS = 200;

const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

interface InterventionControllerOptions {
  adapter: PlatformAdapter;
  sessionId: string;
  sendEvent: (event: PIIEvent) => Promise<void>;
}

export class InterventionController {
  private readonly adapter: PlatformAdapter;

  private readonly sessionId: string;

  private readonly sendEvent: (event: PIIEvent) => Promise<void>;

  private readonly banner: WarningBanner;

  private latestText = '';

  private activeDetections: DetectionResult[] = [];

  private warningSignature: string | null = null;

  private dismissedSignature: string | null = null;

  private warningShownAt: number | null = null;

  private allowOnceSuppression = new Set<string>();

  private allowlistEntries: AllowlistEntry[] = [];

  private bypassNextSubmit = false;

  private lastInterceptedAt = 0;

  constructor(options: InterventionControllerOptions) {
    this.adapter = options.adapter;
    this.sessionId = options.sessionId;
    this.sendEvent = options.sendEvent;
    this.banner = new WarningBanner(this.adapter, (action) => {
      void this.onAction(action);
    });

    void this.refreshAllowlist();
  }

  private async refreshAllowlist(): Promise<void> {
    this.allowlistEntries = await getAllowlistEntries();
  }

  private getSuppressionKey(detection: DetectionResult): string {
    return `${detection.category}:${detection.text}`;
  }

  private pickPrimaryDetection(
    detections: DetectionResult[] = this.activeDetections
  ): DetectionResult | null {
    if (!detections.length) {
      return null;
    }

    const sorted = [...detections].sort((left, right) => {
      const severityGap =
        SEVERITY_PRIORITY[right.severity] - SEVERITY_PRIORITY[left.severity];
      if (severityGap !== 0) {
        return severityGap;
      }

      return right.confidence - left.confidence;
    });

    return sorted[0] ?? null;
  }

  private buildWarningModel(detections: DetectionResult[]): WarningViewModel {
    const severity = highestSeverity(detections);
    const blocking = hasBlockingDecision(detections);

    return {
      severity,
      blocking,
      title: blocking
        ? 'Sensitive data detected. Sending is blocked until you choose an action.'
        : 'Sensitive data detected. Review before sending.',
      message: `${detections.length} sensitive item${detections.length === 1 ? '' : 's'} detected.`,
      findings: detections.map((detection) => ({
        key: getDetectionKey(detection),
        category: detection.category,
        severity: detection.severity,
        maskedPreview: detection.suggestedMask,
        confidence: detection.confidence,
        decision: detection.decision
      }))
    };
  }

  private showWarning(
    detections: DetectionResult[],
    options: { force?: boolean } = {}
  ): void {
    const anchor = this.adapter.getWarningAnchor();
    if (!anchor) {
      return;
    }

    const signature = getDetectionSignature(detections);
    if (!options.force && this.dismissedSignature === signature) {
      return;
    }

    this.dismissedSignature = null;

    const wasVisible = this.banner.isVisible();
    this.banner.show(anchor, this.buildWarningModel(detections));

    if (!wasVisible || this.warningSignature !== signature) {
      this.warningShownAt = Date.now();
    }

    this.warningSignature = signature;
  }

  private hideWarning(): void {
    this.banner.unmount();
  }

  private shouldSuppress(detection: DetectionResult): boolean {
    const suppressionKey = this.getSuppressionKey(detection);

    if (this.allowOnceSuppression.has(suppressionKey)) {
      return true;
    }

    return isDetectionAllowlisted(detection, this.allowlistEntries);
  }

  private emitActionEvent(eventType: PIIActionEventType): void {
    const primaryDetection = this.pickPrimaryDetection();
    const actionLatencyMs =
      this.warningShownAt === null ? undefined : Date.now() - this.warningShownAt;

    const event = createPIIActionEvent({
      eventType,
      platform: this.adapter.platformId,
      sessionId: this.sessionId,
      promptLength: this.latestText.length,
      actionLatencyMs,
      category: primaryDetection?.category,
      severity: primaryDetection?.severity,
      confidence: primaryDetection?.confidence,
      decision: primaryDetection?.decision,
      shadowDecision: primaryDetection?.shadowDecision,
      suppressedReason: primaryDetection?.suppressedReason,
      ruleVersion: 'v2'
    });

    void this.sendEvent(event);
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

  private focusInputAndHighlight(): void {
    const input = this.adapter.detectInputElement();
    input?.focus();

    for (const detection of this.activeDetections) {
      this.adapter.renderInlineHighlight(
        {
          startIndex: detection.startIndex,
          endIndex: detection.endIndex
        },
        detection.severity
      );
    }
  }

  private applyMasks(text: string, detections: DetectionResult[]): string {
    let updated = text;

    const sorted = [...detections].sort(
      (left, right) => right.startIndex - left.startIndex
    );

    for (const detection of sorted) {
      if (
        detection.startIndex < 0 ||
        detection.endIndex > updated.length ||
        detection.startIndex >= detection.endIndex
      ) {
        continue;
      }

      updated =
        updated.slice(0, detection.startIndex) +
        detection.suggestedMask +
        updated.slice(detection.endIndex);
    }

    return updated;
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

  private clearInterventionState(): void {
    this.activeDetections = [];
    this.warningSignature = null;
    this.dismissedSignature = null;
    this.warningShownAt = null;
    this.hideWarning();
  }

  private async onAction(action: InterventionAction): Promise<void> {
    if (!this.activeDetections.length && action !== 'dismiss') {
      return;
    }

    if (action === 'mask_send') {
      const maskedText = this.applyMasks(this.latestText, this.activeDetections);
      this.latestText = maskedText;
      this.updateInputText(maskedText);
      this.emitActionEvent('pii_masked');
      this.clearInterventionState();
      this.submitWithBypass();
      return;
    }

    if (action === 'edit_prompt') {
      this.focusInputAndHighlight();
      this.emitActionEvent('pii_edit_requested');
      return;
    }

    if (action === 'allow_once') {
      for (const detection of this.activeDetections) {
        this.allowOnceSuppression.add(this.getSuppressionKey(detection));
      }

      this.emitActionEvent('pii_allowed_once');
      this.clearInterventionState();
      this.submitWithBypass();
      return;
    }

    if (action === 'always_allow') {
      const entries: AllowlistEntry[] = this.activeDetections.map((detection) => ({
        category: detection.category,
        value: detection.text,
        created_at: new Date().toISOString()
      }));

      this.allowlistEntries = await addAllowlistEntries(entries);
      this.emitActionEvent('pii_allowlisted');
      this.clearInterventionState();
      this.submitWithBypass();
      return;
    }

    if (action === 'dismiss') {
      this.dismissedSignature = this.warningSignature;
      this.emitActionEvent('warning_dismissed');
      this.hideWarning();
    }
  }

  onScanResult(text: string, detections: DetectionResult[]): void {
    this.latestText = text;

    const filteredDetections = detections.filter((detection) => {
      if (detection.decision === 'ignore') {
        return false;
      }

      return !this.shouldSuppress(detection);
    });

    this.activeDetections = filteredDetections;

    if (!filteredDetections.length) {
      this.clearInterventionState();
      return;
    }

    const signature = getDetectionSignature(filteredDetections);
    if (this.dismissedSignature && this.dismissedSignature !== signature) {
      this.dismissedSignature = null;
    }

    if (signature !== this.warningSignature || !this.banner.isVisible()) {
      this.showWarning(filteredDetections);
    }
  }

  onSubmitAttempt(_event: Event): boolean {
    if (this.bypassNextSubmit) {
      this.bypassNextSubmit = false;
      return true;
    }

    if (!this.activeDetections.length) {
      return true;
    }

    if (!hasBlockingDecision(this.activeDetections)) {
      return true;
    }

    const now = Date.now();
    if (now - this.lastInterceptedAt >= INTERCEPT_DEBOUNCE_MS) {
      this.lastInterceptedAt = now;
      this.emitActionEvent('submit_intercepted');
    }

    this.showWarning(this.activeDetections, { force: true });
    this.banner.focusPrimaryAction();
    return false;
  }

  cleanup(): void {
    this.hideWarning();
    this.activeDetections = [];
  }
}
