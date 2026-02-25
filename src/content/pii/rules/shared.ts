import type {
  PIICategory,
  RuleMatch,
  ScoreSignal,
  ScoreSignalSource,
  Severity
} from '../types';

export interface RuleContextConfig {
  rule: string;
  category: PIICategory;
  severity: Severity;
  baseConfidence: number;
  contextBonus?: number;
  normalizedText?: string;
  countryHint?: string;
  scoreSignals?: ScoreSignal[];
  validationStage?: 'candidate' | 'validated';
  suppressedReason?: string;
}

export const runGlobalRegex = (pattern: RegExp, text: string): RegExpExecArray[] => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const expression = new RegExp(pattern.source, flags);
  const matches: RegExpExecArray[] = [];

  let match = expression.exec(text);
  while (match) {
    matches.push(match);
    match = expression.exec(text);
  }

  return matches;
};

export const makeRuleMatch = (
  matchText: string,
  startIndex: number,
  config: RuleContextConfig
): RuleMatch => ({
  text: matchText,
  normalizedText: config.normalizedText,
  startIndex,
  endIndex: startIndex + matchText.length,
  category: config.category,
  severity: config.severity,
  baseConfidence: config.baseConfidence,
  contextBonus: config.contextBonus,
  rule: config.rule,
  scoreSignals: config.scoreSignals ?? [],
  countryHint: config.countryHint,
  validationStage: config.validationStage ?? 'candidate',
  suppressedReason: config.suppressedReason
});

export const getContextWindow = (
  text: string,
  startIndex: number,
  endIndex: number,
  radius = 48
): string => {
  const left = Math.max(0, startIndex - radius);
  const right = Math.min(text.length, endIndex + radius);

  return text.slice(left, right).toLowerCase();
};

export const hasKeywordNearby = (
  text: string,
  startIndex: number,
  endIndex: number,
  keywords: string[],
  radius = 48
): boolean => {
  const context = getContextWindow(text, startIndex, endIndex, radius);
  return keywords.some((keyword) => context.includes(keyword.toLowerCase()));
};

export const hasSeparator = (value: string): boolean =>
  /[\s().\-\u00AD\u2060\u200B\u200C\u200D\uFEFF]/.test(value);

export const hasMixedCaseNameShape = (value: string): boolean =>
  /^([A-Z][a-z]+)(\s+[A-Z][a-z]+){1,2}$/.test(value.trim());

export const hasNegativeKeywordNearby = (
  text: string,
  startIndex: number,
  endIndex: number,
  keywords: string[],
  radius = 48
): boolean => {
  const context = getContextWindow(text, startIndex, endIndex, radius);
  return keywords.some((keyword) => context.includes(keyword.toLowerCase()));
};

export const normalizeAlphaNumeric = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, '').toUpperCase();

export const hasRepeatedCharacterRun = (
  value: string,
  minRunLength = 6
): boolean => new RegExp(`(.)\\1{${Math.max(1, minRunLength - 1)},}`).test(value);

export const isSequentialDigits = (value: string): boolean => {
  if (!/^\d{6,}$/.test(value)) {
    return false;
  }

  const ascending = '01234567890123456789';
  const descending = '98765432109876543210';
  return ascending.includes(value) || descending.includes(value);
};

export const pushSignal = (
  signals: ScoreSignal[],
  name: string,
  source: ScoreSignalSource,
  weight: number,
  applied = true
): ScoreSignal[] => {
  signals.push({
    name,
    source,
    weight,
    applied
  });

  return signals;
};

export const safeEntropy = (value: string): number => {
  if (!value) {
    return 0;
  }

  const counts = new Map<string, number>();

  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  const total = value.length;

  for (const count of counts.values()) {
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }

  return Number(entropy.toFixed(3));
};
