# Security and threat model

## Assets

- Repository files and documentation integrity.
- Runner credentials, network reachability, and GitHub token permissions.
- Report integrity and developer trust.
- Availability of pull-request workflows.

## Trust boundaries

Repository content, front matter, links, filenames, HTML, configuration, and Git revisions are untrusted inputs. Environment variables and the GitHub token are outside rule evaluation and must never appear in diagnostics.

## Threats and controls

| Threat                      | Control                                                                                                            | Residual risk                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Arbitrary code in examples  | Examples are parsed only; no shell or evaluator exists.                                                            | Syntax validation is limited to JSON.                                                        |
| Path traversal              | Discovery is rooted, local links resolve from known documents, and reports remain under an operator-selected root. | A trusted operator can choose broad include patterns.                                        |
| Command injection           | Git uses `execFile` with an argument array; no shell interpolation.                                                | A malicious revision can still be invalid and cause a clear failure.                         |
| Server-side request forgery | Networking is off by default; credentials, local names, and private/reserved DNS results are blocked.              | DNS rebinding after preflight remains possible; isolate runners for untrusted network scans. |
| Network denial of service   | Unique URL set, cache, timeout, maximum three retries, and concurrency capped at 16.                               | Large URL estates still consume time within configured bounds.                               |
| Report injection            | HTML output escapes all diagnostic-controlled fields.                                                              | Consumers that re-render JSON/SARIF must escape independently.                               |
| Exception abuse             | Suppressions require rationale, can target path/line, and support expiry; baselines match exact fingerprints.      | Review quality is still a governance dependency.                                             |
| Oversized content           | Individual documents are capped at 5 MiB and parser concurrency is bounded.                                        | Total repository size can still be large; CI time budgets should be monitored.               |
| Dependency compromise       | Exact versions, lockfile, explicit pnpm build allowlist, Dependabot, CodeQL, and review.                           | JavaScript supply-chain risk cannot be reduced to zero.                                      |

## Permissions

The core Action needs only read access to repository files. SARIF upload is a separate workflow step requiring `security-events: write`. The Action does not post comments, modify pull requests, write repository content, or use personal tokens.

## Safe operating profile

For contributions from forks, keep external-link checks disabled and run with `contents: read`. Upload SARIF only when the event and repository permission model permits it. Treat `allowPrivateHosts: true` as a trusted-environment exception, never as a convenience default.

## Reporting vulnerabilities

Follow [SECURITY.md](../SECURITY.md). Do not include credentials, private repository content, or exploit details in a public issue.
