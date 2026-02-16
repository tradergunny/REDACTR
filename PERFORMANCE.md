# Performance Benchmarks

## Targets

- Scan latency <=100ms for <=2000 chars (p95)
- Typing overhead <=50ms per keystroke
- Warning render <=500ms from detection
- Dashboard load <=2s
- Memory footprint <=20MB

## Measurement Approach

- Use `performance.now()` around scan calls
- Collect p95 across at least 100 samples
- Track typing overhead using synthetic input events
- Lighthouse for popup and dashboard load

## Benchmark Cases

- 200 chars, no PII
- 2000 chars, mixed PII
- 10000 chars, chunked PII

## Reporting

- Store results locally in a JSON report
- Compare against previous run
