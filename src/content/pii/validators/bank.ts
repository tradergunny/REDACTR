const MOD97_MAX_CHUNK = 9;

export const normalizeIban = (value: string): string =>
  value.replace(/\s+/g, '').toUpperCase();

const toIbanNumeric = (value: string): string => {
  let converted = '';

  for (const char of value) {
    if (/[0-9]/.test(char)) {
      converted += char;
      continue;
    }

    if (/[A-Z]/.test(char)) {
      converted += String(char.charCodeAt(0) - 55);
      continue;
    }

    return '';
  }

  return converted;
};

export const isIbanChecksumValid = (value: string): boolean => {
  const iban = normalizeIban(value);

  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$/.test(iban)) {
    return false;
  }

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const numeric = toIbanNumeric(rearranged);
  if (!numeric) {
    return false;
  }

  let remainder = 0;
  for (let index = 0; index < numeric.length; index += MOD97_MAX_CHUNK) {
    const chunk = `${remainder}${numeric.slice(index, index + MOD97_MAX_CHUNK)}`;
    remainder = Number(chunk) % 97;
  }

  return remainder === 1;
};

export const isAbaRoutingNumberValid = (value: string): boolean => {
  if (!/^\d{9}$/.test(value)) {
    return false;
  }

  const digits = [...value].map((digit) => Number(digit));
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8]);

  return checksum % 10 === 0;
};

