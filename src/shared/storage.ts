export const EXTENSION_ENABLED_KEY = 'extensionEnabled';
export const DEFAULT_EXTENSION_ENABLED = true;

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
