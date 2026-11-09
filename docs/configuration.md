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

First run without `--write-baseline` and inspect `documentation-quality.html` or the JSON `baselineReview`. The Action also summarizes the four states without mutating the baseline:

| State          | What the scan established                                                                    | Explicit refresh behavior                          |
| -------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| New            | Current eligible fingerprint absent from the baseline.                                       | Accept unless temporarily waived by configuration. |
| Persistent     | Same fingerprint and exact identity reproduced.                                              | Retain, including already accepted debt.           |
| Not-reproduced | Successfully parsed file did not reproduce this fingerprint under the current configuration. | Remove after operator review.                      |
| Unexamined     | File missing, excluded, outside selected scope or unreadable.                                | Retain.                                            |

Not-reproduced is **not proof of a fix**: configuration, enabled network checks and line numbers affect findings. Review records the current configuration SHA-256 and successfully parsed paths. Existing fingerprints remain line-sensitive; line moves are new plus not-reproduced rather than guessed equivalences.

`--write-baseline` explicitly accepts new findings, retains persistent/unexamined debt and prunes only not-reproduced entries. Review the generated file before committing it. A first accepting scan may still exit 1 because the report describes the pre-refresh policy; run again to validate the newly accepted baseline. Temporary configured exceptions are not added as new baseline debt. `DQ000` expiry and `DQ013` unreadable/parse errors are never suppressible or newly accepted into a baseline.

Baseline files are capped at 2 MiB and 10,000 complete entries. Exact duplicate entries are deduplicated; conflicting metadata, invalid UTF-8, malformed entries and traversal paths fail explicitly. Targets must be inside the repository, with an existing parent and no target symlink. Refresh uses an exclusive adjacent `.lock`, a flushed temporary file, content-hash stale-scan checks and atomic replacement. It refuses stale or concurrent refreshes rather than overwriting another review. If a process is forcibly stopped, review/remove its stale lock yourself only after verifying no refresh is active. These guards coordinate this CLI, not arbitrary external writers; keep the working directory trusted.

Fingerprints include rule, file, line, and message, so a baseline cannot hide a different issue merely because it shares a rule ID.

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
