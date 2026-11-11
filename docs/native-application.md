# Windows documentation workbench

## Purpose and scope

The native application is the same documentation quality engine used by the CLI and GitHub Action, with a full local authoring and review interface. Authors edit Markdown or HTML, select an exact corpus, add inert reference assets, customize required metadata and severity policy, review exact findings, and export original reports. Reviewers can explicitly accept a recomputed baseline with a reason. Accepted, persistent and unexamined debt remains visible; acceptance is not evidence that a document was fixed.

Version 1.1.0 is an unsigned Windows x64 portable application candidate. Publication, installation and independent downloaded acceptance are separate later steps. It bundles Electron and the actual scanner dependencies; users do not need Node, pnpm, an IDE or Python to run the delivered EXE. The existing cross-platform CLI and Action remain available.

## Use the application

1. Extract the complete Windows ZIP to an ordinary local directory. Keep the EXE, resources, DLLs and notices together; moving only the EXE will not work.
2. Open `DocumentationQuality.exe`. The first workspace contains an editable synthetic service-recovery runbook. It is prepared material inside the actual application, not a separate demo program.
3. Select a document, edit its relative filename and source, and choose whether it participates in the scan. Import authorized Markdown/HTML files, or create a new document. Inert CSV, JSON, text, image and YAML attachments can satisfy local references; they are not executed or previewed as active content.
4. Set required metadata, the failure threshold, and optional exact rule/path/line exceptions with rationales and expiry. **Save changes** validates the complete draft before replacing the current corpus. Invalid names, duplicate files, missing fields and excessive input leave the last saved version intact.
5. **Analyze saved corpus** runs the original parsers, rules, governance and baseline review in a separately owned worker. The editor does not fetch external links, invoke Git or execute documentation code. Editing invalidates results for source navigation, export and debt acceptance until the draft is saved and reanalyzed.
6. Select a finding to inspect its exact saved file, line and column. Search results by rule, filename or message. Hide accepted findings only as a display preference; the saved result still retains them.
7. To accept debt deliberately, review the exact results and enter a meaningful reason. Acceptance recomputes the original engine decision and refuses a stale review. An explicit empty selection is shown separately and cannot accept debt. Missing/excluded debt remains unexamined, never automatically fixed.
8. Export the corpus to move it to another workspace, or save the original JSON, SARIF and HTML reports. Original JSON/HTML retain accepted findings and baseline review. Original SARIF contains active findings only. Native exports create new files and refuse overwrite; cancellation changes no file.
9. **Restore previous save** loads the immediately previous corpus into the editor. Inspect it and save explicitly to restore it. It is one recovery checkpoint, not an unlimited backup history.
10. Use **Exit application** or the window Close control. Unsaved edits offer Keep editing or Discard. Accepted workers and file-dialog/export operations are retained through repeated Quit/Close until their actual completion; there is no forced successful shutdown deadline.

## Data and trust boundary

The default durable directory is `%LOCALAPPDATA%\JasonStysPortfolio\documentation-quality-gate\workspace`, outside the installation and Git repository. It contains identified owner metadata, a retained per-launch lock, current/previous corpus JSON and separate Chromium state. A custom absolute `--profile` is for an explicitly chosen empty or already identified ordinary directory. Unknown files, stale locks, corrupt state, pre-existing junction/symlink ancestors and hardlinked mutable members are refused without reset. Preserve unexplained ownership evidence for review.

Corpus text, inert attachments, baseline decisions, exports and Chromium state are **plaintext private OS-account files**, not encrypted storage or authenticated multiuser authorization. The metadata `owner` field describes document content and does not prove a reviewer identity. A trusted concurrent process running as the same OS user can race static filesystem admission; this app does not claim an atomic hostile-namespace boundary. Choose approved local storage; operating-system sync, backups or explicit filesystem selections are outside the application's network-request policy.

If synchronous startup is refused after this launch acquires a workspace, it releases only its own exact ownership token before exiting with failure status. A preexisting or subsequently changed lock remains intact for review. Startup refusal does not reset the saved corpus or ownership marker. Fault-controlled tests exercise the real main module and real profile files while substituting only the Electron refusal API; these tests do not claim that a live operating-system instance collision occurred.

Only fixed immutable UI resources are served on `docquality://workbench/`. The renderer is sandboxed, Node integration is disabled, context isolation is enabled, external navigation/popups/downloads/permissions are denied, and the closed bridge has no arbitrary host-path or process interface. Actual bundled source and owner hashes are verified before module loading. Hashes identify bytes; the package is unsigned and those hashes are not publisher authentication.

Native limits are 64 documents, 1 MiB per document, 8 MiB total document text; 16 inert attachments, 1 MiB each and 2 MiB combined; a 16 MiB serialized corpus, 32 JSON nesting levels and 100,000 structural tokens; 5,000 findings, 15,000 baseline-review entries and 16 MiB per generated report. Excess input fails explicitly rather than truncating findings. The CLI retains its separate repository discovery, 5 MiB document limit and optional network controls.

## Reproduce native validation

Developers use the locked pnpm 11.19.0 graph and a separate locked `desktop` build graph:

```powershell
corepack enable
pnpm install --frozen-lockfile
npm --prefix desktop ci --ignore-scripts
node desktop/node_modules/electron/install.js
pnpm verify
pnpm native:test
python -m unittest discover -s tests -p test_native_archive.py -v
node scripts/build-native.mjs release/verification
python scripts/archive_native.py release/verification/win-unpacked .runtime/native-verification
```

The build requires a clean source tree by default. `--allow-dirty` exists only for explicitly labeled local candidates and is refused in GitHub Actions. Each output must be new; prior builds, failed evidence and private profiles are not deleted or adopted. The Windows archive consumer compares every payload hash after extraction and runs the actual relocated EXE twice. Real compiler/parser, storage, reports and exit behavior remain active; only native file-picker and unsaved-confirmation choices are deterministic test inputs.

## Source navigation

- `src/workbench/project.ts`: closed corpus, portable logical paths, bounds, exact source fingerprint and prepared editable data.
- `src/workbench/analysis.ts`: actual scanner invocation, original reports, exact review identity and original baseline refresh.
- `src/workbench/worker.ts`: one owned original-engine operation.
- `desktop/ui/app.ts`: editing, explicit saves, stale states, findings, debt and report workflows.
- `desktop/main.mjs`: one native window/profile, closed main-frame bridge, worker/file operations and normal Quit.
- `desktop/state.cjs`, `files.cjs`, `profile.cjs`: current/previous CAS, descriptor bounds and static profile admission.
- `desktop/tasks.cjs`, `operation.cjs`: actual worker exit before snapshot removal and retained accepted local promises.
- `scripts/stage-native.mjs`, `build-native.mjs`: original engine bundling, actual dependency notices, source hashes and unsigned Windows packaging.
- `scripts/archive_native.py`: `create_archive`, `extract_archive` and `main` validate actual bounded ZIP bytes, relocate them and run the EXE consumer. `tests/test_native_archive.py` contains independent real-ZIP negatives.

The generated [code map](code-map.md) lists authored TypeScript and JavaScript declarations. See [native validation evidence](reports/native-application-2026-11-11.md) for executed checks and their limits.
