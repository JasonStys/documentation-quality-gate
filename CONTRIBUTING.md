# Contributing

Thank you for improving Documentation Quality Gate.

## Development workflow

1. Create a focused branch from `main`.
2. Install with `pnpm install --frozen-lockfile`.
3. Add or update tests with every behavior change.
4. Run `pnpm verify` before opening a pull request.
5. Describe user impact, security implications, test evidence, and documentation changes.

## Required quality

- Strict TypeScript must compile without errors.
- ESLint and Prettier must pass without warnings.
- Coverage thresholds and integration tests must pass.
- Windows/Linux and Node 22/24 CI must pass.
- New diagnostics need stable IDs, exact locations, remediation, and rule documentation.
- Generated Action bundle changes must correspond to reviewed source changes.

## Commits and releases

Use concise imperative commit subjects. Maintainers use semantic versions and keep `CHANGELOG.md` current. Never rewrite public release tags.

## Security

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
