import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { detectThaiIdOrCardCandidates } from '../validators/id-card-detector';
import {
  hasKeywordNearby,
  makeRuleMatch,
  pushSignal,
  runGlobalRegex
} from './shared';

interface Anchor {
  startIndex: number;
  endIndex: number;
  type: 'card' | 'payment_keyword';
}

interface ParsedExpiry {
  month: number;
  year: number;
  normalized: string;
}

interface CandidateBase {
  value: string;
  startIndex: number;
  endIndex: number;
}

interface ScoredCandidate {
  candidate: CandidateBase;
  scoreSignals: ScoreSignal[];
  baseConfidence: number;
  contextBonus: number;
  anchorKey: string;
}

const CVV_REGEX = /(?<!\d)\d{3,4}(?!\d)/g;
const EXPIRY_REGEX = /(?<!\d)(0?[1-9]|1[0-2])\s*(?:\/|-|\.)\s*(\d{2}|\d{4})(?!\d)/g;
const PAYMENT_ANCHOR_REGEX = /\b(?:credit card|debit card|card|payment|billing)\b/gi;
const CVV_KEYWORDS = [
  'cvv',
  'cvc',
  'cvn',
  'security code',
  'card verification',
  'verification code'
];
const EXPIRY_KEYWORDS = [
  'exp',
  'expiry',
  'expiration',
  'valid thru',
  'valid through',
  'expires'
];
const PAYMENT_KEYWORDS = ['card', 'credit card', 'debit card', 'payment', 'billing'];
const SUPPRESSOR_KEYWORDS = [
  'otp',
  'pin',
  'room',
  'floor',
  'qty',
  'quantity',
  'age',
  'version',
  'build',
  'ticket',
  'order',
  'ref',
  'reference'
];
const MAX_ANCHOR_DISTANCE = 140;
const STRONG_CARD_ANCHOR_DISTANCE = 80;
const NEARBY_COUNTERPART_DISTANCE = 80;

