import { ChatGPTAdapter } from './chatgpt';
import { ClaudeAdapter } from './claude';
import type { PlatformAdapter } from './types';

const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);
const CLAUDE_HOSTS = new Set(['claude.ai']);

const getHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const createPlatformAdapter = (
  url: string = window.location.href
): PlatformAdapter | null => {
  const hostname = getHostname(url);
  if (!hostname) {
    return null;
  }

  if (CHATGPT_HOSTS.has(hostname)) {
    return new ChatGPTAdapter();
  }

  if (CLAUDE_HOSTS.has(hostname)) {
    return new ClaudeAdapter();
  }

  return null;
};
