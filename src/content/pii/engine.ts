import { getCodeBlockRanges, isWithinCodeBlock } from './context';
import { generateMask } from './mask';
import { resolvePolicyDecision } from './policy';
import { PII_RULES } from './rules';
import {
  clampConfidence,
  DetectionDecision,
  downgradeSeverity,
  rangesOverlap,
  SEVERITY_PRIORITY,
  type DetectionResult,
  type DetectPIIOptions,
  type PIICategory,
  type RuleMatch
} from './types';

const DEFAULT_CHUNK_THRESHOLD = 10_000;
const DEFAULT_CHUNK_SIZE = 4_000;
const CHUNK_OVERLAP = 128;

const CATEGORY_OVERLAP_PRIORITY: Record<PIICategory, number> = {
  api_key: 120,
  credit_card: 115,
  card_cvv: 96,
  card_expiry: 86,
  ssn: 110,
  bank_account: 108,
  national_id: 104,
  passport: 102,
  password: 100,
  email: 90,
  phone: 88,
  address: 80,
  employee_name: 70
};

const DECISION_PRIORITY: Record<DetectionDecision, number> = {
  block: 3,
  warn: 2,
  ignore: 1
};

const signalDeltaFromMatch = (match: RuleMatch): number =>
  (match.scoreSignals ?? [])
    .filter((signal) => signal.applied)
    .reduce((total, signal) => total + signal.weight, 0);

const toDetectionResult = (
  match: RuleMatch,
  insideCodeBlock: boolean,
  options: DetectPIIOptions
): DetectionResult => {
  const codePenalty = insideCodeBlock ? -0.2 : 0;
  const severity = insideCodeBlock ? downgradeSeverity(match.severity) : match.severity;
  const signalDelta = signalDeltaFromMatch(match);
  const confidence = clampConfidence(
    match.baseConfidence + (match.contextBonus ?? 0) + signalDelta + codePenalty
  );
  const policyDecision = resolvePolicyDecision(
    match.category,
    severity,
    confidence,
    options
  );

  return {
    text: match.text,
    normalizedText: match.normalizedText,
    category: match.category,
    severity,
    confidence,
    startIndex: match.startIndex,
    endIndex: match.endIndex,
    suggestedMask: generateMask(match.text, match.category),
    rule: match.rule,
    validationStage: match.validationStage ?? 'validated',
    decision: policyDecision.decision,
    shadowDecision: policyDecision.shadowDecision,
    scoreBreakdown: {
      baseConfidence: match.baseConfidence,
      contextBonus: match.contextBonus ?? 0,
      signalDelta,
      codePenalty,
      finalConfidence: confidence
    },
    scoreSignals: match.scoreSignals ?? [],
    countryHint: match.countryHint,
    suppressedReason: match.suppressedReason
  };
};

const resolveOverlaps = (results: DetectionResult[]): DetectionResult[] => {
  const byPriority = [...results].sort((left, right) => {
    const categoryGap =
      CATEGORY_OVERLAP_PRIORITY[right.category] -
      CATEGORY_OVERLAP_PRIORITY[left.category];
    if (categoryGap !== 0) {
      return categoryGap;
    }

    const decisionGap = DECISION_PRIORITY[right.decision] - DECISION_PRIORITY[left.decision];
    if (decisionGap !== 0) {
      return decisionGap;
    }

    const severityGap = SEVERITY_PRIORITY[right.severity] - SEVERITY_PRIORITY[left.severity];
    if (severityGap !== 0) {
      return severityGap;
    }

    const leftLength = left.endIndex - left.startIndex;
    const rightLength = right.endIndex - right.startIndex;
    if (rightLength !== leftLength) {
      return rightLength - leftLength;
    }

    if (left.startIndex !== right.startIndex) {
      return left.startIndex - right.startIndex;
    }

    return right.confidence - left.confidence;
  });

  const selected: DetectionResult[] = [];

  for (const candidate of byPriority) {
    const overlapsExisting = selected.some((existing) =>
      rangesOverlap(candidate, existing)
    );

    if (!overlapsExisting) {
      selected.push(candidate);
    }
  }

  return selected.sort((left, right) => {
    if (left.startIndex !== right.startIndex) {
      return left.startIndex - right.startIndex;
    }

    return left.endIndex - right.endIndex;
  });
};

const dedupe = (results: DetectionResult[]): DetectionResult[] => {
  const bySignature = new Map<string, DetectionResult>();

  for (const result of results) {
    const signature = [
      result.category,
      result.rule,
      result.startIndex,
      result.endIndex,
      result.text,
      result.decision
    ].join(':');

    if (!bySignature.has(signature)) {
      bySignature.set(signature, result);
    }
  }

  return [...bySignature.values()];
};

const detectInSegment = (input: string, segmentOffset: number): RuleMatch[] => {
  const matches: RuleMatch[] = [];

  for (const rule of PII_RULES) {
    const found = rule.detect(input);

    for (const match of found) {
      matches.push({
        ...match,
        startIndex: match.startIndex + segmentOffset,
        endIndex: match.endIndex + segmentOffset
      });
    }
  }

  return matches;
};

const collectRawMatches = (input: string, options: DetectPIIOptions): RuleMatch[] => {
  const chunkThreshold = options.chunkThreshold ?? DEFAULT_CHUNK_THRESHOLD;
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;

  if (input.length <= chunkThreshold) {
    return detectInSegment(input, 0);
  }

  const matches: RuleMatch[] = [];

  for (let offset = 0; offset < input.length; offset += chunkSize) {
    const segmentStart = Math.max(0, offset - CHUNK_OVERLAP);
    const segmentEnd = Math.min(input.length, offset + chunkSize + CHUNK_OVERLAP);
    const segment = input.slice(segmentStart, segmentEnd);

    matches.push(...detectInSegment(segment, segmentStart));
  }

  return matches;
};

const applyCategoryFilter = (
  rawMatches: RuleMatch[],
  options: DetectPIIOptions
): RuleMatch[] => {
  if (!options.enabledCategories?.length) {
    return rawMatches;
  }

  const enabled = new Set(options.enabledCategories);
  return rawMatches.filter((match) => enabled.has(match.category));
};

const applyValidationStage = (rawMatches: RuleMatch[]): RuleMatch[] =>
  rawMatches.map((match) => ({
    ...match,
    validationStage: 'validated'
  }));

export const detectPII = (
  input: string,
  options: DetectPIIOptions = {}
): DetectionResult[] => {
  if (!input.trim()) {
    return [];
  }

  const rawMatches = applyCategoryFilter(collectRawMatches(input, options), options);
  if (!rawMatches.length) {
    return [];
  }

  const validatedMatches = applyValidationStage(rawMatches);
  const codeRanges = getCodeBlockRanges(input);

  const scored = validatedMatches.map((match) => {
    const insideCodeBlock = isWithinCodeBlock(match, codeRanges);
    return toDetectionResult(match, insideCodeBlock, options);
  });

  return resolveOverlaps(
    dedupe(
      scored.filter(
        (detection) =>
          detection.decision !== 'ignore' ||
          options.executionMode === 'shadow'
      )
    )
  );
};