const distanceBetweenRanges = (
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number => {
  if (endA < startB) {
    return startB - endA;
  }

  if (endB < startA) {
    return startA - endB;
  }

  return 0;
};

const isSameLine = (
  input: string,
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean => {
  const left = Math.max(0, Math.min(startA, startB));
  const right = Math.min(input.length, Math.max(endA, endB));
  return !input.slice(left, right).includes('\n');
};

const resolveNearestAnchor = (
  candidate: CandidateBase,
  anchors: Anchor[]
): { anchor: Anchor; distance: number } | null => {
  let nearest: { anchor: Anchor; distance: number } | null = null;

  for (const anchor of anchors) {
    const distance = distanceBetweenRanges(
      candidate.startIndex,
      candidate.endIndex,
      anchor.startIndex,
      anchor.endIndex
    );

    if (!nearest || distance < nearest.distance) {
      nearest = { anchor, distance };
      continue;
    }

    if (distance === nearest.distance) {
      if (anchor.type === 'card' && nearest.anchor.type !== 'card') {
        nearest = { anchor, distance };
      }
    }
  }

  return nearest;
};

const extractCardAnchors = (input: string): Anchor[] =>
  detectThaiIdOrCardCandidates(input)
    .filter((candidate) => candidate.type === 'CREDIT_CARD')
    .map((candidate) => ({
      startIndex: candidate.startIndex,
      endIndex: candidate.endIndex,
      type: 'card' as const
    }));

const extractKeywordAnchors = (input: string): Anchor[] =>
  runGlobalRegex(PAYMENT_ANCHOR_REGEX, input).map((candidate) => {
    const value = candidate[0];
    const startIndex = candidate.index ?? 0;

    return {
      startIndex,
      endIndex: startIndex + value.length,
      type: 'payment_keyword' as const
    };
  });

const parseExpiry = (monthPart: string, yearPart: string): ParsedExpiry | null => {
  const month = Number(monthPart);
  if (month < 1 || month > 12) {
    return null;
  }

  const nowYear = new Date().getFullYear();
  const numericYear = Number(yearPart);
  const year = yearPart.length === 2 ? 2000 + numericYear : numericYear;
  if (year < nowYear - 1 || year > nowYear + 20) {
    return null;
  }

  return {
    month,
    year,
    normalized: `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`
  };
};

const extractCvvCandidates = (input: string): CandidateBase[] =>
  runGlobalRegex(CVV_REGEX, input).map((candidate) => {
    const value = candidate[0];
    const startIndex = candidate.index ?? 0;
    return {
      value,
      startIndex,
      endIndex: startIndex + value.length
    };
  });

const extractExpiryCandidates = (
  input: string
): Array<CandidateBase & { parsed: ParsedExpiry }> => {
  const candidates: Array<CandidateBase & { parsed: ParsedExpiry }> = [];

  for (const match of runGlobalRegex(EXPIRY_REGEX, input)) {
    const value = match[0];
    const startIndex = match.index ?? 0;
    const parsed = parseExpiry(match[1] ?? '', match[2] ?? '');
    if (!parsed) {
      continue;
    }

    candidates.push({
      value,
      startIndex,
      endIndex: startIndex + value.length,
      parsed
    });
  }

  return candidates;
};

const hasNearbyCandidate = (
  candidate: CandidateBase,
  others: CandidateBase[]
): boolean =>
  others.some(
    (other) =>
      distanceBetweenRanges(
        candidate.startIndex,
        candidate.endIndex,
        other.startIndex,
        other.endIndex
      ) <= NEARBY_COUNTERPART_DISTANCE
  );

const isDenseNumericSequence = (input: string, candidate: CandidateBase): boolean => {
  const left = Math.max(0, candidate.startIndex - 10);
  const right = Math.min(input.length, candidate.endIndex + 10);
  const surroundingDigits = input.slice(left, right).replace(/\D/g, '').length;
  return surroundingDigits >= 8;
};

const keepBestPerAnchor = <T extends ScoredCandidate>(candidates: T[]): T[] => {
  const bestByAnchor = new Map<string, T>();

  for (const candidate of candidates) {
    const existing = bestByAnchor.get(candidate.anchorKey);
    const candidateSignalWeight = candidate.scoreSignals.reduce(
      (total, signal) => total + signal.weight,
      0
    );
    const existingSignalWeight = existing
      ? existing.scoreSignals.reduce((total, signal) => total + signal.weight, 0)
      : Number.NEGATIVE_INFINITY;

    if (
      !existing ||
      candidateSignalWeight > existingSignalWeight ||
      (candidateSignalWeight === existingSignalWeight &&
        candidate.candidate.startIndex < existing.candidate.startIndex)
    ) {
      bestByAnchor.set(candidate.anchorKey, candidate);
    }
  }

  return [...bestByAnchor.values()].sort(
    (left, right) => left.candidate.startIndex - right.candidate.startIndex
  );
};

const detectCardMetadata = (
  input: string
): { cvvMatches: RuleMatch[]; expiryMatches: RuleMatch[] } => {
  const cardAnchors = extractCardAnchors(input);
  const keywordAnchors = extractKeywordAnchors(input);
  const allAnchors = [...cardAnchors, ...keywordAnchors];
  const hasCardAnchor = cardAnchors.length > 0;
  const expiryCandidates = extractExpiryCandidates(input);
  const cvvCandidates = extractCvvCandidates(input).filter(
    (candidate) =>
      !expiryCandidates.some(
        (expiryCandidate) =>
          candidate.startIndex >= expiryCandidate.startIndex &&
          candidate.endIndex <= expiryCandidate.endIndex
      )
  );
  const expiryCounterpartCandidates = expiryCandidates.map((candidate) => ({
    value: candidate.value,
    startIndex: candidate.startIndex,
    endIndex: candidate.endIndex
  }));

  const acceptedCvvCandidates: ScoredCandidate[] = [];
  for (const candidate of cvvCandidates) {
    const scoreSignals: ScoreSignal[] = [];
    const hasKeyword = hasKeywordNearby(
      input,
      candidate.startIndex,
      candidate.endIndex,
      CVV_KEYWORDS,
      36
    );
    const hasPaymentKeywordNearby = hasKeywordNearby(
      input,
      candidate.startIndex,
      candidate.endIndex,
      PAYMENT_KEYWORDS,
      48
    );
    const hasSuppressor = hasKeywordNearby(
      input,
      candidate.startIndex,
      candidate.endIndex,
      SUPPRESSOR_KEYWORDS,
      32
    );
    const hasCounterpartSignal =
      hasNearbyCandidate(candidate, expiryCounterpartCandidates) ||
      hasKeywordNearby(input, candidate.startIndex, candidate.endIndex, EXPIRY_KEYWORDS, 72);
    const nearestAnyAnchor = resolveNearestAnchor(candidate, allAnchors);
    const nearestCardAnchor = resolveNearestAnchor(candidate, cardAnchors);
    const strongCardAnchor =
      nearestCardAnchor !== null && nearestCardAnchor.distance <= STRONG_CARD_ANCHOR_DISTANCE;
    const sameLineAnchorBonus =
      nearestAnyAnchor !== null &&
      isSameLine(
        input,
        candidate.startIndex,
        candidate.endIndex,
        nearestAnyAnchor.anchor.startIndex,
        nearestAnyAnchor.anchor.endIndex
      );
    const denseNumericSequence = isDenseNumericSequence(input, candidate);

    if (hasSuppressor) {
      continue;
    }

    if (hasCardAnchor) {
      if (!(hasKeyword || (strongCardAnchor && hasCounterpartSignal))) {
        continue;
      }
    } else if (!(hasKeyword && hasCounterpartSignal)) {
      continue;
    }

    if (denseNumericSequence && !hasKeyword) {
      continue;
    }

    if (hasKeyword) {
      pushSignal(scoreSignals, 'cvv_keyword_present', 'context', 0.2);
    }
    if (hasPaymentKeywordNearby) {
      pushSignal(scoreSignals, 'payment_keyword_nearby', 'context', 0.04);
    }
    if (hasCounterpartSignal) {
      pushSignal(scoreSignals, 'cvv_counterpart_signal', 'heuristic', 0.05);
    }
    if (nearestAnyAnchor && nearestAnyAnchor.distance <= MAX_ANCHOR_DISTANCE) {
      pushSignal(scoreSignals, 'anchor_within_window', 'heuristic', 0.1);
    }
    if (strongCardAnchor) {
      pushSignal(scoreSignals, 'strong_card_anchor', 'validator', 0.08);
    }
    if (sameLineAnchorBonus) {
      pushSignal(scoreSignals, 'same_line_anchor', 'heuristic', 0.03);
    }
    if (denseNumericSequence) {
      pushSignal(scoreSignals, 'dense_numeric_nearby', 'suppressor', -0.12);
    }

    const anchorKey =
      nearestAnyAnchor && nearestAnyAnchor.distance <= MAX_ANCHOR_DISTANCE
        ? `${nearestAnyAnchor.anchor.type}:${nearestAnyAnchor.anchor.startIndex}:${nearestAnyAnchor.anchor.endIndex}`
        : `unlinked:${candidate.startIndex}:${candidate.endIndex}`;

    acceptedCvvCandidates.push({
      candidate,
      scoreSignals,
      baseConfidence: 0.58,
      contextBonus: 0.04,
      anchorKey
    });
  }

  const acceptedExpiryCandidates: Array<ScoredCandidate & { normalizedText: string }> = [];
  for (const candidate of expiryCandidates) {
    const scoreSignals: ScoreSignal[] = [];
    const hasKeyword = hasKeywordNearby(
      input,
      candidate.startIndex,
      candidate.endIndex,
      EXPIRY_KEYWORDS,
      36
    );
    const hasPaymentKeywordNearby = hasKeywordNearby(
      input,
      candidate.startIndex,
      candidate.endIndex,
      PAYMENT_KEYWORDS,
      48
    );
    const hasSuppressor = hasKeywordNearby(
      input,
      candidate.startIndex,
      candidate.endIndex,
      SUPPRESSOR_KEYWORDS,
      32
    );
    const hasCounterpartSignal =
      hasNearbyCandidate(candidate, cvvCandidates) ||
      hasKeywordNearby(input, candidate.startIndex, candidate.endIndex, CVV_KEYWORDS, 72);
    const nearestAnyAnchor = resolveNearestAnchor(candidate, allAnchors);
    const nearestCardAnchor = resolveNearestAnchor(candidate, cardAnchors);
    const strongCardAnchor =
      nearestCardAnchor !== null && nearestCardAnchor.distance <= STRONG_CARD_ANCHOR_DISTANCE;
    const sameLineAnchorBonus =
      nearestAnyAnchor !== null &&
      isSameLine(
        input,
        candidate.startIndex,
        candidate.endIndex,
        nearestAnyAnchor.anchor.startIndex,
        nearestAnyAnchor.anchor.endIndex
      );

    if (hasSuppressor) {
      continue;
    }

    if (hasCardAnchor) {
      if (!(hasKeyword || (strongCardAnchor && hasCounterpartSignal))) {
        continue;
      }
    } else if (!(hasKeyword && hasCounterpartSignal)) {
      continue;
    }

    pushSignal(scoreSignals, 'expiry_month_valid', 'validator', 0.03);
    pushSignal(scoreSignals, 'expiry_year_in_window', 'validator', 0.03);
    if (hasKeyword) {
      pushSignal(scoreSignals, 'expiry_keyword_present', 'context', 0.16);
    }
    if (hasPaymentKeywordNearby) {
      pushSignal(scoreSignals, 'payment_keyword_nearby', 'context', 0.04);
    }
    if (hasCounterpartSignal) {
      pushSignal(scoreSignals, 'expiry_counterpart_signal', 'heuristic', 0.05);
    }
    if (nearestAnyAnchor && nearestAnyAnchor.distance <= MAX_ANCHOR_DISTANCE) {
      pushSignal(scoreSignals, 'anchor_within_window', 'heuristic', 0.1);
    }
    if (strongCardAnchor) {
      pushSignal(scoreSignals, 'strong_card_anchor', 'validator', 0.08);
    }
    if (sameLineAnchorBonus) {
      pushSignal(scoreSignals, 'same_line_anchor', 'heuristic', 0.03);
    }

    const anchorKey =
      nearestAnyAnchor && nearestAnyAnchor.distance <= MAX_ANCHOR_DISTANCE
        ? `${nearestAnyAnchor.anchor.type}:${nearestAnyAnchor.anchor.startIndex}:${nearestAnyAnchor.anchor.endIndex}`
        : `unlinked:${candidate.startIndex}:${candidate.endIndex}`;

    acceptedExpiryCandidates.push({
      candidate,
      scoreSignals,
      baseConfidence: 0.56,
      contextBonus: 0.04,
      normalizedText: candidate.parsed.normalized,
      anchorKey
    });
  }

  const cvvMatches = keepBestPerAnchor(acceptedCvvCandidates).map((item) =>
    makeRuleMatch(item.candidate.value, item.candidate.startIndex, {
      rule: 'card_metadata.cvv_context',
      category: 'card_cvv',
      severity: 'high',
      baseConfidence: item.baseConfidence,
      contextBonus: item.contextBonus,
      normalizedText: item.candidate.value,
      validationStage: 'validated',
      scoreSignals: item.scoreSignals
    })
  );

  const expiryMatches = keepBestPerAnchor(acceptedExpiryCandidates).map((item) =>
    makeRuleMatch(item.candidate.value, item.candidate.startIndex, {
      rule: 'card_metadata.expiry_context',
      category: 'card_expiry',
      severity: 'medium',
      baseConfidence: item.baseConfidence,
      contextBonus: item.contextBonus,
      normalizedText: item.normalizedText,
      validationStage: 'validated',
      scoreSignals: item.scoreSignals
    })
  );

  return {
    cvvMatches,
    expiryMatches
  };
};

export const cardCvvRule: PIIRule = {
  id: 'card_metadata.cvv_context',
  category: 'card_cvv',
  severity: 'high',
  detect(input: string): RuleMatch[] {
    return detectCardMetadata(input).cvvMatches;
  }
};

export const cardExpiryRule: PIIRule = {
  id: 'card_metadata.expiry_context',
  category: 'card_expiry',
  severity: 'medium',
  detect(input: string): RuleMatch[] {
    return detectCardMetadata(input).expiryMatches;
  }
};
