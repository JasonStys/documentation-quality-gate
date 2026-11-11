# Testing strategy

## Test pyramid

| Layer       | Focus                                                                                    | Evidence                                                         |
| ----------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Unit        | Configuration, parsing, rules, governance, fingerprints, reporters, escaping.            | Fast Vitest suite with enforced V8 coverage.                     |
| Integration | Temporary repositories, real files, local HTTP, retry/cache behavior, end-to-end policy. | Separate Vitest configuration with network isolated to loopback. |
| Package     | Type declarations, CLI output, Action bundle, consumer files, tarball.                   | Build verification and clean-install smoke test.                 |
| Workflow    | Windows/Linux and Node 22/24, CodeQL, self-hosted Action invocation, SARIF upload.       | GitHub Actions checks and downloadable artifacts.                |

## Protected behaviors

- Positive, negative, and edge cases exist for each rule family.
- Source locations survive front matter and HTML parsing.
- Broken local paths and fragments differ from external links.
- Active, expired, baseline, and unmatched suppressions remain distinguishable.
- Report HTML escapes repository-controlled content.
- Private-host network requests are blocked before fetch.
- Transient links retry; definite 404 responses do not.
- Invalid documents appear as `DQ013` instead of disappearing.
- Thresholds fail only active diagnostics at or above policy.

## Coverage policy

The suite enforces at least 88% statements/lines, 85% functions, and 75% branches across deterministic core code. The Action and CLI wrappers are excluded from numeric coverage because the same behavior is exercised through scanner/report integration and GitHub workflow execution.

## Manual release checks

1. Install the packed tarball into an empty directory.
2. Run `doc-quality --help` and the valid example corpus.
3. Invoke `dist/index.cjs` with representative Action inputs.
4. Open the HTML report with keyboard-only navigation and a screen-reader spot check.
5. Upload SARIF to a test repository and confirm exact annotations.
6. Review `pnpm audit`, CodeQL, package contents, and generated source maps.

## Known gaps

Static HTML analysis does not replace a rendered-browser accessibility campaign. The project intentionally does not execute code examples; a future opt-in executor would require allowlisted toolchains, containers, strict resources, and an untrusted-content threat review.

## Native authoring and review

`desktop/tests/native-smoke.mjs` operates the actual visible application twice, including the original worker, exact file/line inspection, edit/rescan, metadata policy changes, accepted debt, empty selection, original report contracts, no-overwrite, malformed corpus import, HTML plus CSV reference data, unsaved-Quit cancellation, pending export retained through repeated Quit/Close and durable restart. Native pickers and the unsaved-edit confirmation supply deterministic synthetic choices; actual file I/O, worker, parsers, baseline and application process remain real. `scripts/archive_native.py` repeats that consumer after ZIP relocation and independently compares every payload hash. This is Windows same-machine acceptance, not a signed installer, clean-machine campaign or rendered accessibility certification.

The pure native corpus and actual-engine adapters are included in the unchanged core coverage scope. Actual worker execution is not merged into the parent V8 measurements; `worker.ts` remains in that numeric source scope as uncovered. Its execution is separately proven by the real native consumer. Built-in Node tests independently exercise alias refusal, current/previous state, stale saves, strict resource inventory and actual worker exit. Standard-library Python tests exercise real malicious/oversized/colliding archives. See the [dated report](reports/native-application-2026-11-11.md) for observed counts and distinction between local candidates and hosted checks.

## Baseline review journeys

`tests/integration/baseline-review.test.ts` uses synthetic Markdown and real temporary files to verify repeated refresh, exact new/persistent/moved-line review, partial-scan preservation, oversize parse failures, temporary waivers, unhideable operational errors, stale-content and concurrent-lease refusal, duplicate/conflicting metadata, malformed UTF-8, traversal/symlink bounds, and escaped reports. No report claims an unexamined file is fixed. The standalone Action package test runs with no `node_modules` and checks new debt, manually accepted persistent debt, Action summary and parse-failure enforcement.
