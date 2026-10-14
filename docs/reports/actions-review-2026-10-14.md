# Actions and security-result review — 2026-10-14

Reviewed by Jason Stys. CodeQL's three open alerts (4, 5, 6) are in the generated
dist/index.cjs vendor bundle, rather than authored application code:

- SHA-1 computes the WebSocket protocol accept value in the bundled HTTP library.
  It is a protocol handshake, not a password or sensitive-data protection hash.
- Zod's generated function compiles a fixed, authored schema. JSON configuration
  supplies values, not schema definitions/code. A regression verifies that
  source-like strings stay data and unrecognized source-like keys are rejected.
- GFM table serialization escapes Markdown pipe characters. The application
  parses facts and escapes HTML separately; it does not treat that serializer
  as an HTML/security sanitizer.

CodeQL now excludes only reproducible dist output, still scans authored source,
and uses the security-and-quality suite. No alert was manually dismissed. The
bundled Action is rebuilt and tested; dependencies are audited separately.

The new full-graph audit revealed two real issues not caught by the previous
workflow: an unpatched braces stack-exhaustion dependency through fast-glob and
an old source-map-js development dependency. Discovery now uses tinyglobby with
the same dotfile, ignore, scope, symlink and deterministic-output contracts.
Glob inputs are bounded to 128 patterns, 4,096 characters each and nesting depth
32 before parsing. Boundary/discovery tests prevent compatibility regressions.
The locked development graph is updated to patched source-map-js.
An explicit workspace override pins every transitive copy to compatible 1.2.2;
it is a reviewed patch selection, not an advisory suppression.

Local Node 24.18.1 verification passed formatting, lint, types, unit/integration
tests with the existing coverage thresholds, package/bundle construction and
the demonstration corpus. The refreshed frozen graph has zero known advisories.
The expanded suite has 27 unique tests (including seven integration cases),
94.63% statement coverage and 78.23% branch coverage. Package verification also
exercises standalone pass/fail fixtures and all three output formats without
installed dependencies. The AST map verifies 598 declaration locations in 27 files.
Native cross-platform CI and CodeQL results and run links will be appended after
they pass. Raw account/log/archive
data is kept private on the PC. This assessment is not a claim of perfect security.

Follow-up native verification exposed an ESM/CJS dependency entry mismatch in
the standalone Action (run 38641400711). The builder selects the static CJS
dependency entry, and package verification now runs pass/fail fixtures in an
isolated directory without node_modules and verifies all three report formats.
The security-and-quality suite also found a stat/read path race: the reader now
checks and reads the same open descriptor and caps actual bytes even if it grows.
Regression tests prove growth rejection and guaranteed descriptor closure.
The redundant metadata branch identified by CodeQL was removed without changing
normal serialized values. No source-level query was disabled or alert dismissed.

The generated declaration map is now AST-based and freshness-checked in CI.
Link validation checks anchors only for parsed markup targets, rather than using
the referring document's anchors for source-file links. Other existing targets
receive existence checks only; code-line correctness is independently guaranteed
for this repository by its declaration-map generator, not by the general link checker.

References: [CodeQL scan configuration](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options),
[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[tinyglobby API](https://github.com/SuperchupuDev/tinyglobby),
[source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
