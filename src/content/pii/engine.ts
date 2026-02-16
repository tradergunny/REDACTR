import { getCodeBlockRanges, isWithinCodeBlock } from './context';
import { generateMask } from './mask';
import { PII_RULES } from './rules';
import {
  clampConfidence,
  downgradeSeverity,
  rangesOverlap,
  SEVERITY_PRIORITY,
  type DetectionResult,
  type DetectPIIOptions,
  type RuleMatch
} from './types';

const DEFAULT_CHUNK_THRESHOLD = 10_000;
const DEFAULT_CHUNK_SIZE = 4_000;
const CHUNK_OVERLAP = 128;

const confidenceFromMatch = (match: RuleMatch, insideCodeBlock: boolean): number => {
  const codePenalty = insideCodeBlock ? -0.2 : 0;
  return clampConfidence(match.baseConfidence + (match.contextBonus ?? 0) + codePenalty);
};

const toDetectionResult = (match: RuleMatch, insideCodeBlock: boolean): DetectionResult => {
  const severity = insideCodeBlock ? downgradeSeverity(match.severity) : match.severity;

  return {
    text: match.text,
    category: match.category,
    severity,
    confidence: confidenceFromMatch(match, insideCodeBlock),
    startIndex: match.startIndex,
    endIndex: match.endIndex,
    suggestedMask: generateMask(match.text, match.category),
    rule: match.rule
  };
};

const resolveOverlaps = (results: DetectionResult[]): DetectionResult[] => {
  const byPriority = [...results].sort((left, right) => {
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
      result.text
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

export const detectPII = (
  input: string,
  options: DetectPIIOptions = {}
): DetectionResult[] => {
  if (!input.trim()) {
    return [];
  }

  const rawMatches = collectRawMatches(input, options);
  if (!rawMatches.length) {
    return [];
  }

  const codeRanges = getCodeBlockRanges(input);

  const scored = rawMatches.map((match) => {
    const insideCodeBlock = isWithinCodeBlock(match, codeRanges);
    return toDetectionResult(match, insideCodeBlock);
  });

  return resolveOverlaps(dedupe(scored));
};
