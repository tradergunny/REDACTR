import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import { makeRuleMatch, pushSignal, runGlobalRegex } from './shared';

const EMPLOYEE_NAME_REGEX =
  /\b(?:employee(?: name)?|staff|patient|client|manager|supervisor|contact person|name is|my name is|ชื่อพนักงาน|ชื่อ)\b\s*(?:[:=-]|is)?\s*([A-Za-z][A-Za-z.'-]{1,30}(?:\s+[A-Za-z][A-Za-z.'-]{1,30}){1,2})/gi;

const NON_PERSON_TOKENS = new Set([
  'team',
  'support',
  'product',
  'service',
  'department',
  'engineering',
  'marketing',
  'sales',
  'company'
]);

const isLikelyNameShape = (value: string): boolean => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 3) {
    return false;
  }

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (NON_PERSON_TOKENS.has(lower)) {
      return false;
    }

    if (!/^[A-Za-z][A-Za-z.'-]{1,30}$/.test(part)) {
      return false;
    }
  }

  const titleCaseCount = parts.filter((part) => /^[A-Z][a-z.'-]+$/.test(part)).length;
  return titleCaseCount >= 1;
};

export const employeeNameRule: PIIRule = {
  id: 'employee_name.context',
  category: 'employee_name',
  severity: 'medium',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(EMPLOYEE_NAME_REGEX, input)) {
      const fullMatch = candidate[0];
      const value = candidate[1];
      const fullStart = candidate.index ?? 0;

      if (!value || !isLikelyNameShape(value)) {
        continue;
      }

      const valueStart = fullStart + fullMatch.indexOf(value);
      const scoreSignals: ScoreSignal[] = [];
      pushSignal(scoreSignals, 'named_person_context', 'context', 0.05);
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(value.trim())) {
        pushSignal(scoreSignals, 'title_case_person_name', 'heuristic', 0.03);
      }

      matches.push(
        makeRuleMatch(value, valueStart, {
          rule: 'employee_name.context',
          category: 'employee_name',
          severity: 'medium',
          baseConfidence: 0.7,
          contextBonus: 0.05,
          validationStage: 'validated',
          scoreSignals
        })
      );
    }

    return matches;
  }
};
