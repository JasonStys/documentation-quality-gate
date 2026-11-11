# Security and threat model

## Assets

- Repository files and documentation integrity.
- Runner credentials, network reachability, and GitHub token permissions.
- Report integrity and developer trust.
- Availability of pull-request workflows.

## Trust boundaries

Repository content, front matter, links, filenames, HTML, configuration, and Git revisions are untrusted inputs. Environment variables and the GitHub token are outside rule evaluation and must never appear in diagnostics.

## Threats and controls

| Threat                      | Control                                                                                                                                     | Residual risk                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Arbitrary code in examples  | Examples are parsed only; no shell or evaluator exists.                                                                                     | Syntax validation is limited to JSON.                                                                         |
| Path traversal              | Local link targets are lexically confined before filesystem probes; static symlink/junction components below the selected root are refused. | Explicit trusted root selection and concurrent same-owner namespace changes remain outside this static check. |
| Command injection           | Git uses `execFile` with an argument array; no shell interpolation.                                                                         | A malicious revision can still be invalid and cause a clear failure.                                          |
| Server-side request forgery | Networking is off by default; credentials, local names, and private/reserved DNS results are blocked.                                       | DNS rebinding after preflight remains possible; isolate runners for untrusted network scans.                  |
| Network denial of service   | Unique URL set, cache, timeout, maximum three retries, and concurrency capped at 16.                                                        | Large URL estates still consume time within configured bounds.                                                |
| Report injection            | HTML output escapes all diagnostic-controlled fields.                                                                                       | Consumers that re-render JSON/SARIF must escape independently.                                                |
| Exception abuse             | Suppressions require rationale, can target path/line, and support expiry; baselines match exact fingerprints.                               | Review quality is still a governance dependency.                                                              |
| Oversized content           | Individual documents are capped at 5 MiB and parser concurrency is bounded.                                                                 | Total repository size can still be large; CI time budgets should be monitored.                                |
| Dependency compromise       | Exact versions, lockfile, explicit pnpm build allowlist, Dependabot, CodeQL, and review.                                                    | JavaScript supply-chain risk cannot be reduced to zero.                                                       |

## Permissions

The core Action needs only read access to repository files. SARIF upload is a separate workflow step requiring `security-events: write`. The Action does not post comments, modify pull requests, write repository content, or use personal tokens.

## Safe operating profile

For contributions from forks, keep external-link checks disabled and run with `contents: read`. Upload SARIF only when the event and repository permission model permits it. Treat `allowPrivateHosts: true` as a trusted-environment exception, never as a convenience default.

## Reporting vulnerabilities

Follow [SECURITY.md](../SECURITY.md). Do not include credentials, private repository content, or exploit details in a public issue.

## Baseline review boundary

Baseline parsing is descriptor-bounded to 2 MiB and 10,000 complete entries with strict UTF-8. Paths are repository-local; target symlinks are refused. An explicit refresh is an acceptance operation and must be reviewed. It refuses a stale baseline content hash or an occupied adjacent lock, writes/flushed a unique temporary file and atomically replaces the reviewed baseline. External software that ignores the lock is outside the cooperative-writer guarantee; use a trusted checkout. Malformed baselines fail the scan instead of silently discarding entries. Expiry (`DQ000`) and input failure (`DQ013`) cannot be suppressed to turn an unreadable corpus into a passing scan.

## Native workbench boundary

The [native guide](native-application.md) documents its closed corpus, plaintext owner-local state, exact source hashes, immutable renderer inventory and worker/file shutdown ownership. It offers no multiuser account system. Required metadata is checked with own-property semantics: inherited JavaScript members cannot satisfy an absent authored field. Local link URLs are decoded and confined before existence checks; an existing outside file no longer turns a repository escape into accepted evidence.
