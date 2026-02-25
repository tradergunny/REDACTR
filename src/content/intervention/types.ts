import type { DetectionResult, PIICategory, Severity } from '../pii/types';
import type { PlatformId } from '../adapters/types';

export type PanelOpenTrigger = 'icon_click' | 'blocked_submit';

export type PanelCloseReason =
  | 'icon_click'
  | 'outside_click'
  | 'escape'
  | 'close_button';

export type InterventionStatus = 'pending' | 'redacted' | 'ignored';

export interface RedactionFormat {
  id: string;
  label: string;
  mask: string;
}

export interface DetectionIdentity {
  key: string;
  groupKey: string;
  occurrence: number;
}

export interface InterventionItem {
  id: string;
  detection: DetectionResult;
  identity: DetectionIdentity;
  status: InterventionStatus;
  selectedFormatId: string;
  selectedMask: string;
  liveRange?: {
    startIndex: number;
    endIndex: number;
  };
  liveExpectedText?: string;
  formats: RedactionFormat[];
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface InterventionViewModel {
  platformId: PlatformId;
  items: InterventionItem[];
  highestSeverity: Severity | null;
  pendingCount: number;
  redactedCount: number;
  ignoredCount: number;
  blockedPendingCount: number;
  severityCounts: SeverityCounts;
}

export interface PersistedItemState {
  status: InterventionStatus;
  selectedFormatId: string;
  selectedMask: string;
  liveRange?: {
    startIndex: number;
    endIndex: number;
  };
  liveExpectedText?: string;
}

export const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export const isBlockingSeverity = (severity: Severity): boolean =>
  severity === 'critical' || severity === 'high';

export const buildGroupKey = (
  detection: Pick<DetectionResult, 'category' | 'text'>
): string => `${detection.category}:${detection.text}`;

export const buildItemId = (
  detection: Pick<DetectionResult, 'category' | 'text'>,
  occurrence: number
): string => `${buildGroupKey(detection)}:${occurrence}`;

export const buildDetectionIdentity = (
  detection: Pick<DetectionResult, 'category' | 'text'>,
  occurrence: number
): DetectionIdentity => ({
  groupKey: buildGroupKey(detection),
  occurrence,
  key: buildItemId(detection, occurrence)
});

export const getTokenMask = (category: PIICategory): string =>
  `[${category.toUpperCase()}]`;

export const defaultFormatForSeverity = (severity: Severity): 'token' | 'partial' =>
  severity === 'critical' || severity === 'high' ? 'token' : 'partial';

export const severityLabel = (severity: Severity): string =>
  severity.slice(0, 1).toUpperCase() + severity.slice(1);

export const categoryLabel = (category: PIICategory): string =>
  category
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');

export const summarizeIntervention = (
  items: InterventionItem[]
): Omit<InterventionViewModel, 'platformId' | 'items'> => {
  const severityCounts: SeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  let highestSeverity: Severity | null = null;
  let pendingCount = 0;
  let redactedCount = 0;
  let ignoredCount = 0;
  let blockedPendingCount = 0;

  for (const item of items) {
    severityCounts[item.detection.severity] += 1;

    if (
      !highestSeverity ||
      SEVERITY_PRIORITY[item.detection.severity] > SEVERITY_PRIORITY[highestSeverity]
    ) {
      highestSeverity = item.detection.severity;
    }

    if (item.status === 'pending') {
      pendingCount += 1;
      if (isBlockingSeverity(item.detection.severity)) {
        blockedPendingCount += 1;
      }
      continue;
    }

    if (item.status === 'redacted') {
      redactedCount += 1;
      continue;
    }

    ignoredCount += 1;
  }

  return {
    highestSeverity,
    pendingCount,
    redactedCount,
    ignoredCount,
    blockedPendingCount,
    severityCounts
  };
};
