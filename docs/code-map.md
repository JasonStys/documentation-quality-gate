# Code map and declaration locations

Line locations are verified against version 1.0.0 source after formatting. They are navigation aids rather than API contracts; symbol names remain the stable reference.

## Entry points and orchestration

| File             | Declaration          | Line | Inputs and variables used                                               |
| ---------------- | -------------------- | ---: | ----------------------------------------------------------------------- |
| `src/action.ts`  | `parsePaths`         |   13 | `value`, normalized `paths`.                                            |
| `src/action.ts`  | `annotate`           |   22 | `severity`, `message`, annotation `properties`.                         |
| `src/action.ts`  | `runAction`          |   37 | Action inputs, `result`, `reports`, diagnostic loop.                    |
| `src/cli.ts`     | `createProgram`      |   24 | Commander option/argument definitions.                                  |
| `src/cli.ts`     | `runCli`             |   61 | `arguments_`, `rootDirectory`, `program`, `paths`, `options`, `result`. |
| `src/cli.ts`     | `isDirectInvocation` |   85 | `process.argv[1]`, `import.meta.url`.                                   |
| `src/scanner.ts` | `MAX_DOCUMENT_BYTES` |   20 | Five MiB per-input safety bound.                                        |
| `src/scanner.ts` | `parseDocument`      |   23 | Root/path, file stat, source, parsed document or `DQ013`.               |
| `src/scanner.ts` | `parseDocuments`     |   54 | Files, concurrency, shared cursor, bounded workers.                     |
| `src/scanner.ts` | `scanRepository`     |   89 | Configuration, files, parsed facts, diagnostics, summary, threshold.    |

## Configuration, discovery, and governance

| File                | Declaration             |  Line | Inputs and variables used                                      |
| ------------------- | ----------------------- | ----: | -------------------------------------------------------------- |
| `src/config.ts`     | Schema constants        | 11–42 | Severity, external-link, suppression, and root schemas.        |
| `src/config.ts`     | `formatValidationError` |    58 | Zod issues and stable field paths.                             |
| `src/config.ts`     | `parseConfiguration`    |    65 | Unknown value and validated result.                            |
| `src/config.ts`     | `loadConfiguration`     |    76 | Root/config path, source JSON, filesystem errors.              |
| `src/discovery.ts`  | `execFileAsync`         |    12 | Promisified argument-array Git execution.                      |
| `src/discovery.ts`  | `normalizeRelative`     |    15 | Platform path separators.                                      |
| `src/discovery.ts`  | `changedFiles`          |    20 | Root, revision, Git stdout, changed-path set.                  |
| `src/discovery.ts`  | `discoverFiles`         |    40 | Globs, ignores, scopes, optional changed set, candidates.      |
| `src/governance.ts` | `loadBaseline`          |    19 | Root, baseline path, parsed entries, fingerprint set.          |
| `src/governance.ts` | `matchesSuppression`    |    57 | Diagnostic and scoped suppression.                             |
| `src/governance.ts` | `applyGovernance`       |    69 | Baseline, date, active/expired suppressions, governed results. |
| `src/governance.ts` | `writeBaselineFile`     |   117 | Scan result, destination, versioned entries.                   |

## Parsing and rules

