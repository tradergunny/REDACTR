export type PIICategory =
  | 'credit_card'
  | 'bank_account'
  | 'ssn'
  | 'api_key'
  | 'password'
  | 'passport'
  | 'national_id'
  | 'email'
  | 'phone'
  | 'employee_name'
  | 'address';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type DetectionMode = 'relaxed' | 'standard' | 'strict';
export type DetectionExecutionMode = 'enforced' | 'shadow';
export type ValidationStage = 'candidate' | 'validated';
export type DetectionDecision = 'block' | 'warn' | 'ignore';

export type ScoreSignalSource =
  | 'pattern'
  | 'context'
  | 'validator'
  | 'suppressor'
  | 'heuristic';

export interface ScoreSignal {
  name: string;
  source: ScoreSignalSource;
  weight: number;
  applied: boolean;
}

export const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export interface ScoreBreakdown {
  baseConfidence: number;
  contextBonus: number;
  signalDelta: number;
  codePenalty: number;
  finalConfidence: number;
}

export interface DetectionResult {
  text: string;
  normalizedText?: string;
  category: PIICategory;
  severity: Severity;
  confidence: number;
  startIndex: number;
  endIndex: number;
  suggestedMask: string;
  rule: string;
  validationStage: ValidationStage;
  decision: DetectionDecision;
  scoreBreakdown: ScoreBreakdown;
  scoreSignals: ScoreSignal[];
  countryHint?: string;
  shadowDecision?: DetectionDecision;
  suppressedReason?: string;
}

export interface RuleMatch {
  text: string;
  normalizedText?: string;
  category: PIICategory;
  severity: Severity;
  startIndex: number;
  endIndex: number;
  baseConfidence: number;
  rule: string;
  contextBonus?: number;
  validationStage?: ValidationStage;
  scoreSignals?: ScoreSignal[];
  countryHint?: string;
  suppressedReason?: string;
}

export interface PIIRule {
  id: string;
  category: PIICategory;
  severity: Severity;
  detect(input: string): RuleMatch[];
}

export interface CategoryThreshold {
  warn: number;
  block?: number;
}

export interface DetectPIIOptions {
  chunkThreshold?: number;
  chunkSize?: number;
  mode?: DetectionMode;
  executionMode?: DetectionExecutionMode;
  enabledCategories?: PIICategory[];
  categoryThresholds?: Partial<Record<PIICategory, CategoryThreshold>>;
}

export interface TextRange {
  startIndex: number;
  endIndex: number;
}

export const clampConfidence = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return Number(value.toFixed(3));
};

export const downgradeSeverity = (severity: Severity): Severity => {
  if (severity === 'critical') {
    return 'high';
  }

  if (severity === 'high') {
    return 'medium';
  }

  return 'low';
};

export const rangesOverlap = (a: TextRange, b: TextRange): boolean =>
  a.startIndex < b.endIndex && b.startIndex < a.endIndex;
