# Benchmark report

## Method

`pnpm benchmark` creates isolated synthetic Markdown corpora at 100, 1,000, and 10,000 pages. Every page contains valid YAML metadata, headings, prose, and a JSON code block. The command performs complete discovery, parse, rule, governance, and summary work with external networking disabled.

## Results

Measured on 2026-09-16 using Node.js 24.18.1 on a Windows local workstation with a local filesystem:

| Pages | Complete scan | Throughput | Diagnostics |
| ---: | ---: | ---: | ---: |
| 100 | 116.710 ms | 856.8 pages/s | 0 |
| 1,000 | 625.337 ms | 1,599.1 pages/s | 0 |
| 10,000 | 5,060.572 ms | 1,976.1 pages/s | 0 |

Results are also machine-readable in the CI artifact `artifacts/benchmark.json`.

## Interpretation

The benchmark protects broad regressions rather than promising production latency. Results vary with filesystem, CPU, antivirus, and runner load. Changed-file mode reduces typical pull-request work, while scheduled full scans preserve repository-wide link and identity guarantees.

The results remain approximately linear over the tested range. Higher measured throughput at larger sizes reflects fixed startup and configuration overhead being amortized; it does not imply super-linear processing.
