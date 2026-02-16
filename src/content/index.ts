import { createPlatformAdapter } from './adapters/factory';
import type { PlatformAdapter } from './adapters/types';
import type {
  RuntimeBroadcast,
  RuntimeRequest,
  RuntimeResponse
} from '../shared/messages';
import { detectPII } from './pii';
import { createScanCompletedEvent } from '../shared/events';
import { getExtensionEnabled } from '../shared/storage';
import { InterventionController } from './intervention/controller';

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

let activeAdapter: PlatformAdapter | null = null;
let teardownAdapterHooks: (() => void) | null = null;
const sessionId = crypto.randomUUID();

const sendPIIEvent = async (request: RuntimeRequest): Promise<void> => {
  try {
    await chrome.runtime.sendMessage(request);
  } catch (error) {
    console.warn('Unable to send PII event to background worker', error);
  }
};

const teardownAdapter = (): void => {
  teardownAdapterHooks?.();
  teardownAdapterHooks = null;

  activeAdapter?.cleanup();
  activeAdapter = null;
};

const setupAdapter = (enabled: boolean): void => {
  teardownAdapter();

  if (!enabled) {
    return;
  }

  const adapter = createPlatformAdapter();
  if (!adapter) {
    return;
  }

  const interventionController = new InterventionController({
    adapter,
    sessionId,
    sendEvent: async (event) => {
      await sendPIIEvent({
        type: 'TRACK_PII_EVENT',
        event
      } satisfies RuntimeRequest);
    }
  });

  let unsubscribeTextChanges: (() => void) | null = null;
  let unsubscribeSubmitIntercept: (() => void) | null = null;
  let boundInput: HTMLElement | null = null;
  let boundSubmit: HTMLElement | null = null;

  const scanText = (text: string): void => {
    const scanStart = performance.now();
    const detections = detectPII(text);
    const scanLatencyMs = performance.now() - scanStart;

    console.debug('[REDACTR] text changed', {
      platform: adapter.platformId,
      length: text.length,
      detectionCount: detections.length,
      scanLatencyMs: Number(scanLatencyMs.toFixed(2))
    });

    const scanEvent = createScanCompletedEvent({
      platform: adapter.platformId,
      promptLength: text.length,
      piiFound: detections.length > 0,
      latencyMs: scanLatencyMs,
      sessionId
    });

    void sendPIIEvent({
      type: 'TRACK_PII_EVENT',
      event: scanEvent
    } satisfies RuntimeRequest);

    interventionController.onScanResult(text, detections);
  };

  const teardownHookBindings = (): void => {
    unsubscribeTextChanges?.();
    unsubscribeSubmitIntercept?.();
    unsubscribeTextChanges = null;
    unsubscribeSubmitIntercept = null;
    boundInput = null;
    boundSubmit = null;
  };

  const rebindAdapterHooks = (): void => {
    const nextInput = adapter.detectInputElement();
    const nextSubmit = adapter.getSubmitButton();

    if (nextInput === boundInput && nextSubmit === boundSubmit) {
      return;
    }

    teardownHookBindings();

    if (nextInput) {
      unsubscribeTextChanges = adapter.onTextChanged((text) => {
        scanText(text);
      });
    }

    if (nextInput && nextSubmit) {
      unsubscribeSubmitIntercept = adapter.onSubmitIntercept((event) =>
        interventionController.onSubmitAttempt(event)
      );
    }

    boundInput = nextInput;
    boundSubmit = nextSubmit;

    if (nextInput) {
      scanText(adapter.captureText());
    } else {
      interventionController.onScanResult('', []);
    }
  };

  const observer = new MutationObserver(() => {
    rebindAdapterHooks();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true
  });

  const intervalId = window.setInterval(() => {
    rebindAdapterHooks();
  }, 1000);

  rebindAdapterHooks();
  window.setTimeout(rebindAdapterHooks, 250);
  window.setTimeout(rebindAdapterHooks, 1000);

  teardownAdapterHooks = (): void => {
    window.clearInterval(intervalId);
    observer.disconnect();
    teardownHookBindings();
    interventionController.cleanup();
  };

  activeAdapter = adapter;
};

const initialize = async (): Promise<void> => {
  const enabled = await getExtensionEnabled();
  updateMarker(enabled);
  setupAdapter(enabled);

  const messageListener = (message: RuntimeBroadcast): void => {
    if (message.type === 'EXTENSION_STATE_CHANGED') {
      updateMarker(message.enabled);
      setupAdapter(message.enabled);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);
  window.addEventListener('beforeunload', teardownAdapter);

  try {
    await sendBootstrapMessage();
  } catch (error) {
    console.warn('Unable to notify background worker from content script', error);
  }
};

void initialize();
