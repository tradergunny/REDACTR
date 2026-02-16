import type {
  RuntimeBroadcast,
  RuntimeRequest,
  RuntimeResponse
} from '../shared/messages';
import { getExtensionEnabled } from '../shared/storage';

const MARKER_ATTRIBUTE = 'data-redactr-enabled';

const updateMarker = (enabled: boolean): void => {
  document.documentElement.setAttribute(MARKER_ATTRIBUTE, String(enabled));
};

const sendBootstrapMessage = (): Promise<RuntimeResponse> =>
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_BOOTSTRAP',
    pageUrl: window.location.href,
    pageTitle: document.title
  } satisfies RuntimeRequest);

const initialize = async (): Promise<void> => {
  const enabled = await getExtensionEnabled();
  updateMarker(enabled);

  chrome.runtime.onMessage.addListener((message: RuntimeBroadcast): void => {
    if (message.type === 'EXTENSION_STATE_CHANGED') {
      updateMarker(message.enabled);
    }
  });

  try {
    await sendBootstrapMessage();
  } catch (error) {
    console.warn('Unable to notify background worker from content script', error);
  }
};

void initialize();
