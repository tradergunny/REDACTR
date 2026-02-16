import type { DetectionResult, Severity } from '../pii/types';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export type InterventionAction =
  | 'mask_send'
  | 'edit_prompt'
  | 'allow_once'
  | 'always_allow'
  | 'dismiss';

export interface WarningFinding {
  key: string;
  category: DetectionResult['category'];
  severity: Severity;
  maskedPreview: string;
  confidence: number;
}

export interface WarningViewModel {
  severity: Severity;
  blocking: boolean;
  title: string;
  message: string;
  findings: WarningFinding[];
}

export const getDetectionKey = (detection: DetectionResult): string =>
  [
    detection.category,
    detection.text,
    detection.startIndex,
    detection.endIndex,
    detection.rule
  ].join(':');

export const isBlockingSeverity = (severity: Severity): boolean =>
  severity === 'critical' || severity === 'high';

export const highestSeverity = (detections: DetectionResult[]): Severity => {
  if (detections.length === 0) {
    return 'low';
  }

  for (const severity of SEVERITY_ORDER) {
    if (detections.some((detection) => detection.severity === severity)) {
      return severity;
    }
  }

  return 'low';
};

export const getDetectionSignature = (detections: DetectionResult[]): string =>
  detections
    .map((detection) => `${getDetectionKey(detection)}:${detection.severity}`)
    .join('|');
