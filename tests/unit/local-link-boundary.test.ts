/**
 * @file Real local-link boundary regressions for untrusted documentation content.
 * @description An existing outside fixture must not turn a repository-escaping link into accepted evidence.
 * @remarks No remote host is contacted; every path is inside one synthetic temporary fixture owner.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { parseConfiguration } from '../../src/config.js';
import { parseMarkdownDocument } from '../../src/parsers/markdown.js';
import { evaluateRules, repositoryLinkTarget } from '../../src/rules.js';
import { createTemporaryRepository } from '../helpers.js';

it('refuses both literal and percent-encoded escapes even when an outside target really exists', async () => {
  const repo = await createTemporaryRepository();
  try {
    const root = path.join(repo.root, 'corpus');
    await mkdir(root);
    await writeFile(path.join(repo.root, 'outside.txt'), 'owned inert outside fixture');
    const text =
      '---\ntitle: Boundary\n---\n# Boundary\n[Literal](../outside.txt)\n[Encoded](%2e%2e/outside.txt)\n';
    const file = path.join(root, 'guide.md');
    await writeFile(file, text);
    const result = await evaluateRules(
      root,
      [parseMarkdownDocument(file, 'guide.md', text)],
      parseConfiguration({}),
    );
    expect(
      result.filter((item) => item.ruleId === 'DQ005').map((item) => item.location.line),
    ).toEqual([5, 6]);
  } finally {
    await repo.cleanup();
  }
});

it('rejects absolute, encoded UNC, device, drive and escaped URL paths without probing them', () => {
  const root = path.resolve('synthetic-corpus');
  for (const target of [
    '../outside',
    '%2e%2e/outside',
    '/outside',
    '//invalid.example/share',
    '%2f%2finvalid.example/share',
    'C:/outside',
    'C:relative',
    '%43%3a/outside',
    '%5c%5cinvalid.example%5cshare',
    'file:/outside',
    '%00file',
  ])
    expect(repositoryLinkTarget(root, root, target), target).toBeNull();
  expect(repositoryLinkTarget(root, path.join(root, 'docs'), '../LICENSE')).toBe(
    'LICENSE',
  );
  expect(repositoryLinkTarget(root, root, 'docs/a%20b.md')).toBe('docs/a b.md');
});

it('accepts an in-root parent asset but refuses a real directory alias without changing its outside target', async () => {
  const repo = await createTemporaryRepository();
  try {
    const root = path.join(repo.root, 'corpus');
    const outside = path.join(repo.root, 'outside');
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(root, 'LICENSE'), 'owned allowed');
    await writeFile(path.join(outside, 'data.txt'), 'owned outside sentinel');
    await symlink(
      outside,
      path.join(root, 'alias'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const text =
      '---\ntitle: Paths\n---\n# Paths\n[Allowed](../LICENSE)\n[Alias](../alias/data.txt)\n';
    const file = path.join(root, 'docs/guide.md');
    await writeFile(file, text);
    const result = await evaluateRules(
      root,
      [parseMarkdownDocument(file, 'docs/guide.md', text)],
      parseConfiguration({}),
    );
    expect(
      result.filter((item) => item.ruleId === 'DQ005').map((item) => item.location.line),
    ).toEqual([6]);
  } finally {
    await repo.cleanup();
  }
});
