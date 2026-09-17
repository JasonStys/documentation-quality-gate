# Verification report

## Scope

This report records the release-candidate quality evidence for version 1.0.0. It is updated from executed commands rather than projected results.

## Automated checks

| Check                      | Result                                                                   | Evidence                                          |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| Formatting                 | Passing                                                                  | `pnpm format:check`                               |
| Type-aware lint            | Passing                                                                  | `pnpm lint`                                       |
| Strict TypeScript          | Passing                                                                  | `pnpm typecheck`                                  |
| Unit and integration tests | 19 distinct tests passing                                                | `pnpm test` and `pnpm test:integration`           |
| Statement coverage         | 93.29%                                                                   | V8 coverage summary                               |
| Branch coverage            | 75.00%                                                                   | V8 coverage summary                               |
| Function coverage          | 97.84%                                                                   | V8 coverage summary                               |
| Line coverage              | 93.39%                                                                   | V8 coverage summary                               |
| Action/CLI build           | Passing                                                                  | `pnpm build`                                      |
| Valid-corpus dogfood       | Passing: 3 files, zero diagnostics                                       | `pnpm dogfood`                                    |
| Package smoke test         | Passing: clean install, zero-diagnostic scan, and JSON/SARIF/HTML output | Packed tarball installed in an isolated directory |
| Cross-platform CI          | Pending publication                                                      | GitHub Actions matrix                             |
| CodeQL                     | Pending publication                                                      | GitHub code scanning                              |

## Security validation

- Loopback integration tests prove private targets are rejected by default.
- Local HTTP tests cover successful, definite 404, transient 503, retry, and cache behavior.
- Reporter tests inject a script-like diagnostic and confirm HTML escaping.
- Code examples are parsed, not executed.
- Git changed-file discovery uses `execFile` and argument arrays.

## Known limitations

Rendered-browser accessibility, visual regression, and sandboxed multi-language example execution are future work. Static checks and JSON parsing are intentionally the current safe boundary.
