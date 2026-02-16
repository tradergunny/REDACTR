import type { RuntimeRequest, RuntimeResponse } from '../shared/messages';

const toggle = document.querySelector<HTMLInputElement>('#enabledToggle');
const statusLabel = document.querySelector<HTMLElement>('#statusLabel');

if (!toggle || !statusLabel) {
  throw new Error('Popup UI failed to initialize: missing required elements');
}

const sendMessage = (request: RuntimeRequest): Promise<RuntimeResponse> =>
  chrome.runtime.sendMessage(request);

const updateStatusText = (enabled: boolean): void => {
  statusLabel.textContent = enabled ? 'Protection is on' : 'Protection is off';
};

const loadState = async (): Promise<void> => {
  const response = await sendMessage({ type: 'GET_EXTENSION_STATE' });

  if (!response.ok || typeof response.enabled !== 'boolean') {
    throw new Error(response.ok ? 'Missing extension state' : response.error);
  }

  toggle.checked = response.enabled;
  updateStatusText(response.enabled);
};

const onToggleChange = async (): Promise<void> => {
  toggle.disabled = true;

  try {
    const response = await sendMessage({
      type: 'SET_EXTENSION_STATE',
      enabled: toggle.checked
    });

    if (!response.ok || typeof response.enabled !== 'boolean') {
      throw new Error(response.ok ? 'Missing updated extension state' : response.error);
    }

    toggle.checked = response.enabled;
    updateStatusText(response.enabled);
  } catch (error) {
    toggle.checked = !toggle.checked;
    const message = error instanceof Error ? error.message : 'State update failed';
    statusLabel.textContent = `Error: ${message}`;
  } finally {
    toggle.disabled = false;
  }
};

toggle.addEventListener('change', () => {
  void onToggleChange();
});

void loadState().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown load error';
  statusLabel.textContent = `Error: ${message}`;
});
