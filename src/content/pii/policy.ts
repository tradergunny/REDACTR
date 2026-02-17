import type {
  CategoryThreshold,
  DetectPIIOptions,
  DetectionDecision,
  DetectionMode,
  PIICategory,
  Severity
} from './types';

interface ThresholdRule {
  warn: number;
  block?: number;
}

type SeverityThresholds = Record<Severity, ThresholdRule>;

const MODE_THRESHOLDS: Record<DetectionMode, SeverityThresholds> = {
  relaxed: {
    critical: { warn: 0.66, block: 0.84 },
    high: { warn: 0.68, block: 0.86 },
    medium: { warn: 0.64 },
    low: { warn: 0.64 }
  },
  standard: {
    critical: { warn: 0.7, block: 0.88 },
    high: { warn: 0.72, block: 0.9 },
    medium: { warn: 0.7 },
    low: { warn: 0.7 }
  },
  strict: {
    critical: { warn: 0.76, block: 0.92 },
    high: { warn: 0.78, block: 0.94 },
    medium: { warn: 0.76 },
    low: { warn: 0.76 }
  }
};

const categoryThresholdFromOptions = (
  category: PIICategory,
  overrides?: Partial<Record<PIICategory, CategoryThreshold>>
): ThresholdRule | null => {
  if (!overrides) {
    return null;
  }

  const configured = overrides[category];
  if (!configured || typeof configured.warn !== 'number') {
    return null;
  }

  return {
    warn: configured.warn,
    block: configured.block
  };
};

const resolveThreshold = (
  category: PIICategory,
  severity: Severity,
  options: DetectPIIOptions
): ThresholdRule => {
  const mode = options.mode ?? 'standard';
  const fromCategory = categoryThresholdFromOptions(
    category,
    options.categoryThresholds
  );
  if (fromCategory) {
    return fromCategory;
  }

  return MODE_THRESHOLDS[mode][severity];
};

export const getDefaultDetectionMode = (): DetectionMode => 'standard';

export const legacyDecisionFromSeverity = (severity: Severity): DetectionDecision => {
  if (severity === 'critical' || severity === 'high') {
    return 'block';
  }

  return 'warn';
};

export interface PolicyDecision {
  decision: DetectionDecision;
  shadowDecision?: DetectionDecision;
}

export const resolvePolicyDecision = (
  category: PIICategory,
  severity: Severity,
  confidence: number,
  options: DetectPIIOptions
): PolicyDecision => {
  const threshold = resolveThreshold(category, severity, options);
  let policyDecision: DetectionDecision = 'ignore';

  if (confidence >= threshold.warn) {
    policyDecision = 'warn';
  }

  if (typeof threshold.block === 'number' && confidence >= threshold.block) {
    policyDecision = 'block';
  }

  if (options.executionMode === 'shadow') {
    return {
      decision: legacyDecisionFromSeverity(severity),
      shadowDecision: policyDecision
    };
  }

  return { decision: policyDecision };
};

