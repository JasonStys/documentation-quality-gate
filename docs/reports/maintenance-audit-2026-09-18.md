# Maintenance audit — 2026-09-18

## Result

The validated source baseline was `e92f29b`. Hosted [CI](https://github.com/JasonStys/documentation-quality-gate/actions/runs/35192015675), [CodeQL](https://github.com/JasonStys/documentation-quality-gate/actions/runs/35192015428), and the [documentation-quality workflow](https://github.com/JasonStys/documentation-quality-gate/actions/runs/35192015404) passed.

## Dependency decisions

- A grouped TypeScript 7 proposal was rejected because typescript-eslint does not yet support that compiler major.
- Node 26 type declarations were held to preserve the Node 22/24 compatibility matrix.
- Dependabot ignore rules record both constraints and prevent recurring known-bad pull requests.
- No open pull request or non-default maintenance branch remained when this report was prepared.

The successful workflows cover Linux and Windows verification, packaging, CodeQL, and self-hosted documentation rules.
