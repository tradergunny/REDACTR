import type { PIIEvent } from './events';
import type {
  CategoryThreshold,
  DetectionExecutionMode,
  DetectionMode,
  DetectionResult,
  PIICategory
} from '../content/pii/types';

export const EXTENSION_ENABLED_KEY = 'extensionEnabled';
export const DEFAULT_EXTENSION_ENABLED = true;
export const DETECTION_SETTINGS_KEY = 'detectionSettings';
export const PII_EVENTS_KEY = 'piiEvents';
const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_STORED_EVENTS = 5000;
export const ALLOWLIST_ENTRIES_KEY = 'allowlistEntries';
export const ALLOWLIST_MAX_ENTRIES = 100;

const DEFAULT_ENABLED_CATEGORIES: PIICategory[] = [
  'credit_card',
  'card_cvv',
  'card_expiry',
  'bank_account',
  'ssn',
  'api_key',
  'password',
  'passport',
  'national_id',
  'email',
  'phone',
  'employee_name',
  'address'
];

export interface DetectionSettings {
  mode: DetectionMode;
  executionMode: DetectionExecutionMode;
  enabledCategories: PIICategory[];
  categoryThresholds?: Partial<Record<PIICategory, CategoryThreshold>>;
}

export const DEFAULT_DETECTION_SETTINGS: DetectionSettings = {
  mode: 'standard',
  executionMode: 'enforced',
  enabledCategories: DEFAULT_ENABLED_CATEGORIES
};

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

const isPIICategory = (value: unknown): value is PIICategory =>
  typeof value === 'string' && DEFAULT_ENABLED_CATEGORIES.includes(value as PIICategory);

const isCategoryThreshold = (value: unknown): value is CategoryThreshold => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CategoryThreshold>;
  if (typeof candidate.warn !== 'number') {
    return false;
  }

  if (typeof candidate.block !== 'undefined' && typeof candidate.block !== 'number') {
    return false;
  }

  return true;
};

const normalizeCategoryThresholds = (
  value: unknown
): Partial<Record<PIICategory, CategoryThreshold>> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const normalized: Partial<Record<PIICategory, CategoryThreshold>> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (!isPIICategory(key) || !isCategoryThreshold(entry)) {
      continue;
    }

    normalized[key] = {
      warn: entry.warn,
      block: entry.block
    };
  }

  return Object.keys(normalized).length ? normalized : undefined;
};

const normalizeDetectionSettings = (value: unknown): DetectionSettings => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_DETECTION_SETTINGS };
  }

  const candidate = value as Partial<DetectionSettings>;

  const mode: DetectionMode =
    candidate.mode === 'relaxed' || candidate.mode === 'strict' || candidate.mode === 'standard'
      ? candidate.mode
      : DEFAULT_DETECTION_SETTINGS.mode;

  const executionMode: DetectionExecutionMode =
    candidate.executionMode === 'shadow' || candidate.executionMode === 'enforced'
      ? candidate.executionMode
      : DEFAULT_DETECTION_SETTINGS.executionMode;

  const enabledCategories = Array.isArray(candidate.enabledCategories)
    ? candidate.enabledCategories.filter((entry) => isPIICategory(entry))
    : DEFAULT_DETECTION_SETTINGS.enabledCategories;

  return {
    mode,
    executionMode,
    enabledCategories: enabledCategories.length
      ? enabledCategories
      : DEFAULT_DETECTION_SETTINGS.enabledCategories,
    categoryThresholds: normalizeCategoryThresholds(candidate.categoryThresholds)
  };
};

export const getDetectionSettings = async (): Promise<DetectionSettings> => {
  const result = await chrome.storage.sync.get(DETECTION_SETTINGS_KEY);
  return normalizeDetectionSettings(result[DETECTION_SETTINGS_KEY]);
};

export const setDetectionSettings = async (
  patch: Partial<DetectionSettings>
): Promise<DetectionSettings> => {
  const current = await getDetectionSettings();
  const next = normalizeDetectionSettings({
    ...current,
    ...patch,
    categoryThresholds: patch.categoryThresholds ?? current.categoryThresholds
  });

  await chrome.storage.sync.set({
    [DETECTION_SETTINGS_KEY]: next
  });

  return next;
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
