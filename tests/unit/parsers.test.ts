/**
 * @file Parser unit tests.
 * @description Exercises Markdown, GFM, front matter, HTML structure, and source locations.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { describe, expect, it } from 'vitest';
import { parseHtmlDocument } from '../../src/parsers/html.js';
import { headingSlug, parseMarkdownDocument } from '../../src/parsers/markdown.js';

describe('document parsers', () => {
  it('normalizes Unicode-aware heading slugs', () => {
    expect(headingSlug('  Safe & Fast: Café  ')).toBe('safe-fast-café');
  });

  it('extracts Markdown facts with positions', () => {
    const source = `---
title: Pump guide
id: pump-guide
version: 1.0.0
---
# Pump guide
## Setup
![Pump diagram](assets/pump.png)
[Details](details.md#limits)
| Name | Value |
| --- | --- |
| Flow | 4 |
\`\`\`json
{"flow":4}
\`\`\`
> [!WARNING]
> Condition: Pressure is present.
> Consequence: Fluid may escape.
> Avoidance: Isolate the line.
`;
    const document = parseMarkdownDocument('/repo/guide.md', 'guide.md', source);
    expect(document.metadata).toMatchObject({ title: 'Pump guide', version: '1.0.0' });
    expect(document.headings.map((heading) => heading.depth)).toEqual([1, 2]);
    expect(document.images[0]?.alt).toBe('Pump diagram');
    expect(document.links[0]?.target).toBe('details.md#limits');
    expect(document.tables[0]?.headerCells).toEqual(['Name', 'Value']);
    expect(document.codeBlocks[0]?.language).toBe('json');
    expect(document.warnings[0]?.fields).toEqual(
      new Set(['condition', 'consequence', 'avoidance']),
    );
    expect(document.headings[0]?.location.line).toBeGreaterThan(1);
  });

  it('extracts HTML accessibility and duplicate-id facts', () => {
    const source = `<!doctype html><html lang="en"><head><title>Status</title></head><body>
<main><h1 id="state">State</h1><h2 id="state">Details</h2>
<img src="state.png" alt="State indicator"><a href="#state">State</a>
<table><tr><th>Signal</th></tr></table><pre><code class="language-json">{"ok":true}</code></pre>
<div role="alert">Condition: Hot. Consequence: Burn. Avoidance: Cool.</div></main></body></html>`;
    const document = parseHtmlDocument('/repo/status.html', 'status.html', source);
    expect(document.html?.htmlLanguage).toBe('en');
    expect(document.html?.mainCount).toBe(1);
    expect(document.html?.duplicateIds).toHaveLength(2);
    expect(document.images[0]?.alt).toBe('State indicator');
    expect(document.codeBlocks[0]?.language).toBe('json');
    expect(document.warnings[0]?.fields.size).toBe(3);
  });
});
