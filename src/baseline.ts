/**
 * @file Bounded documentation-baseline review and atomic refresh.
 * @description Distinguishes accepted debt from newly found and unexamined findings; no heuristic fix claims.
 * @remarks Declarations and scoped variables have exact locations in docs/code-map.md.
 */
import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import type {
  BaselineEntry,
  BaselineReview,
  Diagnostic,
  QualityConfiguration,
  ScanResult,
} from './model.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

export interface BaselineSnapshot {
  readonly sha256: string | null;
  readonly entries: readonly BaselineEntry[];
}

/** Enforce a repository-local existing parent and refuse symlink baseline targets. */
async function baselinePath(root: string, destination: string): Promise<string> {
  const absolute = path.resolve(root, destination);
  const repository = await realpath(root);
  const parent = await realpath(path.dirname(absolute));
  const relative = path.relative(repository, parent);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error('Baseline must stay inside the repository.');
  const canonical = path.join(parent, path.basename(absolute));
  try {
    if ((await lstat(canonical)).isSymbolicLink())
      throw new Error('Baseline symlinks are not supported.');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return canonical;
}

/** Accept only exact repository-relative source identities, never glob or traversal metadata. */
function validEntry(value: unknown): value is BaselineEntry {
  if (value === null || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    Object.keys(entry).sort().join(',') === 'fingerprint,line,path,ruleId' &&
    typeof entry.fingerprint === 'string' &&
    /^[a-f0-9]{64}$/u.test(entry.fingerprint) &&
    typeof entry.ruleId === 'string' &&
    /^DQ\d{3}$/u.test(entry.ruleId) &&
    typeof entry.path === 'string' &&
    entry.path.length > 0 &&
    entry.path.length <= 4096 &&
    !entry.path.includes('\\') &&
    !entry.path.includes('\0') &&
    !path.posix.isAbsolute(entry.path) &&
    !/^[a-z]:/iu.test(entry.path) &&
    !entry.path.split('/').some((segment) => segment === '..' || segment === '.') &&
    Number.isSafeInteger(entry.line) &&
    (entry.line as number) > 0
  );
}

/** Read one descriptor with a hard byte/entry limit; malformed entries never silently disappear. */
export async function loadBaselineSnapshot(
  root: string,
  destination: string,
): Promise<BaselineSnapshot> {
  try {
    const absolute = await baselinePath(root, destination);
    let handle;
    try {
      handle = await open(absolute, 'r');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { sha256: null, entries: [] };
      throw error;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_BYTES)
        throw new Error('Baseline exceeds 2 MiB or is not a regular file.');
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let size = 0;
      while (size < buffer.length) {
        const chunk = await handle.read(buffer, size, buffer.length - size, null);
        if (chunk.bytesRead === 0) break;
        size += chunk.bytesRead;
      }
      if (size > MAX_BYTES) throw new Error('Baseline exceeds 2 MiB.');
      const source = buffer.subarray(0, size);
      const parsed: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(source),
      );
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        !('version' in parsed) ||
        parsed.version !== 1 ||
        !('entries' in parsed) ||
        !Array.isArray(parsed.entries) ||
        parsed.entries.length > MAX_ENTRIES ||
        !parsed.entries.every(validEntry)
      )
        throw new Error(
          'Baseline requires version 1 and at most 10000 complete entries.',
        );
      const entries = new Map<string, BaselineEntry>();
      for (const entry of parsed.entries) {
        const prior = entries.get(entry.fingerprint);
        if (
          prior &&
          (prior.path !== entry.path ||
            prior.line !== entry.line ||
            prior.ruleId !== entry.ruleId)
        )
          throw new Error('Conflicting metadata for a baseline fingerprint.');
        entries.set(entry.fingerprint, entry);
      }
      return {
        sha256: createHash('sha256').update(source).digest('hex'),
        entries: [...entries.values()],
      };
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    throw new Error(`Unable to load baseline ${destination}`, { cause: error });
  }
}

/** Operational read/parse errors and expired governance exceptions cannot become accepted debt. */
export function baselineEligible(diagnostic: Diagnostic): boolean {
  return diagnostic.ruleId !== 'DQ000' && diagnostic.ruleId !== 'DQ013';
}

