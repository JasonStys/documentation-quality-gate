/**
 * @file Configuration unit tests.
 * @description Verifies defaults, strict validation, and filesystem loading behavior.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { describe, expect, it } from 'vitest';
import { loadConfiguration, parseConfiguration } from '../../src/config.js';
import { createTemporaryRepository } from '../helpers.js';

describe('configuration', () => {
  it('bounds glob length, nesting and pattern count before discovery', () => {
    expect(() => parseConfiguration({ include: ['a'.repeat(4097)] })).toThrow();
    expect(() =>
      parseConfiguration({ include: ['{'.repeat(33) + 'a' + '}'.repeat(33)] }),
    ).toThrow(/nesting/i);
    expect(() =>
      parseConfiguration({ exclude: Array.from({ length: 129 }, () => '*.md') }),
    ).toThrow();
    expect(parseConfiguration({ include: ['**/*.{md,html}'] }).include).toEqual([
      '**/*.{md,html}',
    ]);
  });
  it('applies secure defaults', () => {
    const configuration = parseConfiguration({});
    expect(configuration.failOn).toBe('error');
    expect(configuration.externalLinks.enabled).toBe(false);
    expect(configuration.externalLinks.allowPrivateHosts).toBe(false);
    expect(configuration.requiredMetadata).toEqual(['title']);
  });

  it('accepts an expiring, justified suppression', () => {
    const configuration = parseConfiguration({
      suppressions: [
        {
          ruleId: 'DQ004',
          path: 'legacy/**',
          rationale: 'Migration approved by the documentation owner.',
          expires: '2027-01-01',
        },
      ],
    });
    expect(configuration.suppressions[0]?.expires).toBe('2027-01-01');
  });

  it('rejects unknown keys and unjustified suppressions', () => {
    expect(() => parseConfiguration({ unexpected: true })).toThrow(/unrecognized key/i);
    expect(() =>
      parseConfiguration({ suppressions: [{ ruleId: 'DQ004', rationale: 'short' }] }),
    ).toThrow(/rationale/i);
  });

  it('loads a file and falls back when the file is absent', async () => {
    const repository = await createTemporaryRepository();
    try {
      const fallback = await loadConfiguration(repository.root);
      expect(fallback.include).toContain('**/*.{md,html}');
      await repository.write('.docquality.json', '{"failOn":"warning"}\n');
      const loaded = await loadConfiguration(repository.root);
      expect(loaded.failOn).toBe('warning');
    } finally {
      await repository.cleanup();
    }
  });

  it('reports malformed JSON', async () => {
    const repository = await createTemporaryRepository();
    try {
      await repository.write('.docquality.json', '{');
      await expect(loadConfiguration(repository.root)).rejects.toThrow(/not valid JSON/i);
    } finally {
      await repository.cleanup();
    }
  });

  it('treats source-like values as data, not schema or code', () => {
    const configuration = parseConfiguration({
      requiredMetadata: ['"; throw new Error("not executable"); //'],
    });
    expect(configuration.requiredMetadata).toEqual([
      '"; throw new Error("not executable"); //',
    ]);
    expect(() =>
      parseConfiguration({ '"; throw new Error("unexpected"); //': true }),
    ).toThrow(/unrecognized key/i);
  });
});
