<div align="center">

<img src="https://img.shields.io/badge/REDACTR-PII%20Protection-DC2626?style=for-the-badge&labelColor=0A0A0A" alt="REDACTR" />

# REDACTR

### Real-time PII protection for AI chatbots — runs entirely in your browser.

REDACTR is a Chrome extension (Manifest V3) that intercepts sensitive data **before** it leaves your browser when you chat with ChatGPT or Claude. Detection, redaction, and policy enforcement all happen locally. No backend. No telemetry of prompt content. No cloud round-trip.

<br />

[![Build](https://img.shields.io/badge/build-passing-22C55E?style=flat-square&logo=vite&logoColor=white)](#)
[![Tests](https://img.shields.io/badge/tests-passing-22C55E?style=flat-square&logo=vitest&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-99.4%25-3178C6?style=flat-square&logo=typescript&logoColor=white)](#)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#)
[![License](https://img.shields.io/badge/license-TBD-737373?style=flat-square)](LICENSE.md)
[![Status](https://img.shields.io/badge/status-MVP%20in%20progress-EA580C?style=flat-square)](#roadmap)

[**Architecture**](#architecture) · [**Quick Start**](#quick-start) · [**Roadmap**](#roadmap) · [**Docs**](#documentation) · [**Contributing**](CONTRIBUTING.md)

---

</div>

## Why REDACTR

> **40%** of enterprise data leakage originates from direct user input to AI systems. **80%** of organizations face shadow-AI usage with zero protection. Enterprise DLP costs **$500K–$1M/year**. Individuals and SMEs have nothing.

REDACTR closes the gap. It is the lightweight, local-first protection layer that catches API keys, credit cards, SSNs, passport numbers, and other sensitive data **before** they get pasted into a prompt — without sending anything to a server.

<br />

## Highlights

| | |
|---|---|
| 🔒 **Local-first by design** | All scanning runs in the content script. Prompt text never leaves the browser. |
| ⚡ **Sub-100ms detection** | Regex + Luhn + context scoring engine, debounced and chunked, p95 < 100ms on 2000-char inputs. |
| 🎯 **11 PII categories** | Credit cards, bank accounts, SSN, ITIN, Thai national ID, passports, API keys, passwords, emails, phones, addresses, names. |
| 🛡️ **Severity-based intervention** | Critical/High blocks submit until acknowledged. Medium/Low stays non-blocking. |
| 🧩 **Pluggable platform adapters** | Interface-driven design with 3-tier selector fallback (data-testid → aria-label → heuristic). |
| 📊 **Privacy-preserving telemetry** | Only metadata, never prompt content. Opt-in. 30-day rolling local retention. |
| ♿ **Accessible** | Shadow-DOM isolated UI, full keyboard navigation, ARIA labels, WCAG AA contrast. |

<br />

## Architecture

```
┌──────────────────────────────────────── BROWSER CONTEXT ─────────────────────────────────────┐
│                                                                                              │
│   ┌──────────────────┐       ┌────────────────────┐       ┌──────────────────────────┐      │
│   │  Content Script  │◄─────►│  Platform Adapter  │◄─────►│   ChatGPT  /  Claude     │      │
│   │                  │       │  (ChatGPT/Claude)  │       │   chatgpt.com            │      │
│   │  • DOM observer  │       │                    │       │   chat.openai.com        │      │
│   │  • Text capture  │       │  • detectInput()   │       │   claude.ai              │      │
│   │  • UI injection  │       │  • captureText()   │       └──────────────────────────┘      │
│   └────────┬─────────┘       │  • onSubmit()      │                                          │
│            │                 │  • renderUI()      │                                          │
│            ▼                 └────────────────────┘                                          │
│   ┌──────────────────┐       ┌────────────────────┐                                          │
│   │  PII Detection   │◄─────►│  Intervention UI   │                                          │
│   │     Engine       │       │  (Shadow DOM)      │                                          │
│   │                  │       │                    │                                          │
│   │  • 11 rule sets  │       │  • Severity badge  │                                          │
│   │  • Luhn / IBAN   │       │  • Per-item card   │                                          │
│   │  • Scoring       │       │  • Submit gate     │                                          │
│   │  • Masking       │       │  • Allowlist       │                                          │
│   └────────┬─────────┘       └────────────────────┘                                          │
│            │                                                                                 │
│            ▼                                                                                 │
│   ┌──────────────────┐       ┌────────────────────┐       ┌──────────────────────────┐      │
│   │  Service Worker  │◄─────►│   Local Storage    │       │   Analytics (planned)    │      │
│   │                  │       │  chrome.storage    │       │   metadata only, opt-in  │      │
│   │  • Message hub   │       │  .sync / .local    │       └──────────────────────────┘      │
│   │  • Event store   │       └────────────────────┘                                          │
│   │  • State sync    │                                                                       │
│   └──────────────────┘                                                                       │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Map

| Layer | Module | Responsibility |
|---|---|---|
| **Bootstrap** | `src/content/index.ts` | Loads settings, picks adapter, wires scan loop and event emission. |
| **Adapters** | `src/content/adapters/{chatgpt,claude,base,factory}.ts` | DOM capture, mutation observation, submit hooks, text replacement. |
| **PII Engine** | `src/content/pii/engine.ts` + `rules/` | Rule execution, scoring, overlap resolution, policy decisions. |
| **Validators** | `src/content/pii/validators/` | Luhn, ABA, IBAN, Thai national ID checksums. |
| **Intervention** | `src/content/intervention/` | Shadow-DOM panel, per-detection state, submit gating, redaction flows. |
| **Background** | `src/background/index.ts` | Service worker, settings broadcast, event sanitization and storage. |
| **Popup** | `src/popup/` | Extension on/off toggle and quick status. |
| **Shared** | `src/shared/{events,messages,storage}.ts` | Event schema, runtime message contracts, persistence helpers. |

<br />

## PII Coverage

| Category | Severity | Detection Method |
|---|---|---|
| Credit Card | 🔴 Critical | Pattern + Luhn + card-candidate classifier |
| Bank Account / IBAN / Routing | 🔴 Critical | Pattern + ABA / IBAN checksum + context |
| US SSN | 🔴 Critical | Formatted + compact patterns |
| API Keys (AWS, GCP, Stripe, OpenAI, generic) | 🔴 Critical | Prefix detection + entropy filter |
| Passwords | 🟠 High | Assignment / env-var / CLI-flag context patterns |
| Passport | 🟠 High | Country-specific patterns + suppressors |
| National ID (Thai, ITIN) | 🟠 High | Pattern + checksum |
| CVV / Card Expiry | 🟠 High | Anchored to card / payment context |
| Email | 🟡 Medium | RFC 5322 subset, placeholder filtering |
| Phone | 🟡 Medium | International / Thai / US, anti-noise filters |
| Names with context | 🔵 Low | Context window + capitalization heuristics |
| Addresses | 🔵 Low | US + Thai forms, named-entity hints |

<br />

## Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- **Chrome 120+** or **Edge 120+**

### Install & Run

```bash
# 1. Install
npm install

# 2. Start dev build with hot reload
npm run dev

# 3. Load the unpacked extension
#    chrome://extensions  →  Developer mode  →  Load unpacked  →  select ./dist

# 4. Visit chatgpt.com or claude.ai and start typing
```

### Validate

```bash
npm test            # Vitest suite (engine, adapters, intervention, perf)
npm run test:watch  # watch mode
npm run lint        # ESLint flat config
npm run format      # Prettier write
npm run build       # production build to ./dist
```

<br />

## Roadmap

```
✅ Phase 1   Foundation                       Vite + CRXJS, MV3 manifest, popup toggle
✅ Phase 2   Platform Adapters                ChatGPT + Claude, 3-tier selector fallback
✅ Phase 3   PII Detection Engine             11 categories, Luhn/IBAN/Thai checksums, scoring
✅ Phase 4   Intervention UX                  Shadow DOM panel, severity gating, submit control
🟡 Phase 5   Settings + Allowlist             Storage layer done · UI in progress
⬜ Phase 6   Dashboard                        New-tab analytics view, 6 widgets, 4 filters
⬜ Phase 7   Hardening + Launch               Playwright regression, audits, Chrome Web Store
```

See [`REDACTR_BUILD_GUIDE.md`](REDACTR_BUILD_GUIDE.md) for phase-by-phase exit criteria.

<br />

## Performance Targets

| Metric | Target | Status |
|---|---|---|
| Typing overhead | < 50ms / keystroke | ✅ |
| Scan latency (≤ 2000 chars, p95) | < 100ms | ✅ enforced via `tests/perf/` |
| Warning render | < 500ms after detection | ✅ |
| Popup cold start | < 1s | ✅ |
| Memory footprint | < 20MB | 🟡 to be audited in Phase 7 |

<br />

## Privacy & Security

- **No prompt content ever stored or transmitted** — period.
- **No external network calls** from content scripts. Verifiable in DevTools → Network.
- **No `eval`, no inline scripts, no `Function()` constructor.** CSP-strict.
- **Shadow DOM isolation** prevents style and script bleed from / into the host page.
- **Storage validation on read** — corrupt state resets to defaults.
- **Manifest V3 minimal permissions:** `storage`, `activeTab`, plus host permissions for the two AI chat domains. No `<all_urls>`, no `webRequest`.

Threat model: [`THREAT_MODEL.md`](THREAT_MODEL.md) · Privacy policy draft: [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) · Security checklist: [`SECURITY.md`](SECURITY.md)

<br />

## Tech Stack

<table>
<tr>
<td align="center" width="120"><b>Language</b></td>
<td align="center" width="120"><b>Build</b></td>
<td align="center" width="120"><b>Runtime</b></td>
<td align="center" width="120"><b>Testing</b></td>
<td align="center" width="120"><b>Quality</b></td>
</tr>
<tr>
<td align="center">TypeScript 5.8</td>
<td align="center">Vite 5 + CRXJS 2</td>
<td align="center">Manifest V3<br />Service Worker</td>
<td align="center">Vitest 3<br />jsdom 28</td>
<td align="center">ESLint 9<br />Prettier 3</td>
</tr>
</table>

<br />

## Documentation

REDACTR ships with a complete spec set. Every phase has a referenceable doc.

### Product & Architecture
- [`PRD.md`](PRD.md) — Full product requirements
- [`ARCHITECTURE_PII.md`](ARCHITECTURE_PII.md) — System architecture deep-dive
- [`ADAPTER_SPEC.md`](ADAPTER_SPEC.md) — Platform adapter contract & selectors
- [`PII_RULEBOOK.md`](PII_RULEBOOK.md) — Detection patterns, severity, masks
- [`EVENT_SCHEMA.md`](EVENT_SCHEMA.md) — Telemetry event taxonomy

### Build & Operations
- [`REDACTR_BUILD_GUIDE.md`](REDACTR_BUILD_GUIDE.md) — Phase-by-phase build plan
- [`SETTINGS_SPEC.md`](SETTINGS_SPEC.md) — Settings UI spec (Phase 5)
- [`DASHBOARD_SPEC.md`](DASHBOARD_SPEC.md) — Dashboard spec (Phase 6)

### Quality, Security, Release
- [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md) — Test strategy & matrix
- [`TEST_CASES.md`](TEST_CASES.md) — Acceptance test cases
- [`PERFORMANCE.md`](PERFORMANCE.md) — Performance targets & methodology
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — Threat model & mitigations
- [`SECURITY.md`](SECURITY.md) — Security policy
- [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) — User-facing privacy policy
- [`RELEASE.md`](RELEASE.md) — Release & Chrome Web Store checklist

<br />

## Project Structure

```
src/
├── background/        Service worker — message hub, event store, settings broadcast
├── content/
│   ├── adapters/      Platform abstraction (ChatGPT, Claude, base, factory)
│   ├── intervention/  Shadow-DOM UI, controller, submit gating
│   └── pii/
│       ├── rules/     11 detection rules (cards, IDs, keys, contact, names…)
│       ├── validators/ Luhn, ABA, IBAN, Thai checksums
│       ├── engine.ts  Rule runner, scoring, overlap resolution
│       └── policy.ts  Threshold-based decisions (ignore/warn/block)
├── popup/             Extension popup (on/off toggle, status)
└── shared/            Event schema, runtime messages, storage helpers

tests/
├── adapters/          Adapter factory, hooks, selector fallback
├── content/           Intervention controller and panel
├── pii/               Engine, rules, validators, masks, policy, corpus (350+ cases)
└── perf/              p95 latency guardrails
```

<br />

## Contributing

Issues, PRs, and detection-rule suggestions welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting.

If you've found a missed PII pattern in the wild, opening an issue with a redacted reproduction is the single most useful thing you can do.

<br />

## License

License is currently **TBD** — see [`LICENSE.md`](LICENSE.md). Until finalized, treat the code as **all rights reserved**.

<br />

---

<div align="center">

**Built to keep your data on your machine.**

<sub>REDACTR is an independent project. Not affiliated with OpenAI, Anthropic, Google, or any platform it integrates with.</sub>

</div>4. Verify injection on ChatGPT or Claude

## Validation Commands

- `npm test`
- `npm run build`
