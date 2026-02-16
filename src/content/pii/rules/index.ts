import type { PIIRule } from '../types';
import { addressRule } from './address';
import { apiKeyRule } from './api-key';
import { bankAccountRule } from './bank-account';
import { creditCardRule } from './credit-card';
import { emailRule } from './email';
import { employeeNameRule } from './employee-name';
import { nationalIdRule } from './national-id';
import { passportRule } from './passport';
import { passwordRule } from './password';
import { phoneRule } from './phone';
import { ssnRule } from './ssn';

export const PII_RULES: PIIRule[] = [
  creditCardRule,
  bankAccountRule,
  ssnRule,
  apiKeyRule,
  passwordRule,
  passportRule,
  nationalIdRule,
  emailRule,
  phoneRule,
  employeeNameRule,
  addressRule
];
