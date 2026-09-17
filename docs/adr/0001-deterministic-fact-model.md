# ADR 0001: Deterministic document-fact model

- Status: Accepted
- Date: 2026-09-16

## Context

Rules need common access to Markdown and HTML structure. Directly coupling each rule to parser-specific syntax trees would duplicate traversal, complicate cross-file checks, and make report behavior depend on a renderer.

## Decision

Parse each supported format into a small immutable `DocumentFacts` model containing metadata, headings, anchors, links, images, tables, code blocks, warnings, and static HTML accessibility facts. Rules consume facts and produce immutable diagnostics. Optional network evaluation and governance occur after deterministic rules.

## Options considered

| Option                        | Benefit                                           | Cost                                                   |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| Run many existing linters     | Fast initial coverage.                            | Inconsistent IDs, locations, configuration, and noise. |
| Let rules inspect raw source  | Minimal parser layer.                             | Fragile regex behavior and duplicated parsing.         |
| Let rules inspect native ASTs | Full syntax detail.                               | Parser coupling and difficult cross-format rules.      |
| Shared fact model             | Stable rules, testability, cross-format behavior. | Some format-specific detail is intentionally omitted.  |

## Consequences

- Rule complexity is approximately linear in fact count.
- Parser tests protect location and normalization contracts.
- Adding a format requires one adapter rather than rewriting every rule.
- Rules requiring uncommon syntax may need a carefully reviewed new fact.

## Revisit trigger

Revisit if auto-fixing requires lossless syntax preservation or if a supported format cannot represent needed semantics without excessive fact-model expansion.
