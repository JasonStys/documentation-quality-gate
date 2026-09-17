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
3. Invoke `dist/index.js` with representative Action inputs.
4. Open the HTML report with keyboard-only navigation and a screen-reader spot check.
5. Upload SARIF to a test repository and confirm exact annotations.
6. Review `pnpm audit`, CodeQL, package contents, and generated source maps.

## Known gaps

Static HTML analysis does not replace a rendered-browser accessibility campaign. The project intentionally does not execute code examples; a future opt-in executor would require allowlisted toolchains, containers, strict resources, and an untrusted-content threat review.
