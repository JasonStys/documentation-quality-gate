/**
 * @file Built-in rule unit tests.
 * @description Covers positive, negative, edge, and cross-file cases for high-signal diagnostics.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfiguration } from '../../src/config.js';
import { parseHtmlDocument } from '../../src/parsers/html.js';
import { parseMarkdownDocument } from '../../src/parsers/markdown.js';
import { evaluateRules } from '../../src/rules.js';
import { createTemporaryRepository } from '../helpers.js';

describe('built-in rules', () => {
  it('accepts a complete Markdown document and its target', async () => {
    const repository = await createTemporaryRepository();
    try {
      const guidePath = path.join(repository.root, 'guide.md');
      const detailsPath = path.join(repository.root, 'details.md');
      await repository.write('guide.md', 'placeholder');
      await repository.write('details.md', 'placeholder');
      const guide = parseMarkdownDocument(
        guidePath,
        'guide.md',
        `---
title: Guide
id: guide
version: 1.0.0
---
# Guide
## Setup
[Limits](details.md#limits)
| Name |
| --- |
| Value |
\`\`\`json
{"ok":true}
\`\`\`
> [!WARNING]
> Condition: Live voltage.
> Consequence: Electric shock.
> Avoidance: Disconnect power.
`,
      );
      const details = parseMarkdownDocument(
        detailsPath,
        'details.md',
        `---
title: Limits
id: limits
version: 1.0.0
---
# Limits
`,
      );
      const diagnostics = await evaluateRules(
        repository.root,
        [guide, details],
        parseConfiguration({ requiredMetadata: ['title', 'id', 'version'] }),
      );
      expect(diagnostics).toEqual([]);
    } finally {
      await repository.cleanup();
    }
  });

  it('finds structural, content, link, code, warning, and identity failures', async () => {
    const repository = await createTemporaryRepository();
    try {
      const source = `---
id: duplicate
version: release-one
---
# Repeated
### Skipped
# Repeated
![](missing.png)
[Missing](no-file.md#absent)
[Unsafe](javascript:alert(1))
[Plain](http://example.com)
|  |
| --- |
| value |
\`\`\`
no language
\`\`\`
\`\`\`json
{broken}
\`\`\`
> [!WARNING]
> Condition: Pressure exists.
`;
      const first = parseMarkdownDocument(
        path.join(repository.root, 'first.md'),
        'first.md',
        source,
      );
      const second = parseMarkdownDocument(
        path.join(repository.root, 'second.md'),
        'second.md',
        `---\ntitle: Other\nid: duplicate\nversion: 1.0.0\n---\n# Other\n`,
      );
      const diagnostics = await evaluateRules(
        repository.root,
        [first, second],
        parseConfiguration({ requiredMetadata: ['title', 'id', 'version'] }),
      );
      const ids = new Set(diagnostics.map((diagnostic) => diagnostic.ruleId));
      expect(ids).toEqual(
        new Set([
          'DQ001',
          'DQ002',
          'DQ003',
          'DQ004',
          'DQ005',
          'DQ006',
          'DQ007',
          'DQ008',
          'DQ009',
          'DQ011',
        ]),
      );
      expect(diagnostics.filter((item) => item.ruleId === 'DQ011')).toHaveLength(3);
    } finally {
      await repository.cleanup();
    }
  });

  it('finds HTML landmark, language, title, and duplicate-id failures', async () => {
    const document = parseHtmlDocument(
      '/repo/index.html',
      'index.html',
      '<html><body><h1 id="same">One</h1><h2 id="same">Two</h2><main></main><main></main></body></html>',
    );
    const diagnostics = await evaluateRules(
      '/repo',
      [document],
      parseConfiguration({ requiredMetadata: [] }),
    );
    expect(diagnostics.filter((item) => item.ruleId === 'DQ010')).toHaveLength(5);
  });
});
