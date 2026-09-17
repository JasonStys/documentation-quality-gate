/**
 * @file Governance unit tests.
 * @description Verifies exact suppressions, expiry enforcement, baseline loading, and baseline writing.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfiguration } from '../../src/config.js';
import { createDiagnostic } from '../../src/diagnostics.js';
import {
  applyGovernance,
  loadBaseline,
  writeBaselineFile,
} from '../../src/governance.js';
import type { ScanResult } from '../../src/model.js';
import { createTemporaryRepository } from '../helpers.js';

const finding = createDiagnostic({
  ruleId: 'DQ004',
  severity: 'error',
  message: 'Image is missing alternative text.',
  remediation: 'Add alternative text.',
  file: 'docs/guide.md',
  location: { line: 8, column: 1 },
});

describe('governance', () => {
  it('applies a live suppression and rejects an expired one', async () => {
    const repository = await createTemporaryRepository();
    try {
      const configuration = parseConfiguration({
        suppressions: [
          {
            ruleId: 'DQ004',
            path: 'docs/**',
            rationale: 'Legacy diagram replacement is scheduled.',
            expires: '2027-01-01',
          },
          {
            ruleId: 'DQ005',
            rationale: 'Temporary migration exception.',
            expires: '2025-01-01',
          },
        ],
      });
      const diagnostics = await applyGovernance(
        repository.root,
        [finding],
        configuration,
        new Date('2026-09-16T12:00:00Z'),
      );
      expect(diagnostics[0]).toMatchObject({ suppressed: true });
      expect(diagnostics[1]).toMatchObject({ ruleId: 'DQ000', suppressed: false });
    } finally {
      await repository.cleanup();
    }
  });

  it('writes and reloads a stable baseline', async () => {
    const repository = await createTemporaryRepository();
    try {
      const configuration = parseConfiguration({});
      const result: ScanResult = {
        rootDirectory: repository.root,
        configuration,
        documents: [],
        diagnostics: [finding],
        summary: {
          files: 0,
          errors: 1,
          warnings: 0,
          notices: 0,
          suppressed: 0,
          durationMs: 1,
        },
        failed: true,
      };
      const baselinePath = await writeBaselineFile(result);
      const source = await readFile(baselinePath, 'utf8');
      expect(source).toContain(finding.fingerprint);
      const fingerprints = await loadBaseline(
        repository.root,
        configuration.baselineFile,
      );
      expect(fingerprints.has(finding.fingerprint)).toBe(true);
      const governed = await applyGovernance(repository.root, [finding], configuration);
      expect(governed[0]).toMatchObject({
        suppressed: true,
        suppressionReason: 'baseline',
      });
    } finally {
      await repository.cleanup();
    }
  });

  it('rejects a malformed baseline', async () => {
    const repository = await createTemporaryRepository();
    try {
      await repository.write('.docquality-baseline.json', '{}');
      await expect(
        loadBaseline(repository.root, '.docquality-baseline.json'),
      ).rejects.toThrow(/unable to load baseline/i);
      expect(path.isAbsolute(repository.root)).toBe(true);
    } finally {
      await repository.cleanup();
    }
  });
});
