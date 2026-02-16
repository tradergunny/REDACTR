import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'REDACTR',
  description: 'PII protection layer for AI chatbots.',
  version: '0.1.0',
  permissions: ['storage', 'activeTab'],
  host_permissions: [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*'
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'REDACTR'
  },
  content_scripts: [
    {
      matches: [
        'https://chat.openai.com/*',
        'https://chatgpt.com/*',
        'https://claude.ai/*'
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ]
});
