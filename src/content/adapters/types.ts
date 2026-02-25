export type PlatformId = 'chatgpt' | 'claude';

export type InputType = 'textarea' | 'contenteditable' | 'input';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type IconPlacement = 'inside-right' | 'outside-right';

export interface IconPlacementConfig {
  placement: IconPlacement;
  rightPx?: number;
  bottomPx?: number;
}

export interface TextRange {
  startIndex: number;
  endIndex: number;
}

export interface TextReplacement extends TextRange {
  expectedText: string;
  replacementText: string;
}

export interface PlatformAdapter {
  readonly platformId: PlatformId;
  readonly platformName: string;
  readonly supportedUrls: RegExp[];

  detectInputElement(): HTMLElement | null;
  getInputType(): InputType;
  captureText(): string;
  setText(nextText: string): void;
  applyTextReplacements(baseText: string, replacements: TextReplacement[]): boolean;
  onTextChanged(callback: (text: string) => void): () => void;
  getSubmitButton(): HTMLElement | null;
  onSubmitIntercept(callback: (event: Event) => boolean): () => void;
  getIconAnchor(): HTMLElement | null;
  getIconPlacement(): IconPlacementConfig;
  getInputAreaWrapper(): HTMLElement | null;
  renderInlineHighlight(range: TextRange, severity: Severity): void;
  cleanup(): void;
}
