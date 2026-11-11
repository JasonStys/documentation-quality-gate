/**
 * @file Runs the original quality scanner and baseline refresh against a fresh owned corpus snapshot.
 * @description Uses actual parsers/rules/governance/reporters; input carries no host path, Git revision or network mode.
 * @remarks The native owner supplies a new private snapshot path and retains it until actual worker completion.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { refreshBaseline } from '../baseline.js';
import type { ScanResult } from '../model.js';
import { createHtmlReport, createJsonReport, createSarifReport } from '../reporters.js';
import { readBoundedDocument, scanRepository } from '../scanner.js';
import {
  effectiveConfiguration,
  parseNativeProject,
  projectFiles,
  projectFingerprint,
} from './project.js';
import type { NativeProject } from './project.js';

export interface NativeAnalysis {
  readonly schema: 1;
  readonly projectSha256: string;
  readonly reviewedAt: string;
  readonly reviewSha256: string;
  readonly selectedDocuments: number;
  readonly status: 'empty-selection' | 'findings' | 'debt-review' | 'clear';
  readonly summary: ScanResult['summary'];
  readonly failed: boolean;
  readonly diagnostics: ScanResult['diagnostics'];
  readonly baselineReview: ScanResult['baselineReview'];
  readonly reports: {
    readonly json: string;
    readonly sarif: string;
    readonly html: string;
  };
}

/** Reject static parent aliases before atomically reserving a new snapshot; never adopt an existing directory. */
async function createSnapshot(directory: string): Promise<void> {
  if (!path.isAbsolute(directory))
    throw new Error('A private absolute snapshot path is required.');
  let ancestor = path.dirname(directory);
  for (;;) {
    const stat = await lstat(ancestor);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error('Snapshot parent must be an ordinary directory.');
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  await mkdir(directory, { mode: 0o700 });
}

/** Only validated logical files are written, and only after fresh-directory admission succeeds. */
async function scanSnapshot(
  project: NativeProject,
  directory: string,
  now: Date,
): Promise<ScanResult> {
  const input = parseNativeProject(JSON.stringify(project));
  if (!Number.isFinite(now.getTime())) throw new Error('Analysis clock is invalid.');
  await createSnapshot(directory);
  for (const [name, content] of projectFiles(input)) {
    const destination = path.join(directory, ...name.split('/'));
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, content, { flag: 'wx', mode: 0o600 });
  }
  const result = await scanRepository({ rootDirectory: directory, now });
  if (
    result.diagnostics.length > 5000 ||
    (result.baselineReview?.entries.length ?? 0) > 15000
  )
    throw new Error(
      'Review exceeds the native finding budget; select a smaller corpus. No result was truncated.',
    );
  if (
    JSON.stringify(result.configuration) !== JSON.stringify(effectiveConfiguration(input))
  )
    throw new Error(
      'The actual scanner configuration differs from the requested offline corpus.',
    );
  return result;
}

/** A decision identity deliberately excludes elapsed time and temporary absolute paths. */
function decisionHash(project: NativeProject, result: ScanResult): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        projectSha256: projectFingerprint(project),
        configuration: result.configuration,
        diagnostics: result.diagnostics,
        failed: result.failed,
        summary: { ...result.summary, durationMs: 0 },
        baselineReview: result.baselineReview,
      }),
    )
    .digest('hex');
}

/** Preserve actual policy failure separately from active findings, retained debt and absence of selected input. */
function analysisResult(
  project: NativeProject,
  result: ScanResult,
  now: Date,
): NativeAnalysis {
  const selectedDocuments = project.documents.filter(
    (document) => document.selected,
  ).length;
  const active = result.diagnostics.some((diagnostic) => !diagnostic.suppressed);
  const status = active
    ? 'findings'
    : selectedDocuments === 0
      ? 'empty-selection'
      : (result.baselineReview?.entries.length ?? 0) > 0
        ? 'debt-review'
        : 'clear';
  const reports = {
    json: JSON.stringify(createJsonReport(result), null, 2) + '\n',
    sarif: JSON.stringify(createSarifReport(result), null, 2) + '\n',
    html: createHtmlReport(result),
  };
  for (const value of Object.values(reports))
    if (Buffer.byteLength(value, 'utf8') > 16 * 1024 * 1024)
      throw new Error(
        'Native report exceeds 16 MiB; select a smaller corpus. No report was truncated.',
      );
  return {
    schema: 1,
    projectSha256: projectFingerprint(project),
    reviewedAt: now.toISOString(),
    reviewSha256: decisionHash(project, result),
    selectedDocuments,
    status,
    summary: result.summary,
    failed: result.failed,
    diagnostics: result.diagnostics,
    baselineReview: result.baselineReview,
    reports,
  };
}

/** Run the complete original engine on this explicit corpus, without Git discovery or external-link fetches. */
export async function analyzeProject(
  project: NativeProject,
  snapshotDirectory: string,
  now = new Date(),
): Promise<NativeAnalysis> {
  const result = await scanSnapshot(project, snapshotDirectory, now);
  return analysisResult(project, result, now);
}

/** Recompute actual decisions before an explicit baseline refresh; never accept findings the user did not review. */
export async function acceptReviewedBaseline(
  project: NativeProject,
  snapshotDirectory: string,
  reviewSha256: string,
  now = new Date(),
): Promise<NativeProject> {
  if (!/^[a-f0-9]{64}$/u.test(reviewSha256))
    throw new Error('Choose an exact reviewed result.');
  const result = await scanSnapshot(project, snapshotDirectory, now);
  if (project.documents.every((document) => !document.selected))
    throw new Error('Select and review documentation before accepting debt.');
  if (decisionHash(project, result) !== reviewSha256)
    throw new Error('Results changed since review; analyze and review again.');
  const baselinePath = await refreshBaseline(result, result.configuration.baselineFile);
  const baseline: unknown = JSON.parse(await readBoundedDocument(baselinePath));
  return parseNativeProject(JSON.stringify({ ...project, baseline }));
}
