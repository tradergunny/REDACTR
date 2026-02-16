import type { PIICategory } from './types';

const DEFAULT_MASK = '[REDACTED]';

const maskDigitsKeepLast = (value: string, visibleDigits: number): string => {
  let seenDigits = 0;
  const totalDigits = (value.match(/\d/g) ?? []).length;

  return [...value]
    .map((character) => {
      if (!/\d/.test(character)) {
        return character;
      }

      seenDigits += 1;
      if (totalDigits - seenDigits < visibleDigits) {
        return character;
      }

      return '*';
    })
    .join('');
};

export const generateMask = (text: string, category: PIICategory): string => {
  if (!text) {
    return DEFAULT_MASK;
  }

  switch (category) {
    case 'email': {
      const [local = '', domain = 'redacted.local'] = text.split('@');
      const localStart = local.slice(0, 1) || 'x';
      return `${localStart}***@${domain}`;
    }

    case 'phone':
      return maskDigitsKeepLast(text, 4);

    case 'ssn': {
      const digits = text.replace(/\D/g, '');
      return `***-**-${digits.slice(-4).padStart(4, '*')}`;
    }

    case 'credit_card': {
      const digits = text.replace(/\D/g, '');
      return `****-****-****-${digits.slice(-4).padStart(4, '*')}`;
    }

    case 'api_key':
      return `${text.slice(0, 8)}****`;

    case 'password':
      return '********';

    case 'bank_account':
      return maskDigitsKeepLast(text, 4);

    case 'passport': {
      if (text.length <= 4) {
        return DEFAULT_MASK;
      }

      return `${text.slice(0, 2)}****${text.slice(-2)}`;
    }

    case 'national_id': {
      const digits = text.replace(/\D/g, '');
      if (digits.length >= 4) {
        return `${'*'.repeat(Math.max(digits.length - 4, 2))}${digits.slice(-4)}`;
      }

      return DEFAULT_MASK;
    }

    case 'employee_name': {
      const parts = text.split(/\s+/).filter(Boolean);
      if (!parts.length) {
        return DEFAULT_MASK;
      }

      return parts
        .map((part) => `${part.slice(0, 1)}***`)
        .join(' ');
    }

    case 'address': {
      const visible = text.slice(-6);
      return `${'*'.repeat(Math.max(text.length - visible.length, 8))}${visible}`;
    }

    default:
      return DEFAULT_MASK;
  }
};
