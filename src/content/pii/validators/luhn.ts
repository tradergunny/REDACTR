export const normalizeDigits = (value: string): string => value.replace(/\D/g, '');

export const luhnCheck = (input: string): boolean => {
  const num = normalizeDigits(input);

  if (!/^\d{13,19}$/.test(num)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = num.length - 1; index >= 0; index -= 1) {
    let digit = Number(num[index]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};
