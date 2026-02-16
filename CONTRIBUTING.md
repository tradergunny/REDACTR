# Contributing

## Development Principles

- Privacy-first, local-only processing
- Minimal permissions in Manifest V3
- No prompt or PII storage
- Performance and non-intrusive UX

## Branching

- Use short descriptive branch names
- Prefer `codex/` prefix for automated work

## Code Style

- TypeScript for extension logic
- Avoid inline scripts in UI
- Use Shadow DOM for injected UI
- Keep selectors resilient and defensive

## Testing Expectations

- Add unit tests for new PII rules
- Add integration tests for new adapters
- Run regression checks for selector changes

## PR Checklist

- No new permissions without justification
- No storage of prompt text
- No network calls unless explicitly opt-in
- Update docs if behavior changes
