# Native startup status and unsaved corpus protection

By Jason Stys. Observed 11 November 2026. Scope: the 1.1.1 candidate; the published and installed 1.1.0 and its earlier positive-use evidence remain unchanged.

## Actual issues reproduced

The pinned Electron 44.11.1 runtime returned zero for `process.exitCode = 1; app.quit()`. A normal `app.quit()` control also returned zero; an explicit `app.exit(1)` control returned one. Importing the real 1.1.0 main/profile implementation reproduced zero exits for both foreign-lock refusal and asynchronous missing-resource failure. These cases preserved their real marker, corpus and foreign-lock evidence and created no application window or scanner worker. Only the error-dialog display was redirected. This was a fatal-startup observability fault, not evidence that ordinary 1.1.0 application startup or use failed.

The unchanged installed 1.1.0 app also reproduced three unsaved-editor losses. Load prepared, Restore previous save and Import corpus each replaced typed unsaved text without a confirmation. The saved corpus stayed unchanged; all 90 installed program files stayed identical and the synthetic test process closed normally. Earlier incomplete harness observations are retained separately and are not relabeled as product evidence.

## Bounded corrections

Failed startup now seals and awaits the actual retained-operation owner before explicitly exiting one. Its exact acquired profile token is released; a foreign or changed token remains for review. An unproven drain does not request exit or release the profile. The helper stays in the existing operation module, preserving the complete 90-file payload shape. Ordinary successful Quit retains its original drain and `app.quit()` path.

Whole-corpus replacements now ask Keep editing or Discard and replace through a main-owned dialog. Keep editing preserves unapplied text, filename, selection and policy and does not open an import picker. Discard permits the chosen replacement into the draft, not into saved state. Canceled or invalid imports still preserve the current draft. Individual document and inert attachment additions retain their existing behavior.

No account, corpus or baseline schema changed. The original scanner, rules, active-only SARIF contract, report exports, current/previous saves, profile admission and original quality floors remain.

## Observed local validation

| Gate                                 | Observed result                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original complete source gate        | All 62 unit and 16 integration cases passed; 93.60% lines, 93.35% statements, 83.20% branches and 97.87% functions. Original floors and original cases remain.                                                                  |
| Native ownership and bounded helpers | All 26 Node cases passed; 99.79% lines, 92.52% branches and 100% functions, with original 95/85/95 floors. This scope does not measure the entire Electron/UI binary.                                                           |
| Original real archive controls       | All six cases passed with Python 3.14.10, including actual hardlinks, traversal, growth, names and byte budgets.                                                                                                                |
| Actual pinned Electron startup       | All five observations matched: process exitCode plus quit returned 0; normal quit returned 0; explicit exit returned 1; real foreign-lock and missing-resource failures returned 1.                                             |
| ZIP-extracted 1.1.1 candidate        | Original complete graphical journeys passed in two visible launches with normal exits 0/0 and zero page errors. Three Keep editing and three Discard choices preserved the saved corpus while exercising all replacement paths. |
| Independent after-use integrity      | All 90 original payload file bytes matched the archive after both launches; no extra files were present. Actual descriptor regular-file and single-link checks remained strict.                                                 |
| Current full dependency audits       | Source and isolated desktop graphs each reported zero advisories at the moderate threshold; no production-only omission or ignore.                                                                                              |

The passing second candidate was built over baseline `ff11a022d0b61770353b6c98acc0b38e6706cbbc` with an explicit dirty-candidate flag. Its ZIP SHA256 was `c5bde312a2f34dd12cdfbd72b5e94fea7c53bf9d35dd37a149074c957a5008ca`. This establishes observed behavior, not clean-source publication or installation. Exact committed-source replay and hosted integration require their own receipts.

- The four original real-main refusal fixtures remain, with an additional asynchronous readiness-refusal case. They execute actual profile/files and substitute the Electron host API; they do not independently establish an operating-system collision.
- Four actual retained-owner tests cover held accepted work, a rejected accepted operation, changed real ownership and an unproven drain. The held operation keeps the lock and prevents exit until that same work completes.
- Separate actual Electron cases preserve the zero-success and API controls and observe real main startup failures. These are distinct from the Node host fixtures and from complete compiled-app acceptance.
- The native workflow keeps helper, archive and actual Electron status checks in independent steps, so a later successful command cannot hide an earlier failed native command.

The first candidate correctly failed the unchanged full consumer because the original SARIF driver still reported version 1.1.0 while the application, binary and source metadata were 1.1.1. The versioned reporter contract was corrected, with a package-manifest comparison added to the existing reporter test. A fresh archive then passed; the failed archive remains separate. An earlier local archive check used the older document-rendering Python and lacked the required ZIP API; the unchanged tests passed with the project's required isolated Python 3.14.10 rather than changing the archive implementation.

The first hosted native job then failed before its Electron observations because a clean checkout had no `.runtime` parent directory. The controller now creates only its admitted owned parent and still requires a fresh exclusive final output. A genuinely absent nested parent is exercised locally; the failed hosted log remains separate. This corrects a test prerequisite, not an application assertion or a runner acquisition problem.

Run `pnpm verify`, `pnpm native:test`, the archive tests, `node desktop/tests/startup-electron.mjs .runtime/fresh-status-proof`, and the exact-source build/archive consumer described in the native guide. PR/main CodeQL results, independent release downloads, installation and shortcut updates are separate observations; no later result is inferred here.

## Limits

Actual Electron status cases create no application window or scanner work. They do not replace the complete two-launch consumer, which must still exercise real editing, policy, original worker execution, debt, exports, invalid input, recovery and retained pending Quit. Error-dialog display and deterministic native picker choices are test inputs; lifecycle APIs and domain/file operations are not replaced in their respective real-runtime cases.

The application remains unsigned and plaintext for one trusted OS owner. Static file admission is not protection against hostile concurrent same-owner namespace changes. Accepted debt is not a repair or authenticated operational approval. No ordinary profile, published asset, installed program, Docker setting or global toolchain was modified by the correction work.

Primary API references: [Electron app quit](https://www.electronjs.org/docs/latest/api/app#appquit) and [Electron app exit](https://www.electronjs.org/docs/latest/api/app#appexitexitcode).
