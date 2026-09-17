# Operations runbook

## When to use this runbook

Use it when a documentation-quality workflow fails, annotations are missing, external-link checks become noisy, or reports cannot be uploaded.

## Triage sequence

1. Open the Action step summary and downloadable HTML report.
2. Separate active findings from suppressed findings.
3. Confirm the configured threshold and scanned file count.
4. Reproduce locally with the same configuration and `changed-from` revision.
5. Inspect the JSON report for exact fingerprints and locations.

## Common failures

| Symptom                       | Likely cause                                        | Recovery                                                                                          |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Exit code 2 before scan       | Invalid JSON, unknown key, or missing Git revision. | Validate `.docquality.json`; fetch the base revision.                                             |
| `DQ013`                       | Invalid YAML, unreadable file, or file above 5 MiB. | Fix syntax/permissions or split the document.                                                     |
| All external links transient  | Egress/DNS unavailable or remote rate limiting.     | Disable network checks for the run, retain notices, and retry from an approved environment.       |
| SARIF upload denied           | Fork event or missing `security-events: write`.     | Keep report artifacts; upload only on authorized events.                                          |
| Annotation points to old line | Stale baseline or source changed after scan.        | Run against the checked-out commit and regenerate only after review.                              |
| Cache seems stale             | TTL has not expired.                                | Remove `.docquality-cache.json` in the workspace or set TTL to zero for a trusted diagnostic run. |

## Rollback

Pin the prior reviewed Action release or commit SHA. Keep the JSON/SARIF schema version unchanged until consumers are updated. If a new rule creates unexpected noise, adjust `failOn` temporarily or use a narrow expiring suppression; do not delete evidence or create a broad permanent baseline.

## Observability

Monitor file count, duration, severity counts, suppressed count, cache hit behavior, and workflow result over time. A sudden drop in file count is a discovery/configuration incident even if the gate passes.

## Data retention

CI retains reports and coverage artifacts for 14 days. The repository contains no credentials or scanned proprietary content. Cache files and generated reports are ignored locally.
