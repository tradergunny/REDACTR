import type {
  RuntimeBroadcast,
  RuntimeRequest,
  RuntimeResponse
} from '../shared/messages';
import { sanitizePIIEvent } from '../shared/events';
import {
  DEFAULT_EXTENSION_ENABLED,
  EXTENSION_ENABLED_KEY,
  appendPIIEvent,
  getExtensionEnabled,
  setExtensionEnabled
} from '../shared/storage';

const TARGET_HOST_PATTERNS = [
  'https://chat.openai.com/*',
  'https://chatgpt.com/*',
  'https://claude.ai/*'
];

const ensureDefaultState = async (): Promise<void> => {
  const storedState = await chrome.storage.sync.get(EXTENSION_ENABLED_KEY);
  if (typeof storedState[EXTENSION_ENABLED_KEY] !== 'boolean') {
    await chrome.storage.sync.set({
      [EXTENSION_ENABLED_KEY]: DEFAULT_EXTENSION_ENABLED
    });
  }
};

const notifyTabsOfState = async (enabled: boolean): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: TARGET_HOST_PATTERNS });
  const updateMessage: RuntimeBroadcast = {
    type: 'EXTENSION_STATE_CHANGED',
    enabled
  };

  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, updateMessage);
    } catch {
      // Tabs without an active content script can throw on sendMessage.
    }
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultState();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureDefaultState();
});

chrome.runtime.onMessage.addListener(
  (request: RuntimeRequest, _sender, sendResponse): boolean | void => {
    const handle = async (): Promise<void> => {
      if (request.type === 'CONTENT_SCRIPT_BOOTSTRAP') {
        console.info('Content script bootstrapped', {
          pageUrl: request.pageUrl,
          pageTitle: request.pageTitle
        });
        sendResponse({ ok: true } satisfies RuntimeResponse);
        return;
      }

      if (request.type === 'GET_EXTENSION_STATE') {
        const enabled = await getExtensionEnabled();
        sendResponse({ ok: true, enabled } satisfies RuntimeResponse);
        return;
      }

      if (request.type === 'SET_EXTENSION_STATE') {
        await setExtensionEnabled(request.enabled);
        await notifyTabsOfState(request.enabled);
        sendResponse({ ok: true, enabled: request.enabled } satisfies RuntimeResponse);
        return;
      }

      if (request.type === 'TRACK_PII_EVENT') {
        const sanitizedEvent = sanitizePIIEvent(request.event);
        await appendPIIEvent(sanitizedEvent);
        sendResponse({ ok: true } satisfies RuntimeResponse);
      }
    };

    void handle().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown message error';
      sendResponse({ ok: false, error: message } satisfies RuntimeResponse);
    });

    return true;
  }
);
