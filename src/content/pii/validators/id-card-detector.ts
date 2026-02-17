import { luhnCheck, normalizeDigits } from './luhn';
import { isThaiIdentifierChecksumValid } from './thai';

export type CandidateType = 'THAI_NATIONAL_ID' | 'CREDIT_CARD' | 'NONE';
export type CardNetwork = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER' | null;
export type ChecksumPassed = 'THAI_ID' | 'LUHN' | null;

export interface ContextSignals {
  thaiKeywordNearby: boolean;
  cardKeywordNearby: boolean;
  negativeKeywordNearby: boolean;
}

export interface NumericCandidateDetection {
  raw: string;
  normalizedNumber: string;
  startIndex: number;
  endIndex: number;
  type: CandidateType;
  checksumPassed: ChecksumPassed;
  matchedPrefixNetwork: CardNetwork;
  contextSignals: ContextSignals;
}

interface RawNumericCandidate {
  raw: string;
  startIndex: number;
  endIndex: number;
}

const CANDIDATE_REGEX = /(?<!\d)\d(?:[\s-]*\d)*(?!\d)/g;
const MIN_DIGITS = 13;
const MAX_DIGITS = 19;

const THAI_ID_KEYWORDS = [
  'national id',
  'citizen id',
  'thai id',
  'บัตรประชาชน',
  'เลขบัตร',
  'เลขประจำตัวประชาชน',
  'tax id',
  'taxpayer id',
  'เลขผู้เสียภาษี',
  'company registration',
  'ทะเบียนนิติบุคคล'
];

const CARD_KEYWORDS = [
  'card',
  'credit card',
  'debit card',
  'visa',
  'mastercard',
  'master card',
  'amex',
  'american express',
  'discover'
];

const NEGATIVE_KEYWORDS = [
  'invoice',
  'order',
  'ticket',
  'build',
  'version',
  'serial',
  'reference',
  'ref'
];

const getContextWindow = (
  text: string,
  startIndex: number,
  endIndex: number,
  radius = 48
): string => {
  const left = Math.max(0, startIndex - radius);
  const right = Math.min(text.length, endIndex + radius);
  return text.slice(left, right).toLowerCase();
};

const hasKeywordNearby = (
  text: string,
  startIndex: number,
  endIndex: number,
  keywords: string[],
  radius = 48
): boolean => {
  const context = getContextWindow(text, startIndex, endIndex, radius);
  return keywords.some((keyword) => context.includes(keyword.toLowerCase()));
};

export const extractNumericCandidates = (input: string): RawNumericCandidate[] => {
  const matches: RawNumericCandidate[] = [];
  const expression = new RegExp(CANDIDATE_REGEX.source, CANDIDATE_REGEX.flags);

  let candidate = expression.exec(input);
  while (candidate) {
    const raw = candidate[0];
    const startIndex = candidate.index ?? 0;
    matches.push({
      raw,
      startIndex,
      endIndex: startIndex + raw.length
    });
    candidate = expression.exec(input);
  }

  return matches;
};

export const detectCardNetwork = (digits: string): CardNetwork => {
  const length = digits.length;
  const firstTwo = Number(digits.slice(0, 2));
  const firstThree = Number(digits.slice(0, 3));
  const firstFour = Number(digits.slice(0, 4));

  if (digits.startsWith('4') && (length === 13 || length === 16 || length === 19)) {
    return 'VISA';
  }

  if (
    length === 16 &&
    ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720))
  ) {
    return 'MASTERCARD';
  }

  if (length === 15 && (digits.startsWith('34') || digits.startsWith('37'))) {
    return 'AMEX';
  }

  if (
    length === 16 &&
    (digits.startsWith('6011') || digits.startsWith('65') || (firstThree >= 644 && firstThree <= 649))
  ) {
    return 'DISCOVER';
  }

  return null;
};

const getContextSignals = (
  input: string,
  startIndex: number,
  endIndex: number
): ContextSignals => ({
  thaiKeywordNearby: hasKeywordNearby(input, startIndex, endIndex, THAI_ID_KEYWORDS, 64),
  cardKeywordNearby: hasKeywordNearby(input, startIndex, endIndex, CARD_KEYWORDS, 48),
  negativeKeywordNearby: hasKeywordNearby(input, startIndex, endIndex, NEGATIVE_KEYWORDS, 40)
});

export const detectThaiIdOrCardCandidates = (
  input: string
): NumericCandidateDetection[] => {
  const detections: NumericCandidateDetection[] = [];

  for (const candidate of extractNumericCandidates(input)) {
    const normalizedNumber = normalizeDigits(candidate.raw);

    if (normalizedNumber.length < MIN_DIGITS || normalizedNumber.length > MAX_DIGITS) {
      continue;
    }

    const contextSignals = getContextSignals(input, candidate.startIndex, candidate.endIndex);
    const matchedPrefixNetwork = detectCardNetwork(normalizedNumber);
    const isThaiValid =
      normalizedNumber.length === 13 && isThaiIdentifierChecksumValid(normalizedNumber);

    if (isThaiValid) {
      detections.push({
        raw: candidate.raw,
        normalizedNumber,
        startIndex: candidate.startIndex,
        endIndex: candidate.endIndex,
        type: 'THAI_NATIONAL_ID',
        checksumPassed: 'THAI_ID',
        matchedPrefixNetwork,
        contextSignals
      });
      continue;
    }

    if (luhnCheck(normalizedNumber) && matchedPrefixNetwork !== null) {
      detections.push({
        raw: candidate.raw,
        normalizedNumber,
        startIndex: candidate.startIndex,
        endIndex: candidate.endIndex,
        type: 'CREDIT_CARD',
        checksumPassed: 'LUHN',
        matchedPrefixNetwork,
        contextSignals
      });
      continue;
    }

    detections.push({
      raw: candidate.raw,
      normalizedNumber,
      startIndex: candidate.startIndex,
      endIndex: candidate.endIndex,
      type: 'NONE',
      checksumPassed: null,
      matchedPrefixNetwork,
      contextSignals
    });
  }

  return detections;
};
