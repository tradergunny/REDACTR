import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import {
  isAbaRoutingNumberValid,
  isIbanChecksumValid,
  normalizeIban
} from '../validators/bank';
import {
  hasNegativeKeywordNearby,
  hasKeywordNearby,
  makeRuleMatch,
  pushSignal,
  runGlobalRegex
} from './shared';

const ACCOUNT_NUMBER_REGEX = /\b\d{7,17}\b/g;
const THAI_FORMATTED_ACCOUNT_REGEX = /\b\d{3}-\d-\d{5}-\d\b/g;

const ROUTING_NUMBER_REGEX = /\b\d{9}\b/g;
const IBAN_REGEX = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

const BANK_KEYWORDS = [
  'bank account',
  'account number',
  'account no',
  'acct',
  'routing',
  'aba',
  'iban',
  'swift',
  'bic',
  'เลขบัญชี',
  'บัญชีธนาคาร',
  'ธนาคาร'
];

const ROUTING_KEYWORDS = ['routing', 'aba'];
const THAI_BANK_NAME_KEYWORDS = [
  'bangkok bank',
  'kasikorn',
  'krungsri',
  'krungthai',
  'scb',
  'siam commercial',
  'ttb',
  'uob thailand',
  'ธนาคารกรุงเทพ',
  'ธนาคารกสิกรไทย',
  'ธนาคารกรุงไทย',
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารไทยพาณิชย์'
];
const NEGATIVE_KEYWORDS = [
  'invoice',
  'ticket',
  'order',
  'build',
  'version',
  'serial',
  'tracking',
  'reference',
  'ref'
];

export const bankAccountRule: PIIRule = {
  id: 'bank_account.context',
  category: 'bank_account',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];
    const pushAccountMatch = (value: string, startIndex: number): void => {
      const endIndex = startIndex + value.length;
      const scoreSignals: ScoreSignal[] = [];
      const normalizedDigits = value.replace(/\D/g, '');

      if (!hasKeywordNearby(input, startIndex, endIndex, BANK_KEYWORDS, 56)) {
        return;
      }

      if (hasNegativeKeywordNearby(input, startIndex, endIndex, NEGATIVE_KEYWORDS, 32)) {
        return;
      }

      if (normalizedDigits.length >= 10) {
        pushSignal(scoreSignals, 'account_length_high_signal', 'heuristic', 0.02);
      }

      if (hasKeywordNearby(input, startIndex, endIndex, THAI_BANK_NAME_KEYWORDS, 96)) {
        pushSignal(scoreSignals, 'thai_bank_name_nearby', 'context', 0.03);
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'bank_account.context',
          category: 'bank_account',
          severity: 'critical',
          baseConfidence: 0.82,
          contextBonus: 0.08,
          normalizedText: normalizedDigits,
          validationStage: 'validated',
          scoreSignals
        })
      );
    };

    for (const candidate of runGlobalRegex(ACCOUNT_NUMBER_REGEX, input)) {
      pushAccountMatch(candidate[0], candidate.index ?? 0);
    }

    for (const candidate of runGlobalRegex(THAI_FORMATTED_ACCOUNT_REGEX, input)) {
      pushAccountMatch(candidate[0], candidate.index ?? 0);
    }

    for (const candidate of runGlobalRegex(ROUTING_NUMBER_REGEX, input)) {
      const value = candidate[0];
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;
      const scoreSignals: ScoreSignal[] = [];

      if (!hasKeywordNearby(input, startIndex, endIndex, ROUTING_KEYWORDS, 36)) {
        continue;
      }

      if (!isAbaRoutingNumberValid(value)) {
        pushSignal(scoreSignals, 'routing_checksum_invalid', 'validator', -0.08);
      } else {
        pushSignal(scoreSignals, 'routing_checksum_valid', 'validator', 0.06);
      }

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'bank_account.routing',
          category: 'bank_account',
          severity: 'critical',
          baseConfidence: 0.85,
          contextBonus: 0.06,
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'us'
        })
      );
    }

    for (const candidate of runGlobalRegex(IBAN_REGEX, input)) {
      const value = candidate[0];
      const startIndex = candidate.index ?? 0;
      const endIndex = startIndex + value.length;
      const scoreSignals: ScoreSignal[] = [];

      if (
        !hasKeywordNearby(input, startIndex, endIndex, ['iban', 'swift', 'bank'], 48)
      ) {
        pushSignal(scoreSignals, 'iban_no_explicit_context', 'context', -0.07);
      } else {
        pushSignal(scoreSignals, 'iban_context_present', 'context', 0.05);
      }

      if (!isIbanChecksumValid(value)) {
        continue;
      }

      pushSignal(scoreSignals, 'iban_checksum_valid', 'validator', 0.08);

      matches.push(
        makeRuleMatch(value, startIndex, {
          rule: 'bank_account.iban',
          category: 'bank_account',
          severity: 'critical',
          baseConfidence: 0.84,
          contextBonus: 0.03,
          normalizedText: normalizeIban(value),
          validationStage: 'validated',
          scoreSignals,
          countryHint: 'global'
        })
      );
    }

    return matches;
  }
};
