import type { PIIEvent } from './events';
import type { DetectionResult, PIICategory } from '../content/pii/types';

export const EXTENSION_ENABLED_KEY = 'extensionEnabled';
export const DEFAULT_EXTENSION_ENABLED = true;
export const PII_EVENTS_KEY = 'piiEvents';
const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_STORED_EVENTS = 5000;
export const ALLOWLIST_ENTRIES_KEY = 'allowlistEntries';
export const ALLOWLIST_MAX_ENTRIES = 100;

export interface AllowlistEntry {
  category: PIICategory;
  value: string;
  created_at: string;
}

export const getExtensionEnabled = async (): Promise<boolean> => {
  const result = await chrome.storage.sync.get(EXTENSION_ENABLED_KEY);
  const enabled = result[EXTENSION_ENABLED_KEY];

  if (typeof enabled === 'boolean') {
    return enabled;
  }

  return DEFAULT_EXTENSION_ENABLED;
};

export const setExtensionEnabled = async (enabled: boolean): Promise<void> => {
  await chrome.storage.sync.set({ [EXTENSION_ENABLED_KEY]: enabled });
};

const isFreshEvent = (event: PIIEvent, now: number): boolean => {
  const timestamp = Date.parse(event.timestamp);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return now - timestamp <= EVENT_RETENTION_MS;
};

export const appendPIIEvent = async (event: PIIEvent): Promise<void> => {
  const result = await chrome.storage.local.get(PII_EVENTS_KEY);
  const events = result[PII_EVENTS_KEY];
  const storedEvents = Array.isArray(events) ? (events as PIIEvent[]) : [];
  const now = Date.now();

  const retained = storedEvents.filter((storedEvent) =>
    isFreshEvent(storedEvent, now)
  );

  retained.push(event);

  const trimmed =
    retained.length > MAX_STORED_EVENTS
      ? retained.slice(retained.length - MAX_STORED_EVENTS)
      : retained;

  await chrome.storage.local.set({ [PII_EVENTS_KEY]: trimmed });
};

const isAllowlistEntry = (value: unknown): value is AllowlistEntry => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AllowlistEntry>;
  return (
    typeof candidate.category === 'string' &&
    typeof candidate.value === 'string' &&
    typeof candidate.created_at === 'string'
  );
};

const getEntryKey = (entry: Pick<AllowlistEntry, 'category' | 'value'>): string =>
  `${entry.category}:${entry.value}`;

export const getAllowlistEntries = async (): Promise<AllowlistEntry[]> => {
  const result = await chrome.storage.sync.get(ALLOWLIST_ENTRIES_KEY);
  const rawEntries = result[ALLOWLIST_ENTRIES_KEY];
  const entries = Array.isArray(rawEntries)
    ? rawEntries.filter((entry) => isAllowlistEntry(entry))
    : [];

  return entries
    .map((entry) => ({
      category: entry.category,
      value: entry.value.trim(),
      created_at: entry.created_at
    }))
    .filter((entry) => entry.value.length > 0);
};

export const addAllowlistEntries = async (
  entries: AllowlistEntry[]
): Promise<AllowlistEntry[]> => {
  const existing = await getAllowlistEntries();
  const merged = [...existing];

  for (const entry of entries) {
    const normalized: AllowlistEntry = {
      category: entry.category,
      value: entry.value.trim(),
      created_at: entry.created_at || new Date().toISOString()
    };

    if (!normalized.value) {
      continue;
    }

    const key = getEntryKey(normalized);
    const duplicateIndex = merged.findIndex((item) => getEntryKey(item) === key);
    if (duplicateIndex >= 0) {
      merged.splice(duplicateIndex, 1);
    }

    merged.push(normalized);
  }

  const deduped: AllowlistEntry[] = [];
  const seen = new Set<string>();
  for (const entry of merged) {
    const key = getEntryKey(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }

  const trimmed =
    deduped.length > ALLOWLIST_MAX_ENTRIES
      ? deduped.slice(deduped.length - ALLOWLIST_MAX_ENTRIES)
      : deduped;

  await chrome.storage.sync.set({ [ALLOWLIST_ENTRIES_KEY]: trimmed });
  return trimmed;
};

export const isDetectionAllowlisted = (
  detection: Pick<DetectionResult, 'category' | 'text'>,
  entries: AllowlistEntry[]
): boolean =>
  entries.some(
    (entry) =>
      entry.category === detection.category && entry.value === detection.text
  );
