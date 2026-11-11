/**
 * @file Real scanner/native-corpus user journeys over actual owned filesystem snapshots.
 * @description Exercises exact fixes, configurable metadata, retained debt and stale/expired review refusal.
 * @remarks Network fetch is a refusal oracle only; no parser, rule, governance or reporter is mocked.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTemporaryRepository } from '../helpers.js';
import { acceptReviewedBaseline, analyzeProject } from '../../src/workbench/analysis.js';
import { preparedProject } from '../../src/workbench/project.js';

describe('real native documentation analysis', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  it('finds the real heading problem, exports original reports and verifies the authored fix', async () => {
    const repo = await createTemporaryRepository();
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network must not be used'));
    try {
      const project = preparedProject(),
        report = await analyzeProject(project, path.join(repo.root, 'first'), now);
      expect(report.status).toBe('findings');
      expect(report.failed).toBe(true);
      expect(report.summary.files).toBe(2);
      expect(
        report.diagnostics.map((item) => [item.ruleId, item.file, item.location.line]),
      ).toEqual([['DQ002', 'docs/handoff.md', 7]]);
      expect(JSON.parse(report.reports.json)).toMatchObject({
        failed: true,
        summary: { warnings: 1, files: 2 },
      });
      expect(report.reports.sarif).toContain('startLine');
      expect(report.reports.html).toContain('docs/handoff.md:7');
      const file = project.documents[1];
      if (!file) throw new Error('Fixture missing');
      file.text = file.text.replace('### Restore', '## Restore');
      const fixed = await analyzeProject(project, path.join(repo.root, 'fixed'), now);
      expect(fixed.status).toBe('clear');
      expect(fixed.diagnostics).toEqual([]);
      expect(fixed.failed).toBe(false);
      project.policy.requiredMetadata.push('reviewed');
      const changed = await analyzeProject(
        project,
        path.join(repo.root, 'metadata'),
        now,
      );
      expect(changed.diagnostics.filter((item) => item.ruleId === 'DQ001')).toHaveLength(
        2,
      );
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
      await repo.cleanup();
    }
  });
  it('uses actual refresh and keeps excluded or removed accepted debt unexamined', async () => {
    const repo = await createTemporaryRepository();
    try {
      const project = preparedProject(),
        review = await analyzeProject(project, path.join(repo.root, 'review'), now);
      const accepted = await acceptReviewedBaseline(
        project,
        path.join(repo.root, 'accept'),
        review.reviewSha256,
        now,
      );
      expect(accepted.baseline?.entries).toHaveLength(1);
      const persistent = await analyzeProject(
        accepted,
        path.join(repo.root, 'persistent'),
        now,
      );
      expect(persistent.status).toBe('debt-review');
      expect(persistent.diagnostics[0]?.suppressed).toBe(true);
      expect(persistent.baselineReview?.entries[0]?.state).toBe('persistent');
      accepted.documents = accepted.documents.filter(
        (file) => file.path !== 'docs/handoff.md',
      );
      const missing = await analyzeProject(
        accepted,
        path.join(repo.root, 'missing'),
        now,
      );
      expect(
        missing.baselineReview?.entries.some((entry) => entry.state === 'unexamined'),
      ).toBe(true);
      const preserved = await acceptReviewedBaseline(
        accepted,
        path.join(repo.root, 'preserve'),
        missing.reviewSha256,
        now,
      );
      expect(
        preserved.baseline?.entries.some((entry) => entry.path === 'docs/handoff.md'),
      ).toBe(true);
    } finally {
      await repo.cleanup();
    }
  });
  it('refuses changed policy/expiry decisions, existing snapshot directories and empty acceptance', async () => {
    const repo = await createTemporaryRepository();
    try {
      const project = preparedProject();
      project.policy.suppressions.push({
        ruleId: 'DQ002',
        path: 'docs/handoff.md',
        rationale: 'Training exception reviewed',
        expires: '2026-11-11',
      });
      const review = await analyzeProject(project, path.join(repo.root, 'review'), now);
      await expect(
        acceptReviewedBaseline(
          project,
          path.join(repo.root, 'expired'),
          review.reviewSha256,
          new Date('2026-11-12T12:00:00Z'),
        ),
      ).rejects.toThrow(/changed since review/u);
      project.title += ' changed';
      await expect(
        acceptReviewedBaseline(
          project,
          path.join(repo.root, 'changed'),
          review.reviewSha256,
          now,
        ),
      ).rejects.toThrow(/changed since review/u);
      const existing = path.join(repo.root, 'existing');
      await mkdir(existing);
      await expect(analyzeProject(project, existing, now)).rejects.toThrow();
      for (const file of project.documents) file.selected = false;
      project.policy.suppressions = [];
      const empty = await analyzeProject(project, path.join(repo.root, 'empty'), now);
      expect(empty.status).toBe('empty-selection');
      expect(empty.summary.files).toBe(0);
      await expect(
        acceptReviewedBaseline(
          project,
          path.join(repo.root, 'empty-accept'),
          empty.reviewSha256,
          now,
        ),
      ).rejects.toThrow(/Select and review/u);
      expect(
        await readFile(path.join(repo.root, 'empty', '.docquality.json'), 'utf8'),
      ).toContain('native-empty-selection.no-docs');
    } finally {
      await repo.cleanup();
    }
  });
});
