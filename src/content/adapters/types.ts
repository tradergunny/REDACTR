import type { DetectionDecision, PIICategory } from '../pii/types';

export type PlatformId = 'chatgpt' | 'claude';

export type InputType = 'textarea' | 'contenteditable' | 'input';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface TextRange {
  startIndex: number;
  endIndex: number;
}

export interface WarningConfig {
  severity: Severity;
  blocking?: boolean;
  title?: string;
  message?: string;
  findings?: {
    key: string;
    category: PIICategory;
    severity: Severity;
    maskedPreview: string;
    confidence: number;
    decision?: DetectionDecision;
  }[];
}

export interface PlatformAdapter {
  readonly platformId: PlatformId;
  readonly platformName: string;
  readonly supportedUrls: RegExp[];

  detectInputElement(): HTMLElement | null;
  getInputType(): InputType;
  captureText(): string;
  onTextChanged(callback: (text: string) => void): () => void;
  getSubmitButton(): HTMLElement | null;
  onSubmitIntercept(callback: (event: Event) => boolean): () => void;
  getWarningAnchor(): HTMLElement | null;
  renderWarning(warning: WarningConfig): HTMLElement;
  renderInlineHighlight(range: TextRange, severity: Severity): void;
  cleanup(): void;
}