| File                      | Declaration             |    Line | Inputs and variables used                                        |
| ------------------------- | ----------------------- | ------: | ---------------------------------------------------------------- |
| `src/parsers/markdown.ts` | `locationOf`            |      34 | Unist position.                                                  |
| `src/parsers/markdown.ts` | `textOf`                |      46 | Literal value/alt and child recursion.                           |
| `src/parsers/markdown.ts` | `headingSlug`           |      58 | Unicode heading text.                                            |
| `src/parsers/markdown.ts` | `parseMarkdownDocument` |      68 | Paths, source, syntax tree, fact collections, metadata, anchors. |
| `src/parsers/html.ts`     | `attribute`             |      42 | Node attributes and requested name.                              |
| `src/parsers/html.ts`     | `textOf`                |      50 | Text nodes and recursive descendants.                            |
| `src/parsers/html.ts`     | `locationOf`            |      58 | parse5 source coordinates.                                       |
| `src/parsers/html.ts`     | `descendants`           |      72 | Node, predicate, match collection.                               |
| `src/parsers/html.ts`     | `parseHtmlDocument`     |      87 | Paths, source, elements, facts, IDs, landmarks, title, language. |
| `src/rules.ts`            | `RULES`                 |      23 | Stable rule metadata.                                            |
| `src/rules.ts`            | Scheme/version patterns | 112–113 | Link and semantic-version validation.                            |
| `src/rules.ts`            | `decodePath`            |     116 | URI component with malformed-input fallback.                     |
| `src/rules.ts`            | `displayValue`          |     125 | Untrusted metadata and safe serialization.                       |
| `src/rules.ts`            | `documentDiagnostic`    |     145 | Document context and diagnostic fields.                          |
| `src/rules.ts`            | `pathExists`            |     164 | Filesystem candidate.                                            |
| `src/rules.ts`            | `evaluateLocalLinks`    |     174 | Root, document map, target paths, fragments.                     |
| `src/rules.ts`            | `evaluateRules`         |     248 | Documents, configuration, identifiers, rule diagnostics.         |

## Network, diagnostics, and reporting

| File                    | Declaration             | Line | Inputs and variables used                             |
| ----------------------- | ----------------------- | ---: | ----------------------------------------------------- |
| `src/external-links.ts` | `isPrivateAddress`      |   37 | IP address, mapped IPv4 octets.                       |
| `src/external-links.ts` | `validateNetworkTarget` |   67 | URL, policy, DNS addresses.                           |
| `src/external-links.ts` | `loadCache`             |  100 | Cache path and parsed entries.                        |
| `src/external-links.ts` | `requestLink`           |  115 | URL, timeout, response/error classification.          |
| `src/external-links.ts` | `checkWithRetry`        |  162 | URL, policy, blocked state, attempts.                 |
| `src/external-links.ts` | `runBounded`            |  183 | Items, concurrency, worker, cursor.                   |
| `src/external-links.ts` | `evaluateExternalLinks` |  206 | Documents, URL groups, cache, results, diagnostics.   |
| `src/diagnostics.ts`    | `diagnosticFingerprint` |   19 | Rule, path, line, message, SHA-256 hash.              |
| `src/diagnostics.ts`    | `createDiagnostic`      |   31 | Diagnostic input and governance defaults.             |
| `src/reporters.ts`      | `escapeHtml`            |   12 | Untrusted report text.                                |
| `src/reporters.ts`      | `consoleLine`           |   22 | Diagnostic state and location.                        |
| `src/reporters.ts`      | `renderConsole`         |   28 | Diagnostics and summary.                              |
| `src/reporters.ts`      | `createJsonReport`      |   37 | Scan result and report envelope.                      |
| `src/reporters.ts`      | `createSarifReport`     |   48 | Rules, active findings, source regions, fingerprints. |
| `src/reporters.ts`      | `createHtmlReport`      |  104 | Escaped rows and accessible summary/table.            |
| `src/reporters.ts`      | `writeReports`          |  157 | Result, output directory, report paths.               |

## Shared model

`src/model.ts` defines severity policy at lines 7–15; source/fact types at lines 17–84; diagnostics and configuration at lines 86–122; baseline/scan/report contracts at lines 125–169. These interfaces carry data only and contain no hidden runtime state.

## Build and performance scripts

| File                         | Declaration       | Line | Inputs and variables used                           |
| ---------------------------- | ----------------- | ---: | --------------------------------------------------- |
| `scripts/benchmark.ts`       | `sizes`           |   19 | Corpus sizes 100, 1,000, and 10,000.                |
| `scripts/benchmark.ts`       | `writeFixtures`   |   23 | Temporary root, count, bounded 100-file batches.    |
| `scripts/build-action.mjs`   | Top-level build   |    8 | Absolute entry/output, Node 24 ESM bundle settings. |
| `scripts/clean.mjs`          | Top-level cleanup |    8 | Repository-local `dist` target.                     |
| `scripts/verify-package.mjs` | `required`        |    8 | Required package/action artifact list.              |
