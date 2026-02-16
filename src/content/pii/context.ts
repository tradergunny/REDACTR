import type { TextRange } from './types';
import { rangesOverlap } from './types';

const FENCED_CODE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]{1,240}`/g;
const HTML_PRE = /<pre\b[^>]*>[\s\S]*?<\/pre>/gi;
const HTML_CODE = /<code\b[^>]*>[\s\S]*?<\/code>/gi;

const toRanges = (regex: RegExp, input: string): TextRange[] => {
  const ranges: TextRange[] = [];
  const matches = input.matchAll(regex);

  for (const match of matches) {
    const startIndex = match.index;
    const text = match[0];

    if (typeof startIndex !== 'number' || !text) {
      continue;
    }

    ranges.push({
      startIndex,
      endIndex: startIndex + text.length
    });
  }

  return ranges;
};

const mergeRanges = (ranges: TextRange[]): TextRange[] => {
  if (!ranges.length) {
    return [];
  }

  const sorted = [...ranges].sort((left, right) => left.startIndex - right.startIndex);
  const merged: TextRange[] = [sorted[0]];

  for (const range of sorted.slice(1)) {
    const previous = merged[merged.length - 1];

    if (range.startIndex <= previous.endIndex) {
      previous.endIndex = Math.max(previous.endIndex, range.endIndex);
      continue;
    }

    merged.push(range);
  }

  return merged;
};

export const getCodeBlockRanges = (input: string): TextRange[] => {
  const ranges = [
    ...toRanges(FENCED_CODE, input),
    ...toRanges(INLINE_CODE, input),
    ...toRanges(HTML_PRE, input),
    ...toRanges(HTML_CODE, input)
  ];

  return mergeRanges(ranges);
};

export const isWithinCodeBlock = (range: TextRange, codeRanges: TextRange[]): boolean =>
  codeRanges.some((codeRange) => rangesOverlap(range, codeRange));
