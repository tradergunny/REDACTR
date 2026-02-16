import type { PIIRule, RuleMatch } from '../types';
import { hasSeparator, makeRuleMatch, runGlobalRegex } from './shared';

const PHONE_REGEX = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/g;
const THAI_LOCAL_MOBILE_REGEX = /^0(?:6|8|9)\d{8}$/;

export const phoneRule: PIIRule = {
  id: 'phone.international',
  category: 'phone',
  severity: 'medium',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(PHONE_REGEX, input)) {
      const value = candidate[0].trim();
      const digits = value.replace(/\D/g, '');
      const isThaiLocalMobile = THAI_LOCAL_MOBILE_REGEX.test(digits);

      if (digits.length < 10 || digits.length > 15) {
        continue;
      }

      if (!value.startsWith('+') && !hasSeparator(value) && !isThaiLocalMobile) {
        continue;
      }

      matches.push(
        makeRuleMatch(value, candidate.index ?? 0, {
          rule: 'phone.international',
          category: 'phone',
          severity: 'medium',
          baseConfidence: 0.84
        })
      );
    }

    return matches;
  }
};
