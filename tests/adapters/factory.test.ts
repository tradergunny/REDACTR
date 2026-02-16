import { describe, expect, it } from 'vitest';

import { createPlatformAdapter } from '../../src/content/adapters/factory';

describe('createPlatformAdapter', () => {
  it('detects ChatGPT from chatgpt.com URLs', () => {
    const adapter = createPlatformAdapter('https://chatgpt.com/c/abc123');

    expect(adapter?.platformId).toBe('chatgpt');
  });

  it('detects ChatGPT from chat.openai.com URLs', () => {
    const adapter = createPlatformAdapter('https://chat.openai.com/chat');

    expect(adapter?.platformId).toBe('chatgpt');
  });

  it('detects Claude from claude.ai URLs', () => {
    const adapter = createPlatformAdapter('https://claude.ai/chat/abc123');

    expect(adapter?.platformId).toBe('claude');
  });

  it('returns null for unsupported hosts', () => {
    const adapter = createPlatformAdapter('https://example.com/chat');

    expect(adapter).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    const adapter = createPlatformAdapter('not-a-valid-url');

    expect(adapter).toBeNull();
  });
});
