import type { PIIRule, RuleMatch } from '../types';
import { hasMixedCaseNameShape, makeRuleMatch, runGlobalRegex } from './shared';

const EMPLOYEE_NAME_REGEX =
  /\b(?:employee(?: name)?|staff|patient|client|manager|supervisor|contact person|name is|my name is|ชื่อพนักงาน|ชื่อ)\b\s*(?:[:=-]|is)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi;

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

      if (!value || !hasMixedCaseNameShape(value)) {
        continue;
      }

      const valueStart = fullStart + fullMatch.indexOf(value);

      matches.push(
        makeRuleMatch(value, valueStart, {
          rule: 'employee_name.context',
          category: 'employee_name',
          severity: 'medium',
          baseConfidence: 0.74,
          contextBonus: 0.06
        })
      );
    }

    return matches;
  }
};
