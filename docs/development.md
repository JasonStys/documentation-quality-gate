# Development guide

## Prerequisites

- Node.js 22 or 24.
- Corepack and pnpm 11.19.0.
- Git for changed-file integration tests and contributor workflows.

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

## Adding a rule

1. Add a stable ID and description to `RULES` in `src/rules.ts`.
2. Derive the smallest reusable fact in a parser; keep presentation out of parsing.
3. Emit an exact location, consequence-oriented message, and concrete remediation.
4. Add positive, negative, edge, and suppression tests.
5. Update `docs/rules.md`, README summary, JSON/SARIF evidence, and the code map.
6. Benchmark if the rule adds a repository-wide lookup or non-linear operation.

Rule IDs are API surface. Never reuse an ID for different semantics.

## Style

- Prefer pure functions and immutable contracts.
- Bound concurrency, inputs, retry counts, and timeouts.
- Use `unknown` at trust boundaries and validate before narrowing.
- Do not call a shell when an argument-array process API is available.
- Keep security-sensitive defaults restrictive.
- Write comments for decisions and invariants, not restatements of syntax.

## Pull requests

Use a focused branch, conventional commit-style subject, and a PR description with behavior, tests, security impact, and evidence. CI must pass on Windows/Linux and Node 22/24. Do not hand-edit `dist/index.cjs`; rebuild it with `pnpm build` and review the source change that produced it.

## Release process

1. Run `pnpm verify` and `pnpm benchmark`.
2. Run `pnpm pack:artifact` and install the tarball in a clean directory.
3. Review CodeQL, dependency audit, package contents, reports, and source map.
4. Update `CHANGELOG.md` and evidence reports.
5. Tag a semantic version and maintain the matching major Action tag.
