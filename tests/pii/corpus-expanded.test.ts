import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';
import type { PIICategory } from '../../src/content/pii';

interface CategoryCase {
  text: string;
  category: PIICategory;
  shouldDetect: boolean;
  description: string;
}

interface SeedGroup {
  category: PIICategory;
  positives: string[];
  negatives: string[];
}

const WRAPPERS = [
  'audit record',
  'support transcript',
  'staging note',
  'ops payload',
  'compliance sample',
  'helpdesk log',
  'migration batch',
  'qa corpus'
];

const SEED_GROUPS: SeedGroup[] = [
  {
    category: 'credit_card',
    positives: [
      'Card: 4111 1111 1111 1111',
      'Use 4012-8888-8888-1881 for billing',
      'Amex card 378282246310005'
    ],
    negatives: ['Invalid card 4111111111111112', 'ticket #1234567890123 only']
  },
  {
    category: 'bank_account',
    positives: [
      'bank account number 123456789012',
      'acct: 000123456789 routing 021000021',
      'IBAN GB82WEST12345698765432'
    ],
    negatives: ['Invoice number 123456789012', 'The build id is 123456789']
  },
  {
    category: 'ssn',
    positives: ['SSN 123-45-6789', 'social 078-05-1120', 'ssn 123456789'],
    negatives: ['bad ssn 000-12-3456', 'number 123456789']
  },
  {
    category: 'api_key',
    positives: [
      'AWS key AKIAABCDEFGHIJKLMNOP',
      'OpenAI key sk-abcdefghijklmnopqrstuvwxyz123456',
      'Slack token xoxb-123456789012-123456789012-abcdefghijklmnopqrstuv'
    ],
    negatives: ['short AKIA1234', 'fake token sk_test_abc123']
  },
  {
    category: 'password',
    positives: ['password: Hunter2!', 'PASSWD=Sup3rSecret!', '--password UltraSafe123'],
    negatives: ['the word password appears here', 'passphrase guidance document']
  },
  {
    category: 'passport',
    positives: ['AB1234567', 'Passport: XZ7654321', 'US passport 123456789'],
    negatives: ['serial 123456789', 'document AB12']
  },
  {
    category: 'national_id',
    positives: [
      'Thai national id 1101700203450',
      'citizen id: 3101700601231',
      '1-1017-00203-45-0',
      'candidate number 4000000000071',
      'ITIN 912-70-1234'
    ],
    negatives: ['my id is 1101700203451', '912-70-1234']
  },
  {
    category: 'email',
    positives: [
      'jane.doe@example.com',
      'ops+alerts@service.io',
      'engineer123@acme.dev'
    ],
    negatives: ['invalid user@@example.com', 'invalid user@localhost']
  },
  {
    category: 'phone',
    positives: ['+1 (415) 555-2671', '415-555-2671', '0853236132'],
    negatives: ['version 1.2.3', 'room 415']
  },
  {
    category: 'employee_name',
    positives: [
      'employee name: John Doe',
      'my name is Alice Johnson',
      'contact person = David Miller'
    ],
    negatives: ['employee list updated', 'employee name: john doe']
  },
  {
    category: 'address',
    positives: [
      '123 Main Street, Springfield',
      'shipping address - 1600 Amphitheatre Road, Mountain View',
      'address: 88 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย'
    ],
    negatives: ['Main Street is closed', 'address pending']
  }
];

const expandedCases: CategoryCase[] = SEED_GROUPS.flatMap((group) =>
  WRAPPERS.flatMap((wrapper, wrapperIndex) => [
    ...group.positives.map((seed, seedIndex) => ({
      text: `${wrapper} ${seed} #P${wrapperIndex}-${seedIndex}`,
      category: group.category,
      shouldDetect: true,
      description: `${group.category} positive ${wrapperIndex}-${seedIndex}`
    })),
    ...group.negatives.map((seed, seedIndex) => ({
      text: `${wrapper} ${seed} #N${wrapperIndex}-${seedIndex}`,
      category: group.category,
      shouldDetect: false,
      description: `${group.category} negative ${wrapperIndex}-${seedIndex}`
    }))
  ])
);

describe('pii expanded category corpus', () => {
  it('contains at least 350 generated cases', () => {
    expect(expandedCases.length).toBeGreaterThanOrEqual(350);
  });

  for (const testCase of expandedCases) {
    it(`${testCase.category}: ${testCase.description}`, () => {
      const detections = detectPII(testCase.text);
      const hasCategory = detections.some(
        (detection) => detection.category === testCase.category
      );

      if (testCase.shouldDetect) {
        expect(hasCategory).toBe(true);
        return;
      }

      expect(hasCategory).toBe(false);
    });
  }
});
