# Documentation Quality Gate handbook

By Jason Stys.

Review new, persistent, not-reproduced and unexamined debt with exact locations; refresh atomically without losing debt from partial scans or hiding operational errors.

Makes accepted documentation debt maintainable rather than silently clearing it during repeat baseline refreshes.

## Read the documentation

| Edition                                          | Audience and contents                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [project-guide.docx](reports/project-guide.docx) | User and developer guide: purpose, current usage, design, boundaries and source references. |

The editable Markdown remains the maintenance source. The Word files are readable editions, and the workbook is an evidence index rather than a test runner. See [publication identities and review](reports/publications.json) and the [documentation refresh record](reports/documentation-refresh-2026-11-09.md).

## Current usage and help

[README quick start](../README.md) is the entry point. Use the project-specific guides below before changing inputs, operating modes or deployment assumptions.

### Usage and operations

- [operations](operations.md)

### Design and contracts

- [adr/0001 deterministic fact model](adr/0001-deterministic-fact-model.md)
- [architecture](architecture.md)

### Security and validation

- [security](security.md)
- [testing](testing.md)

## Historical results and reproduction

The reviewed source is [`0757e5a18da5e0e8baf98a527d4fb6c54c752420`](https://github.com/JasonStys/documentation-quality-gate/tree/0757e5a18da5e0e8baf98a527d4fb6c54c752420). The observed functional workflow baseline is `0757e5a18da5e0e8baf98a527d4fb6c54c752420`; those observations are recorded at `2026-11-10T05:25:40.628667+00:00`. They do not certify an unrun later revision.

- [Detailed recorded validation](reports/practical-workflows-2026-11-09.md)
- [Current Actions](https://github.com/JasonStys/documentation-quality-gate/actions) records later integration checks separately.
- Preserve dated measurements and follow the existing testing guide to reproduce them; a test-source inventory alone does not establish execution.

## Practical boundaries

- Not-reproduced means absent under the current configuration, not proven fixed. Fingerprints remain line-sensitive with no guessed move matching.
- Deleted, excluded and unreadable files remain unexamined until human reconciliation.
- The adjacent lease coordinates cooperative CLI writers, not arbitrary external software; use a trusted checkout.

## Maintaining these editions

Update the editable usage/design/test documents first. Rebuild and visually review every Word page and workbook tab before replacing an edition; verify the exact binary digests and evidence source in publications.json. Keep account data, logs with secrets, installed-app state and private test stores out of documentation. Source and release assets retain their existing security and licensing boundaries.
