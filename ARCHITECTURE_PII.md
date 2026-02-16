# Architecture (PII)

## Overview

REDACTR runs fully in the browser as a Manifest V3 extension. All PII detection is local. No backend services are required.

## High-Level Data Flow

```mermaid
graph TD
  A[Content Script] --> B[Platform Adapter]
  B --> C[PII Detection Engine]
  C --> D[Warning UI]
  A --> E[Service Worker]
  E --> F[chrome.storage]
  E --> G[Analytics (Opt-in)]
```

## Component Boundaries

- Content Script: DOM observation, text capture, UI injection, submit interception
- Platform Adapter: Platform selectors, input capture, submit hooks, anchor elements
- PII Detection Engine: Regex rules, severity scoring, masking suggestions
- Warning UI: Banner, highlights, action handlers, modal confirmation
- Service Worker: Message routing, settings sync, event aggregation
- Storage: Settings, allowlist, event log

## Manifest V3 Constraints

- Permissions: `storage`, `activeTab`
- Host permissions limited to `chat.openai.com`, `chatgpt.com`, `claude.ai`
- Content scripts injected only on supported hosts
- No `webRequest` and no `<all_urls>`

## Data Isolation Rules

- Prompt text stays in memory only
- Event metadata only, no PII content storage
- UI isolated with Shadow DOM
- CSP compliant, no inline scripts or eval
