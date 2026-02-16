import type { PIICategory, RuleMatch, Severity } from '../types';

export interface RuleContextConfig {
  rule: string;
  category: PIICategory;
  severity: Severity;
  baseConfidence: number;
  contextBonus?: number;
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
  startIndex,
  endIndex: startIndex + matchText.length,
  category: config.category,
  severity: config.severity,
  baseConfidence: config.baseConfidence,
  contextBonus: config.contextBonus,
  rule: config.rule
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

export const hasSeparator = (value: string): boolean => /[\s().-]/.test(value);

export const hasMixedCaseNameShape = (value: string): boolean =>
  /^([A-Z][a-z]+)(\s+[A-Z][a-z]+){1,2}$/.test(value.trim());
