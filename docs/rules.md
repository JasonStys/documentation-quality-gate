# Rule catalog

Every diagnostic includes a stable ID, severity, exact source location, consequence-oriented message, remediation, and SHA-256 fingerprint.

## Governance and input

### DQ000 — expired suppression

Fails when an exception date is earlier than the scan date. Remove the exception, fix the issue, or renew it after review.

### DQ013 — parseable input

Converts invalid YAML/Markdown processing, unreadable files, and the 5 MiB per-document limit into a visible error instead of silently dropping content.

## Metadata and identity

### DQ001 — required metadata

Requires every configured front-matter field to exist and be non-empty in Markdown documents.

### DQ011 — document identity and version

Enforces repository-unique non-empty `id` values when present and semantic `MAJOR.MINOR.PATCH` versions.

## Structure and accessibility

### DQ002 — heading order

Flags a jump such as H2 to H4 because it damages navigation and assistive-technology structure.

### DQ003 — unique headings

Flags duplicate generated anchors within one document.

### DQ004 — image alternatives

Requires non-empty Markdown alt text or an HTML `alt` attribute. Authors should describe conveyed information, not the filename.

### DQ007 — table headers

Requires non-empty GFM header cells or at least one HTML `th`. Complex tables still require manual scope and reading-order review.

### DQ010 — HTML accessibility structure

Requires a document language, a non-empty title, exactly one main landmark, and unique element IDs.

## Links and examples

### DQ005 — local link targets

Checks relative files and fragments against discovered document anchors or filesystem assets. Matching is case-sensitive for portability.

### DQ006 — safe link schemes

Rejects `javascript:`, `data:`, `file:`, and unknown schemes. Public `http:` links receive a warning when HTTPS should be used.

### DQ008 — typed code examples

Requires every fenced/preformatted code example to declare a language. `json` examples are parsed but never executed.

### DQ012 — external link health

When explicitly enabled, checks unique HTTP(S) URLs with caching, retry, timeouts, and bounded concurrency. Definite client errors are warnings; transient network/service failures are notices. Private targets are blocked unless a trusted operator overrides policy.

## Safety content

### DQ009 — structured warnings

GitHub-style Markdown warning blocks and HTML alert/data-warning regions require these labels:

```text
Condition: When the hazard exists.
Consequence: What can happen.
Avoidance: How to prevent harm.
```

The rule checks structure, not technical correctness; engineering review remains mandatory.
