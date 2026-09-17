/**
 * @file Reporter unit tests.
 * @description Validates console, JSON, SARIF, HTML escaping, and report file generation.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseConfiguration } from '../../src/config.js';
import { createDiagnostic } from '../../src/diagnostics.js';
import type { ScanResult } from '../../src/model.js';
import {
  createHtmlReport,
  createJsonReport,
  createSarifReport,
  renderConsole,
  writeReports,
} from '../../src/reporters.js';
import { createTemporaryRepository } from '../helpers.js';

describe('reporters', () => {
  it('creates safe human and machine reports', async () => {
    const repository = await createTemporaryRepository();
    try {
      const diagnostic = createDiagnostic({
        ruleId: 'DQ004',
        severity: 'error',
        message: '<script>alert(1)</script>',
        remediation: 'Add useful alt text.',
        file: 'docs/guide.md',
        location: { line: 3, column: 2, endLine: 3, endColumn: 8 },
      });
      const result: ScanResult = {
        rootDirectory: repository.root,
        configuration: parseConfiguration({}),
        documents: [],
        diagnostics: [diagnostic],
        summary: {
          files: 1,
          errors: 1,
          warnings: 0,
          notices: 0,
          suppressed: 0,
          durationMs: 2,
        },
        failed: true,
      };
      expect(renderConsole(result)).toContain('docs/guide.md:3:2 error DQ004');
      expect(createJsonReport(result)).toMatchObject({ schemaVersion: 1, failed: true });
      expect(JSON.stringify(createSarifReport(result))).toContain(
        'primaryLocationLineHash',
      );
      const html = createHtmlReport(result);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
      const paths = await writeReports(result, 'reports');
      expect(JSON.parse(await readFile(paths.json, 'utf8'))).toMatchObject({
        failed: true,
      });
      expect(await readFile(paths.sarif, 'utf8')).toContain('2.1.0');
      expect(await readFile(paths.html, 'utf8')).toContain('<main>');
    } finally {
      await repository.cleanup();
    }
  });
});
