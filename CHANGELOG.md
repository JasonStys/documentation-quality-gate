# Changelog

All notable changes use semantic versioning.

## 1.1.1 — 2026-11-11

- Report failed native startup with an actual nonzero Electron exit only after accepted work drains; preserve foreign ownership and the original normal Quit path.
- Require Keep editing or Discard before prepared, previous-save or imported corpus data replaces unsaved authoring.
- Retain the original scanner, report semantics, profile schema and published 1.1.0 assets. Add actual Electron exit controls and compiled keep/discard cases without reducing existing gates.

## 1.0.0 — 2026-09-16

- Added Markdown/GFM/front-matter and HTML fact extraction.
- Added stable metadata, structure, accessibility, link, example, warning, and identity rules.
- Added bounded cached external-link checks with private-host protection.
- Added baselines, expiring suppressions, changed-file mode, and severity gates.
- Added console, JSON, SARIF, HTML, Action annotation, and step-summary outputs.
- Added Windows/Linux Node 22/24 CI, CodeQL, self-dogfooding, benchmark, and package verification.
