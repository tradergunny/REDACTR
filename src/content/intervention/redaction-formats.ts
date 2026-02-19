import { generateMask } from '../pii';
import type { DetectionResult } from '../pii/types';
import { defaultFormatForSeverity, getTokenMask, type RedactionFormat } from './types';

const GENERIC_REDACTED = '[REDACTED]';

export interface ResolvedFormats {
  formats: RedactionFormat[];
  defaultFormatId: string;
}

export const buildRedactionFormats = (
  detection: Pick<DetectionResult, 'category' | 'text' | 'suggestedMask' | 'severity'>
): ResolvedFormats => {
  const token = getTokenMask(detection.category);
  const partial = detection.suggestedMask || generateMask(detection.text, detection.category);

  const formats: RedactionFormat[] = [
    {
      id: 'token',
      label: token,
      mask: token
    },
    {
      id: 'partial',
      label: partial,
      mask: partial
    },
    {
      id: 'redacted',
      label: GENERIC_REDACTED,
      mask: GENERIC_REDACTED
    }
  ];

  const defaultFormatId = defaultFormatForSeverity(detection.severity);

  return {
    formats,
    defaultFormatId
  };
};
