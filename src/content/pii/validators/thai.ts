export const isThaiIdentifierChecksumValid = (value: string): boolean => {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  const digits = [...value].map((digit) => Number(digit));
  const weightedSum = digits.slice(0, 12).reduce((total, digit, index) => {
    return total + digit * (13 - index);
  }, 0);

  const checkDigit = (11 - (weightedSum % 11)) % 10;
  return checkDigit === digits[12];
};
