/**
 * @file Documentation-owner baseline review user journeys.
 * @description Verifies persistent debt, partial scans, stale writes, limits, malformed inputs and honest reports.
 * @remarks Exact source declarations and scoped variables are indexed in docs/code-map.md.
 */
import { readFile, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadBaselineSnapshot, reviewBaseline } from '../../src/baseline.js';
import { parseConfiguration } from '../../src/config.js';
import { createDiagnostic } from '../../src/diagnostics.js';
import { applyGovernance, writeBaselineFile } from '../../src/governance.js';
import {
  createHtmlReport,
  createJsonReport,
  renderConsole,
} from '../../src/reporters.js';
import { scanRepository } from '../../src/scanner.js';
import { createTemporaryRepository } from '../helpers.js';

const baselineFile = '.docquality-baseline.json';
const configuration = parseConfiguration({ requiredMetadata: [] });
const diagnostic = (file = 'docs/a.md', line = 3, message = 'Missing description') =>
  createDiagnostic({
    ruleId: 'DQ004',
    severity: 'error',
    message,
    remediation: 'Describe the diagram',
    file,
    location: { line, column: 1 },
  });
const entry = (file = 'docs/a.md', line = 3) => {
  const finding = diagnostic(file, line);
  return { fingerprint: finding.fingerprint, path: file, line, ruleId: finding.ruleId };
};
const baseline = (entries: unknown[]) =>
  JSON.stringify({ version: 1, generatedAt: '2026-11-09T12:00:00Z', entries });

/** Seed a real bounded repository with two documentation files and an inert local image. */
async function fixture() {
  const repository = await createTemporaryRepository();
  await repository.write(
    '.docquality.json',
    JSON.stringify({ include: ['docs/**/*.md'], requiredMetadata: [] }),
  );
  await repository.write('docs/a.md', '# Alpha\n\n![](diagram.png)\n');
  await repository.write('docs/b.md', '# Bravo\n\n![](diagram.png)\n');
  await repository.write('docs/diagram.png', 'Inert fixture, not executed or decoded.');
  return repository;
}

