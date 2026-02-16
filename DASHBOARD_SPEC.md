# Dashboard Spec

## Location and Sizing

- Opens in a new tab at `dashboard.html`
- Minimum viewport target: 800x600
- Responsive layout for larger screens

## Core Widgets

| Widget | Description | Data Source |
| --- | --- | --- |
| Protection Summary | Total prompts scanned and PII rate | `scan_completed` events |
| Severity Breakdown | Bar or donut chart by severity | `pii_detected` grouped by `severity` |
| Top Categories | Ranked list by category | `pii_detected` grouped by `category` |
| Outcomes | Pie chart of actions | action events |
| Trend | Line chart of incidents by day | `pii_detected` rollups |
| History | Table of recent incidents | Last 50-100 events |

## Filters

- Time range: today, 7 days, 30 days, custom
- Platform: all, chatgpt, claude
- Severity: all, critical, high+, medium+, low+
- Category: multi-select

## Data Handling

- Aggregations computed on demand
- Cache rollups in `chrome.storage.local`
- 30-day rolling retention

## Charting

- Use Chart.js
- Target render <1s after data load

## Performance Targets

- Page load <2s
- Filter response <500ms
