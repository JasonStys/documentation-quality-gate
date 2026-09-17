/**
 * @file End-to-end scanner integration tests.
 * @description Exercises discovery, parsing, cross-file rules, governance, report writing, and failure thresholds.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { writeReports } from '../../src/reporters.js';
import { scanRepository } from '../../src/scanner.js';
import { createTemporaryRepository } from '../helpers.js';

describe('repository scanner', () => {
  it('passes a valid scoped repository and writes reports', async () => {
    const repository = await createTemporaryRepository();
    try {
      await repository.write(
        '.docquality.json',
        JSON.stringify({
          include: ['docs/**/*.md'],
          exclude: [],
          failOn: 'warning',
          requiredMetadata: ['title', 'id', 'version'],
        }),
      );
      await repository.write(
        'docs/guide.md',
        `---
title: Guide
id: guide
version: 1.0.0
---
# Guide
## Usage
[Details](details.md#details)
\`\`\`bash
doc-quality docs
\`\`\`
`,
      );
      await repository.write(
        'docs/details.md',
        `---
title: Details
id: details
version: 1.0.0
---
# Details
`,
      );
      await repository.write('ignored/note.md', '# Not selected\n');
      const result = await scanRepository({ rootDirectory: repository.root });
      expect(result.failed).toBe(false);
      expect(result.summary).toMatchObject({ files: 2, errors: 0, warnings: 0 });
      const paths = await writeReports(result, 'artifacts');
      expect(await readFile(paths.json, 'utf8')).toContain('"files": 2');
    } finally {
      await repository.cleanup();
    }
  });

  it('fails at the configured threshold and converts parse failures to diagnostics', async () => {
    const repository = await createTemporaryRepository();
    try {
      await repository.write(
        '.docquality.json',
        JSON.stringify({
          include: ['**/*.md'],
          exclude: [],
          failOn: 'warning',
          requiredMetadata: ['title'],
        }),
      );
      await repository.write('broken.md', '---\ntitle: [unterminated\n---\n# Broken\n');
      await repository.write(
        'warning.md',
        '---\ntitle: Warning\n---\n# Warning\n### Skipped\n',
      );
      const result = await scanRepository({ rootDirectory: repository.root });
      expect(result.failed).toBe(true);
      expect(result.diagnostics.some((item) => item.ruleId === 'DQ013')).toBe(true);
      expect(result.diagnostics.some((item) => item.ruleId === 'DQ002')).toBe(true);
    } finally {
      await repository.cleanup();
    }
  });
});
