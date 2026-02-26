# Dashboard Spec (Planned Phase 6)

## Status

This dashboard is planned and not yet shipped. The data model below is aligned with the current implemented event schema so Phase 6 can build directly on existing events.

## Location and Sizing

- Opens in a new tab at `dashboard.html`
- Minimum viewport target: 800x600
- Responsive layout for larger screens

## Core Widgets

| Widget | Description | Data Source |
| --- | --- | --- |
| Protection Summary | Total prompts scanned and PII hit rate | `scan_completed` |
| Severity Breakdown | Bar or donut chart by severity | `pii_item_redacted`, `pii_item_ignored`, `submit_intercepted`, `send_anyway_confirmed` (severity-bearing events) |
| Top Categories | Ranked list by category | `pii_item_redacted`, `pii_item_ignored`, `pii_batch_redacted` |
| Outcomes | Pie chart of actions (Redacted / Batch Redacted / Ignored / Send Anyway / Dismissed) | `pii_item_redacted`, `pii_batch_redacted`, `pii_item_ignored`, `send_anyway_confirmed`, `warning_dismissed` |
| Trend | Line chart of incidents by day | Daily rollups from intervention + submit events |
| History | Table of recent incidents | Last 50-100 events from `chrome.storage.local` |

## Filters

- Time range: today, 7 days, 30 days, custom
- Platform: all, chatgpt, claude
- Severity: all, critical, high+, medium+, low+
- Category: multi-select

## Data Handling

- Aggregations computed on demand from stored events
- Optional cached rollups in `chrome.storage.local`
- 30-day rolling retention
- Metadata only (no prompt text or matched PII values)

## Charting

- Use Chart.js
- Target render <1s after data load

## Performance Targets

- Page load <2s
- Filter response <500ms