describe('reviewed baseline workflow', () => {
  it('retains persistent findings across repeated refresh, then reviews a fix and a new finding with exact locations', async () => {
    const repository = await fixture();
    try {
      const first = await scanRepository({ rootDirectory: repository.root });
      expect(
        first.baselineReview?.entries.filter((item) => item.state === 'new'),
      ).toHaveLength(2);
      await writeBaselineFile(first);
      const accepted = await scanRepository({ rootDirectory: repository.root });
      expect(accepted.failed).toBe(false);
      expect(accepted.baselineReview?.entries.map((item) => item.state)).toEqual([
        'persistent',
        'persistent',
      ]);
      await writeBaselineFile(accepted);
      expect((await scanRepository({ rootDirectory: repository.root })).failed).toBe(
        false,
      );
      await repository.write(
        'docs/a.md',
        '# Alpha\n\n![Tank temperature](diagram.png)\n\n![](diagram.png)\n',
      );
      const reviewed = await scanRepository({ rootDirectory: repository.root });
      expect(
        reviewed.baselineReview?.entries.map((item) => [
          item.path,
          item.line,
          item.state,
        ]),
      ).toEqual([
        ['docs/a.md', 3, 'not-reproduced'],
        ['docs/a.md', 5, 'new'],
        ['docs/b.md', 3, 'persistent'],
      ]);
      expect(renderConsole(reviewed)).toContain('not-reproduced');
      expect(createJsonReport(reviewed)).toHaveProperty(
        'baselineReview.configurationSha256',
      );
      expect(createHtmlReport(reviewed)).toContain('docs/a.md:5');
      expect(createHtmlReport(reviewed)).toContain('not proven fixed');
      await writeBaselineFile(reviewed);
      expect(
        (await loadBaselineSnapshot(repository.root, baselineFile)).entries.map(
          (item) => [item.path, item.line],
        ),
      ).toEqual([
        ['docs/a.md', 5],
        ['docs/b.md', 3],
      ]);
      expect((await scanRepository({ rootDirectory: repository.root })).failed).toBe(
        false,
      );
    } finally {
      await repository.cleanup();
    }
  });

  it('preserves excluded, deleted and unreadable files as unexamined; partial refresh cannot erase their debt', async () => {
    const repository = await fixture();
    try {
      await writeBaselineFile(await scanRepository({ rootDirectory: repository.root }));
      await repository.write('docs/a.md', '# Alpha\n\n![Useful diagram](diagram.png)\n');
      const partial = await scanRepository({
        rootDirectory: repository.root,
        paths: ['docs/a.md'],
      });
      expect(partial.baselineReview?.entries.map((item) => item.state)).toEqual([
        'not-reproduced',
        'unexamined',
      ]);
      await writeBaselineFile(partial);
      expect(
        (await loadBaselineSnapshot(repository.root, baselineFile)).entries.map(
          (item) => item.path,
        ),
      ).toEqual(['docs/b.md']);
      await repository.write('docs/b.md', 'x'.repeat(5 * 1024 * 1024 + 1));
      const unreadable = await scanRepository({ rootDirectory: repository.root });
      expect(unreadable.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId: 'DQ013', suppressed: false }),
        ]),
      );
      expect(unreadable.baselineReview?.entries[0]?.state).toBe('unexamined');
      await writeBaselineFile(unreadable);
      expect(
        (await loadBaselineSnapshot(repository.root, baselineFile)).entries,
      ).toHaveLength(1);
      const noFiles = reviewBaseline(
        await loadBaselineSnapshot(repository.root, baselineFile),
        [],
        [],
        configuration,
      );
      expect(noFiles.entries[0]?.state).toBe('unexamined');
      expect(noFiles.proposedEntries).toHaveLength(1);
    } finally {
      await repository.cleanup();
    }
  });

  it('keeps line moves distinct and temporary waivers temporary; operational errors cannot be suppressed', async () => {
    const repository = await createTemporaryRepository();
    try {
      await repository.write(baselineFile, baseline([entry()]));
      const snapshot = await loadBaselineSnapshot(repository.root, baselineFile);
      const moved = reviewBaseline(
        snapshot,
        [diagnostic('docs/a.md', 4)],
        ['docs/a.md'],
        configuration,
      );
      expect(moved.entries.map((item) => item.state)).toEqual(['not-reproduced', 'new']);
      const waived = {
        ...diagnostic('docs/new.md'),
        suppressed: true,
        suppressionReason: 'configured: <script>inert</script>',
      };
      const review = reviewBaseline(
        snapshot,
        [diagnostic(), waived],
        ['docs/a.md', 'docs/new.md'],
        configuration,
      );
      expect(review.proposedEntries).toEqual([entry()]);
      const html = createHtmlReport({
        rootDirectory: repository.root,
        configuration,
        documents: [],
        diagnostics: [],
        summary: {
          files: 0,
          errors: 0,
          warnings: 0,
          notices: 0,
          suppressed: 0,
          durationMs: 0,
        },
        failed: false,
        baselineReview: review,
      });
      expect(html).toContain('&lt;script&gt;inert&lt;/script&gt;');
      expect(html).not.toContain('<script>');
      const error = { ...diagnostic(), ruleId: 'DQ013' };
      const governed = await applyGovernance(
        repository.root,
        [error],
        parseConfiguration({
          suppressions: [
            { ruleId: 'DQ013', rationale: 'Must not hide unreadable input' },
          ],
        }),
      );
      expect(governed[0]?.suppressed).toBe(false);
      expect(
        reviewBaseline(snapshot, [error], [], configuration).proposedEntries,
      ).toEqual([entry()]);
    } finally {
      await repository.cleanup();
    }
  });

  it('refuses stale scans and concurrent writers without touching the existing baseline', async () => {
    const repository = await fixture();
    try {
      const first = await scanRepository({ rootDirectory: repository.root });
      await writeBaselineFile(first);
      await expect(writeBaselineFile(first)).rejects.toThrow(/changed since scan/u);
      const accepted = await scanRepository({ rootDirectory: repository.root });
      const original = await readFile(path.join(repository.root, baselineFile), 'utf8');
      await repository.write(
        `${baselineFile}.lock`,
        'Another reviewed refresh owns this lease.',
      );
      await expect(writeBaselineFile(accepted)).rejects.toThrow(/EEXIST/u);
      expect(await readFile(path.join(repository.root, baselineFile), 'utf8')).toBe(
        original,
      );
    } finally {
      await repository.cleanup();
    }
  });

  it('rejects malformed entries, conflicting fingerprints, invalid UTF-8 and hard input bounds', async () => {
    const repository = await createTemporaryRepository();
    try {
      for (const value of [
        null,
        {},
        { ...entry(), line: 0 },
        { ...entry(), path: '../outside.md' },
        { ...entry(), fingerprint: 'fake' },
        { ...entry(), extra: true },
        { ...entry(), path: 'C:/private.md' },
      ]) {
        await repository.write(baselineFile, baseline([value]));
        await expect(loadBaselineSnapshot(repository.root, baselineFile)).rejects.toThrow(
          /Unable to load/u,
        );
      }
      await repository.write(
        baselineFile,
        baseline([entry(), { ...entry(), path: 'other.md' }]),
      );
      await expect(loadBaselineSnapshot(repository.root, baselineFile)).rejects.toThrow(
        /Unable to load/u,
      );
      await repository.write(baselineFile, baseline([entry(), entry()]));
      expect(
        (await loadBaselineSnapshot(repository.root, baselineFile)).entries,
      ).toHaveLength(1);
      await repository.write(
        baselineFile,
        baseline(Array.from({ length: 10_001 }, () => entry())),
      );
      await expect(loadBaselineSnapshot(repository.root, baselineFile)).rejects.toThrow(
        /Unable to load/u,
      );
      await repository.write(baselineFile, ' '.repeat(2 * 1024 * 1024 + 1));
      await expect(loadBaselineSnapshot(repository.root, baselineFile)).rejects.toThrow(
        /Unable to load/u,
      );
      await writeFile(path.join(repository.root, baselineFile), Buffer.from([0xff]));
      await expect(loadBaselineSnapshot(repository.root, baselineFile)).rejects.toThrow(
        /Unable to load/u,
      );
      await expect(
        loadBaselineSnapshot(repository.root, '../outside.json'),
      ).rejects.toThrow(/Unable to load/u);
    } finally {
      await repository.cleanup();
    }
  });

  it('rejects directory/symlink baselines and mismatched fingerprint metadata', async () => {
    const repository = await createTemporaryRepository();
    try {
      await repository.write('docs/guide.md', '# Guide');
      await expect(loadBaselineSnapshot(repository.root, 'docs')).rejects.toThrow(
        /Unable to load/u,
      );
      await symlink(
        path.join(repository.root, 'docs'),
        path.join(repository.root, baselineFile),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      await expect(loadBaselineSnapshot(repository.root, baselineFile)).rejects.toThrow(
        /Unable to load/u,
      );
      const wrong = {
        sha256: 'a'.repeat(64),
        entries: [{ ...entry(), path: 'misleading.md' }],
      };
      expect(() =>
        reviewBaseline(wrong, [diagnostic()], ['docs/a.md'], configuration),
      ).toThrow(/metadata/u);
      await expect(
        applyGovernance(
          repository.root,
          [diagnostic()],
          configuration,
          new Date(),
          wrong,
        ),
      ).rejects.toThrow(/metadata/u);
    } finally {
      await repository.cleanup();
    }
  });
});
