/**
 * @file Prove configured metadata must be authored evidence rather than inherited JavaScript properties.
 * @description Real Markdown parsing and rule evaluation distinguish absent and explicitly provided prototype-like names.
 * @remarks Tests use synthetic temporary documents and the original core engine, not replacement rules.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfiguration } from '../../src/config.js';
import { parseMarkdownDocument } from '../../src/parsers/markdown.js';
import { evaluateRules } from '../../src/rules.js';
import { createTemporaryRepository } from '../helpers.js';

describe('authored metadata ownership', () => {
  const keys = ['constructor', 'toString', 'valueOf', '__proto__'];
  it('reports every absent field even when Object.prototype supplies a value', async () => {
    const repo = await createTemporaryRepository();
    try {
      const text = '---\ntitle: Authored guide\n---\n# Guide\n';
      await repo.write('guide.md', text);
      const document = parseMarkdownDocument(
        path.join(repo.root, 'guide.md'),
        'guide.md',
        text,
      );
      const result = await evaluateRules(
        repo.root,
        [document],
        parseConfiguration({ requiredMetadata: keys }),
      );
      expect(
        result
          .filter((item) => item.ruleId === 'DQ001')
          .map((item) => item.message)
          .sort(),
      ).toEqual(
        keys.map((key) => 'Required metadata field is missing or empty: ' + key).sort(),
      );
    } finally {
      await repo.cleanup();
    }
  });
  it('accepts explicitly authored own fields without blanket reserved-name exclusions', async () => {
    const repo = await createTemporaryRepository();
    try {
      const text =
        '---\nconstructor: Manufacturing QA\ntoString: Shift lead\nvalueOf: Accepted evidence\n__proto__: Literal metadata\n---\n# Guide\n';
      await repo.write('guide.md', text);
      const document = parseMarkdownDocument(
        path.join(repo.root, 'guide.md'),
        'guide.md',
        text,
      );
      expect(keys.every((key) => Object.hasOwn(document.metadata, key))).toBe(true);
      const result = await evaluateRules(
        repo.root,
        [document],
        parseConfiguration({ requiredMetadata: keys }),
      );
      expect(result.filter((item) => item.ruleId === 'DQ001')).toEqual([]);
    } finally {
      await repo.cleanup();
    }
  });
});