/** Describe only what this successful scan established; absent/excluded/deleted paths remain unexamined. */
export function reviewBaseline(
  snapshot: BaselineSnapshot,
  diagnostics: readonly Diagnostic[],
  scannedFiles: readonly string[],
  configuration: QualityConfiguration,
): BaselineReview {
  const current = new Map(
    diagnostics.filter(baselineEligible).map((item) => [item.fingerprint, item]),
  );
  const prior = new Map(snapshot.entries.map((entry) => [entry.fingerprint, entry]));
  const scanned = new Set(scannedFiles);
  const entries: BaselineReview['entries'][number][] = [];
  const proposed = new Map<string, BaselineEntry>();
  for (const entry of snapshot.entries) {
    const finding = current.get(entry.fingerprint);
    if (
      finding &&
      (finding.file !== entry.path ||
        finding.ruleId !== entry.ruleId ||
        finding.location.line !== entry.line)
    )
      throw new Error(
        'Baseline fingerprint metadata does not match the current finding.',
      );
    const state = finding
      ? 'persistent'
      : scanned.has(entry.path)
        ? 'not-reproduced'
        : 'unexamined';
    entries.push({
      ...entry,
      state,
      reason:
        state === 'persistent'
          ? 'Same fingerprint observed in this scan.'
          : state === 'not-reproduced'
            ? 'Not reproduced in a successfully parsed file under the current configuration; not a proof of a fix.'
            : 'File was not successfully parsed in this scan; retain pending review.',
    });
    if (state === 'unexamined' || state === 'persistent')
      proposed.set(entry.fingerprint, entry);
  }
  for (const [fingerprint, finding] of current) {
    const entry = {
      fingerprint,
      path: finding.file,
      line: finding.location.line,
      ruleId: finding.ruleId,
    };
    if (!prior.has(fingerprint))
      entries.push({
        ...entry,
        state: 'new',
        reason:
          finding.suppressionReason ??
          'Not in the retained baseline; requires explicit review.',
      });
    if (!finding.suppressionReason?.startsWith('configured:'))
      proposed.set(fingerprint, entry);
  }
  const order = (a: BaselineEntry, b: BaselineEntry) =>
    a.path.localeCompare(b.path) ||
    a.line - b.line ||
    a.ruleId.localeCompare(b.ruleId) ||
    a.fingerprint.localeCompare(b.fingerprint);
  return {
    baselineSha256: snapshot.sha256,
    configurationSha256: createHash('sha256')
      .update(JSON.stringify(configuration))
      .digest('hex'),
    successfullyScannedFiles: [...scanned].sort(),
    entries: entries.sort(order),
    proposedEntries: [...proposed.values()].sort(order),
  };
}

/** Explicit refresh: retain unexamined/persistent debt, accept new findings, and reject stale/concurrent writes. */
export async function refreshBaseline(
  result: ScanResult,
  destination: string,
): Promise<string> {
  const absolute = await baselinePath(result.rootDirectory, destination);
  const lock = await open(`${absolute}.lock`, 'wx');
  const temporary = `${absolute}.${randomUUID()}.tmp`;
  try {
    const snapshot = await loadBaselineSnapshot(result.rootDirectory, destination);
    if (
      result.baselineReview &&
      destination === result.configuration.baselineFile &&
      snapshot.sha256 !== result.baselineReview.baselineSha256
    )
      throw new Error(
        'Baseline changed since scan; scan and review again before refreshing.',
      );
    const review = reviewBaseline(
      snapshot,
      result.diagnostics,
      result.documents.map((document) => document.relativePath),
      result.configuration,
    );
    if (review.proposedEntries.length > MAX_ENTRIES)
      throw new Error('Proposed baseline exceeds 10000 entries.');
    const source = `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), entries: review.proposedEntries }, null, 2)}\n`;
    if (Buffer.byteLength(source) > MAX_BYTES)
      throw new Error('Proposed baseline exceeds 2 MiB.');
    const output = await open(temporary, 'wx');
    try {
      await output.writeFile(source, 'utf8');
      await output.sync();
    } finally {
      await output.close();
    }
    const latest = await loadBaselineSnapshot(result.rootDirectory, destination);
    if (latest.sha256 !== snapshot.sha256)
      throw new Error('Baseline changed during refresh; retry after review.');
    await rename(temporary, absolute);
    return absolute;
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await lock.close();
    await unlink(`${absolute}.lock`);
  }
}
