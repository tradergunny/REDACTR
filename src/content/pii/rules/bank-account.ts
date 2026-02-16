import type { PIIRule, RuleMatch } from '../types';
import {
  hasKeywordNearby,
  makeRuleMatch,
  runGlobalRegex
} from './shared';

const ACCOUNT_NUMBER_REGEX = /\b\d{7,17}\b/g;

const ROUTING_NUMBER_REGEX = /\b\d{9}\b/g;

const BANK_KEYWORDS = [
  'bank account',
  'account number',
  'account no',
  'acct',
  'routing',
  'aba',
  'iban',
  'swift',
  'เลขบัญชี',
  'บัญชีธนาคาร',
  'ธนาคาร'
];

const ROUTING_KEYWORDS = ['routing', 'aba'];

export const bankAccountRule: PIIRule = {
  id: 'bank_account.context',
  category: 'bank_account',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of runGlobalRegex(ACCOUNT_NUMBER_REGEX, input)) {
      const value = candidate[0];
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;

      if (!hasKeywordNearby(input, startIndex, endIndex, BANK_KEYWORDS, 56)) {
        continue;
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'bank_account.context',
          category: 'bank_account',
          severity: 'critical',
          baseConfidence: 0.89,
          contextBonus: 0.06
        })
      );
    }

    for (const candidate of runGlobalRegex(ROUTING_NUMBER_REGEX, input)) {
      const value = candidate[0];
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;

      if (!hasKeywordNearby(input, startIndex, endIndex, ROUTING_KEYWORDS, 36)) {
        continue;
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'bank_account.routing',
          category: 'bank_account',
          severity: 'critical',
          baseConfidence: 0.9,
          contextBonus: 0.05
        })
      );
    }

    return matches;
  }
};
