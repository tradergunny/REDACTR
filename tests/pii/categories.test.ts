import { describe, expect, it } from 'vitest';

import { detectPII } from '../../src/content/pii';
import type { PIICategory } from '../../src/content/pii';

interface CategoryCase {
  text: string;
  category: PIICategory;
  shouldDetect: boolean;
  description: string;
}

const cases: CategoryCase[] = [
  { text: 'Card: 4111 1111 1111 1111', category: 'credit_card', shouldDetect: true, description: 'visa spaced' },
  { text: 'Use 4012-8888-8888-1881 for billing', category: 'credit_card', shouldDetect: true, description: 'visa dashed' },
  { text: 'Amex card 378282246310005', category: 'credit_card', shouldDetect: true, description: 'amex' },
  { text: 'Mastercard 5555555555554444', category: 'credit_card', shouldDetect: true, description: 'mastercard' },
  { text: 'Discover 6011111111111117', category: 'credit_card', shouldDetect: true, description: 'discover' },
  { text: 'JCB 3530111333300000', category: 'credit_card', shouldDetect: false, description: 'jcb unsupported network' },
  { text: 'Invalid card 4111111111111112', category: 'credit_card', shouldDetect: false, description: 'invalid luhn' },
  { text: 'Short card 1234 5678 9012', category: 'credit_card', shouldDetect: false, description: 'too short' },
  { text: 'Noise 9999 9999 9999 9999', category: 'credit_card', shouldDetect: false, description: 'all nines invalid' },
  { text: 'ticket #1234567890123 only', category: 'credit_card', shouldDetect: false, description: 'random long digits not luhn' },

  { text: 'bank account number 123456789012', category: 'bank_account', shouldDetect: true, description: 'bank account keyword' },
  { text: 'acct: 000123456789 routing 021000021', category: 'bank_account', shouldDetect: true, description: 'acct and routing' },
  { text: 'เลขบัญชีธนาคาร 1234567890', category: 'bank_account', shouldDetect: true, description: 'thai bank keyword' },
  { text: 'Please wire to account no 9876543210123', category: 'bank_account', shouldDetect: true, description: 'account no context' },
  { text: 'ABA routing is 011000015', category: 'bank_account', shouldDetect: true, description: 'routing context' },
  { text: 'my bank account is 12345678', category: 'bank_account', shouldDetect: true, description: 'short account in context' },
  { text: 'Invoice number 123456789012', category: 'bank_account', shouldDetect: false, description: 'no bank context' },
  { text: 'The build id is 123456789', category: 'bank_account', shouldDetect: false, description: 'nine digits no routing context' },
  { text: 'ticket 12345678', category: 'bank_account', shouldDetect: false, description: 'no account context' },
  { text: 'random digits 12345678901234567', category: 'bank_account', shouldDetect: false, description: 'long number no context' },

  { text: 'SSN 123-45-6789', category: 'ssn', shouldDetect: true, description: 'ssn standard' },
  { text: 'social 078-05-1120', category: 'ssn', shouldDetect: true, description: 'ssn alternate' },
  { text: 'id 457 55 5462', category: 'ssn', shouldDetect: true, description: 'ssn with spaces' },
  { text: 'number 123456789', category: 'ssn', shouldDetect: false, description: 'ssn compact rejected for precision' },
  { text: 'record 219-09-9999', category: 'ssn', shouldDetect: true, description: 'ssn valid prefix' },
  { text: 'staff ssn: 212 55 1212', category: 'ssn', shouldDetect: true, description: 'ssn explicit keyword' },
  { text: 'bad ssn 000-12-3456', category: 'ssn', shouldDetect: false, description: 'invalid area' },
  { text: 'bad ssn 666-10-1000', category: 'ssn', shouldDetect: false, description: 'invalid area 666' },
  { text: 'bad ssn 900-12-3456', category: 'ssn', shouldDetect: false, description: 'invalid area 9xx' },
  { text: 'bad ssn 123-00-6789', category: 'ssn', shouldDetect: false, description: 'invalid group' },

  { text: 'AWS key AKIAABCDEFGHIJKLMNOP', category: 'api_key', shouldDetect: true, description: 'aws akia key' },
  { text: 'Stripe key sk_live_a1b2c3d4e5f6g7h8i9j0', category: 'api_key', shouldDetect: true, description: 'stripe live key' },
  { text: 'OpenAI key sk-abcdefghijklmnopqrstuvwxyz123456', category: 'api_key', shouldDetect: true, description: 'openai style key' },
  { text: 'GitHub token ghp_abcdefghijklmnopqrstuvwxyz1234567890', category: 'api_key', shouldDetect: true, description: 'github pat' },
  { text: 'Google key AIza12345678901234567890123456789012345', category: 'api_key', shouldDetect: true, description: 'google api key style' },
  { text: 'Another key sk-1234567890abcdefghijklmnop', category: 'api_key', shouldDetect: true, description: 'openai key second pattern' },
  { text: 'short AKIA1234', category: 'api_key', shouldDetect: false, description: 'short aws key' },
  { text: 'test stripe sk_test_abc123', category: 'api_key', shouldDetect: false, description: 'stripe test key' },
  { text: 'short openai sk-12345', category: 'api_key', shouldDetect: false, description: 'short openai key' },
  { text: 'short github ghp_shorttoken', category: 'api_key', shouldDetect: false, description: 'short github token' },

  { text: 'password: Hunter2!', category: 'password', shouldDetect: true, description: 'password colon' },
  { text: 'pwd=SuperSecret123', category: 'password', shouldDetect: true, description: 'pwd equals' },
  { text: 'passphrase is openSesame42', category: 'password', shouldDetect: true, description: 'passphrase is' },
  { text: 'รหัสผ่าน: abcDEF123!', category: 'password', shouldDetect: true, description: 'thai password keyword' },
  { text: 'passwd = zYxw9876', category: 'password', shouldDetect: true, description: 'passwd variant' },
  { text: 'password = token_1234', category: 'password', shouldDetect: true, description: 'password assignment second' },
  { text: 'the word password appears here', category: 'password', shouldDetect: false, description: 'keyword only' },
  { text: 'pwd status enabled', category: 'password', shouldDetect: false, description: 'pwd no assignment' },
  { text: 'passphrase guidance document', category: 'password', shouldDetect: false, description: 'passphrase no value' },
  { text: 'secret: abc123', category: 'password', shouldDetect: false, description: 'no password keyword' },

  { text: 'Passport: AB1234567', category: 'passport', shouldDetect: true, description: 'thai style with keyword' },
  { text: 'passport number A1234567', category: 'passport', shouldDetect: true, description: 'single letter passport' },
  { text: 'หนังสือเดินทาง AB123456', category: 'passport', shouldDetect: true, description: 'thai passport keyword' },
  { text: 'US passport 123456789', category: 'passport', shouldDetect: true, description: 'us passport context' },
  { text: 'passport id C123456', category: 'passport', shouldDetect: true, description: 'short thai pattern' },
  { text: 'passport: XZ7654321', category: 'passport', shouldDetect: true, description: 'two-letter passport' },
  { text: 'AB1234567', category: 'passport', shouldDetect: true, description: 'passport without context' },
  { text: 'serial 123456789', category: 'passport', shouldDetect: false, description: 'nine digits no context' },
  { text: 'passport code 12345', category: 'passport', shouldDetect: false, description: 'too short passport' },
  { text: 'document AB12', category: 'passport', shouldDetect: false, description: 'invalid passport shape' },

  { text: 'Thai national id 1101700203450', category: 'national_id', shouldDetect: true, description: 'thai checksum id with context' },
  { text: 'citizen id: 3101700601231', category: 'national_id', shouldDetect: true, description: 'thai citizen id' },
  { text: '1-1017-00203-45-0', category: 'national_id', shouldDetect: true, description: 'thai id formatted without context' },
  { text: 'เลขประจำตัวประชาชน 1319900012343', category: 'national_id', shouldDetect: true, description: 'thai national id thai keyword' },
  { text: 'taxpayer id 1000000000009', category: 'national_id', shouldDetect: true, description: 'thai tax id style' },
  { text: 'company registration 1234567890121', category: 'national_id', shouldDetect: true, description: 'thai company registration id' },
  { text: 'candidate number 4000000000071', category: 'national_id', shouldDetect: true, description: 'thai id prioritized over visa+luhn overlap' },
  { text: 'ITIN 912-70-1234', category: 'national_id', shouldDetect: true, description: 'us itin with context' },
  { text: 'my id is 1101700203450', category: 'national_id', shouldDetect: true, description: 'checksum-valid thai id without explicit context' },
  { text: 'tax number 1234567890123', category: 'national_id', shouldDetect: false, description: 'tax without required keyword phrase' },
  { text: '912-70-1234', category: 'national_id', shouldDetect: false, description: 'itin without context' },
  { text: 'individual number 9999999999995', category: 'national_id', shouldDetect: false, description: 'invalid thai checksum without context' },

  { text: 'Email me at jane.doe@example.com', category: 'email', shouldDetect: true, description: 'basic email' },
  { text: 'ops+alerts@service.io', category: 'email', shouldDetect: true, description: 'plus email' },
  { text: 'support_team@company.co.uk', category: 'email', shouldDetect: true, description: 'subdomain email' },
  { text: 'mail: alpha.beta-1@foo-bar.org', category: 'email', shouldDetect: true, description: 'mixed characters email' },
  { text: 'x@yz.ai', category: 'email', shouldDetect: true, description: 'short local email' },
  { text: 'reach us at engineer123@acme.dev', category: 'email', shouldDetect: true, description: 'numeric local part email' },
  { text: 'invalid user@@example.com', category: 'email', shouldDetect: false, description: 'double at invalid' },
  { text: 'invalid user.example.com', category: 'email', shouldDetect: false, description: 'missing at symbol' },
  { text: 'invalid user@localhost', category: 'email', shouldDetect: false, description: 'missing tld' },
  { text: 'invalid user@com', category: 'email', shouldDetect: false, description: 'short domain no dot' },

  { text: 'Call me at +1 (415) 555-2671', category: 'phone', shouldDetect: true, description: 'us international format' },
  { text: 'Dial 415-555-2671 now', category: 'phone', shouldDetect: true, description: 'us dashed format' },
  { text: 'Thai mobile +66 81 234 5678', category: 'phone', shouldDetect: true, description: 'thai mobile intl format' },
  { text: 'Thai mobile 0853236132', category: 'phone', shouldDetect: true, description: 'thai local mobile without separators' },
  { text: 'เบอร์โทร 0961234567', category: 'phone', shouldDetect: true, description: 'thai local mobile with thai context' },
  { text: 'Office number (212) 555 1212', category: 'phone', shouldDetect: true, description: 'parenthesized area code' },
  { text: 'UK line +44 20 7946 0958', category: 'phone', shouldDetect: true, description: 'uk format' },
  { text: 'desk 02-123-45678', category: 'phone', shouldDetect: true, description: 'thai local with separators' },
  { text: 'Order 1234567890', category: 'phone', shouldDetect: false, description: 'digits without separator' },
  { text: 'version 1.2.3', category: 'phone', shouldDetect: false, description: 'version string' },
  { text: 'room 415', category: 'phone', shouldDetect: false, description: 'short number' },
  { text: 'code +12', category: 'phone', shouldDetect: false, description: 'too short international code' },

  { text: 'employee name: John Doe', category: 'employee_name', shouldDetect: true, description: 'employee name context' },
  { text: 'my name is Alice Johnson', category: 'employee_name', shouldDetect: true, description: 'name is phrase' },
  { text: 'Patient: Maria Garcia', category: 'employee_name', shouldDetect: true, description: 'patient context' },
  { text: 'contact person = David Miller', category: 'employee_name', shouldDetect: true, description: 'contact person context' },
  { text: 'Manager is Kevin Hart', category: 'employee_name', shouldDetect: true, description: 'manager context' },
  { text: 'staff: Emma Stone', category: 'employee_name', shouldDetect: true, description: 'staff context' },
  { text: 'employee name: john doe', category: 'employee_name', shouldDetect: false, description: 'lowercase name rejected' },
  { text: 'name is JOHN DOE', category: 'employee_name', shouldDetect: false, description: 'uppercase full name rejected' },
  { text: 'my name is A', category: 'employee_name', shouldDetect: false, description: 'single-letter name rejected' },
  { text: 'employee list updated', category: 'employee_name', shouldDetect: false, description: 'no extracted name' },

  { text: '123 Main Street, Springfield', category: 'address', shouldDetect: true, description: 'us street suffix' },
  { text: '742 Evergreen Road, Springfield', category: 'address', shouldDetect: true, description: 'us road suffix' },
  { text: 'address: 88 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย', category: 'address', shouldDetect: true, description: 'thai address keyword and tokens' },
  { text: 'shipping address - 1600 Amphitheatre Road, Mountain View', category: 'address', shouldDetect: true, description: 'shipping address context' },
  { text: 'billing address: 55/2 ถนนพระราม 9 แขวงบางกะปิ เขตห้วยขวาง', category: 'address', shouldDetect: true, description: 'billing thai address' },
  { text: '45 Lake View Ave, Boston', category: 'address', shouldDetect: true, description: 'us ave suffix' },
  { text: 'Main Street is closed', category: 'address', shouldDetect: false, description: 'street mention without number' },
  { text: 'address pending', category: 'address', shouldDetect: false, description: 'address keyword no structure' },
  { text: 'warehouse zone 7', category: 'address', shouldDetect: false, description: 'no street suffix or context detail' },
  { text: 'roadmap item 123', category: 'address', shouldDetect: false, description: 'roadmap word is not address' }
];

describe('pii category corpus', () => {
  it('contains at least 100 corpus cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(100);
  });

  for (const testCase of cases) {
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

  it('detects two phones on one line separated by a space', () => {
    const detections = detectPII('Contacts: 415-555-2671 212-555-1212');
    const phones = detections.filter((detection) => detection.category === 'phone');

    expect(phones).toHaveLength(2);
    expect(phones.map((phone) => phone.text)).toEqual(['415-555-2671', '212-555-1212']);
  });

  it('detects two phones separated by a single newline', () => {
    const detections = detectPII('Contacts:\n415-555-2671\n212-555-1212');
    const phones = detections.filter((detection) => detection.category === 'phone');

    expect(phones).toHaveLength(2);
    expect(phones.map((phone) => phone.text)).toEqual(['415-555-2671', '212-555-1212']);
  });

  it('detects phones with repeated spaces between groups', () => {
    const detections = detectPII('Dial 415  555  2671 now');
    const phones = detections.filter((detection) => detection.category === 'phone');

    expect(phones).toHaveLength(1);
    expect(phones[0]?.text).toBe('415  555  2671');
  });
});
