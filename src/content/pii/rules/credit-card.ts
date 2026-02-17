import type { PIIRule, RuleMatch, ScoreSignal } from '../types';
import {
  type CardNetwork,
  detectThaiIdOrCardCandidates
} from '../validators/id-card-detector';
import {
  makeRuleMatch,
  pushSignal
} from './shared';

const networkSignalName = (network: CardNetwork): string => {
  if (network === 'VISA') {
    return 'issuer_network_visa';
  }

  if (network === 'MASTERCARD') {
    return 'issuer_network_mastercard';
  }

  if (network === 'AMEX') {
    return 'issuer_network_amex';
  }

  if (network === 'DISCOVER') {
    return 'issuer_network_discover';
  }

  return 'issuer_network_unknown';
};

export const creditCardRule: PIIRule = {
  id: 'credit_card.luhn',
  category: 'credit_card',
  severity: 'critical',
  detect(input: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const candidate of detectThaiIdOrCardCandidates(input)) {
      if (candidate.type !== 'CREDIT_CARD') {
        continue;
      }

      const scoreSignals: ScoreSignal[] = [];

      if (candidate.matchedPrefixNetwork !== null) {
        pushSignal(
          scoreSignals,
          networkSignalName(candidate.matchedPrefixNetwork),
          'validator',
          0.02
        );
      }

      if (candidate.contextSignals.cardKeywordNearby) {
        pushSignal(scoreSignals, 'card_context_present', 'context', 0.03);
      }

      if (candidate.contextSignals.thaiKeywordNearby) {
        pushSignal(scoreSignals, 'thai_id_context_nearby', 'context', -0.01);
      }

      if (candidate.contextSignals.negativeKeywordNearby) {
        pushSignal(scoreSignals, 'ambiguous_numeric_context', 'suppressor', -0.02);
      }

      matches.push(
        makeRuleMatch(candidate.raw, candidate.startIndex, {
          rule: 'credit_card.luhn',
          category: 'credit_card',
          severity: 'critical',
          baseConfidence: 0.96,
          normalizedText: candidate.normalizedNumber,
          validationStage: 'validated',
          scoreSignals
        })
      );
    }

    return matches;
  }
};
