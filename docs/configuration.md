# Configuration reference

## File and schema

The default path is `.docquality.json`. Add the schema reference for editor completion:

```json
{
  "$schema": "./schemas/config.schema.json"
}
```

Unknown keys are rejected so misspelled policy does not silently disappear.

## Fields

| Field              | Type                                 | Default                          | Meaning                                        |
| ------------------ | ------------------------------------ | -------------------------------- | ---------------------------------------------- |
| `include`          | String array                         | `**/*.{md,html}`                 | Tinyglobby patterns relative to the scan root. |
| `exclude`          | String array                         | Generated/dependency directories | Files removed before parsing.                  |
| `failOn`           | `error`, `warning`, `notice`, `none` | `error`                          | Lowest active severity that produces failure.  |
| `requiredMetadata` | String array                         | `title`                          | YAML front-matter keys required for Markdown.  |
| `baselineFile`     | String                               | `.docquality-baseline.json`      | Reviewed diagnostic fingerprints.              |
| `externalLinks`    | Object                               | Disabled                         | Bounded public-network policy.                 |
| `suppressions`     | Object array                         | Empty                            | Explicit scoped exceptions.                    |

## External links

Both `include` and `exclude` allow at most 128 patterns, each trimmed and limited
to 4,096 characters and 32 nested glob delimiters. These conservative limits
are checked before discovery. Duplicate matches are removed, hidden documents
remain eligible, ignored paths remain excluded and directory symlinks are not
followed. Invalid configuration fails explicitly rather than silently skipping.

| Field               | Bounds     | Purpose                                         |
| ------------------- | ---------- | ----------------------------------------------- |
| `enabled`           | Boolean    | Network access is opt-in.                       |
| `timeoutMs`         | 250–30,000 | Deadline for each attempt.                      |
| `retries`           | 0–3        | Retries only transient outcomes.                |
| `concurrency`       | 1–16       | Maximum simultaneous requests.                  |
| `cacheTtlHours`     | 0–720      | Reuse duration for `.docquality-cache.json`.    |
| `allowPrivateHosts` | Boolean    | Trusted-environment override; false by default. |

The cache is evidence acceleration, not a baseline. A stale entry is rechecked.

## Suppressions

Each suppression requires a stable `ruleId` and at least an eight-character rationale. Optional `path` uses minimatch syntax, `line` narrows the scope, and `expires` uses ISO `YYYY-MM-DD`.

```json
{
  "ruleId": "DQ004",
  "path": "docs/legacy/**",
  "line": 18,
  "rationale": "Replacement diagram approved for the next migration increment.",
  "expires": "2027-01-31"
}
```

On or after review, remove the exception or set a new date deliberately. An expired entry generates unsuppressed `DQ000`.

## Baseline workflow

```bash
node dist/lib/cli.js . --write-baseline
```

Review the generated file before committing it. Fingerprints include rule, file, line, and message, so a baseline cannot hide a different issue merely because it shares a rule ID.

## Changed-file mode

```bash
git fetch origin main --depth=1
node dist/lib/cli.js . --changed-from origin/main
```

The implementation calls Git with an argument array and uses `revision...HEAD`. The revision must exist locally. Repository-wide identity guarantees still benefit from periodic full scans.

## Exit codes

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | Scan completed and policy passed.                                    |
| `1`  | Scan completed and at least one active diagnostic met the threshold. |
| `2`  | Configuration, discovery, or execution could not complete.           |
