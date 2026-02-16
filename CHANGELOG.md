# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Phase 1 foundation scaffold using Vite + TypeScript + CRXJS
- Added Manifest V3 extension skeleton with minimal permissions:
  - `storage`, `activeTab`
  - host permissions for `chat.openai.com`, `chatgpt.com`, and `claude.ai`
- Added background service worker with runtime message handling for:
  - content script bootstrap events
  - extension enabled state read/write
  - state broadcast to active target-domain tabs
- Added content script bootstrap for supported hosts with:
  - service worker handshake message
  - extension enabled-state marker updates
  - runtime listener for enabled-state changes
- Added popup UI with persistent on/off toggle backed by `chrome.storage.sync`
- Added development and quality tooling:
  - ESLint flat config (`eslint.config.js`)
  - Prettier config (`.prettierrc.json`, `.prettierignore`)
  - Vitest config (`vitest.config.ts`) and sample passing test
- Added initial project configuration:
  - `package.json` scripts for `dev`, `build`, `lint`, `test`, and formatting
  - TypeScript config (`tsconfig.json`)
  - Vite + CRX manifest wiring (`vite.config.ts`, `manifest.config.ts`)
- Fixed Vite extension dev-mode connectivity by binding dev server to all interfaces with a fixed port (`5173`, `strictPort`) to avoid localhost resolution and port-drift issues
- Fixed CRX dev service-worker load failures by enabling Vite dev-server CORS so extension-origin requests can load `@crx/client-worker` and `@vite/env`
