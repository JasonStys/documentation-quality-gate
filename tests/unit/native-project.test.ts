/**
 * @file Independent native-corpus contract and exact-source navigation checks.
 * @description Tests real model/configuration APIs with invalid paths, byte budgets, inert assets and stale decisions.
 * @remarks No filesystem, network, execution engine or user profile is replaced or accessed.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { describe, expect, it } from 'vitest';
import { createDiagnostic } from '../../src/diagnostics.js';
import {
  diagnosticSource,
  effectiveConfiguration,
  parseNativeProject,
  portableName,
  preparedProject,
  projectFiles,
  projectFingerprint,
  serializeNativeProject,
  MAX_PROJECT_BYTES,
} from '../../src/workbench/project.js';

describe('native documentation corpus', () => {
  it('round trips a complete editable corpus and materializes only fixed offline configuration', () => {
    const project = preparedProject(),
      text = serializeNativeProject(project);
    expect(parseNativeProject(text)).toEqual(project);
    expect(projectFingerprint(project)).toMatch(/^[a-f0-9]{64}$/u);
    const files = projectFiles(project),
      configuration = effectiveConfiguration(project);
    expect([...files.keys()]).toEqual([
      'README.md',
      'docs/handoff.md',
      '.docquality.json',
    ]);
    expect(configuration.include).toEqual(['README.md', 'docs/handoff.md']);
    expect(configuration.externalLinks.enabled).toBe(false);
    expect(configuration.baselineFile).toBe('.docquality-baseline.json');
  });
  for (const name of [
    '../outside.md',
    'a/../b.md',
    '/root.md',
    'C:/root.md',
    '\\\\host\\share.md',
    'a\\b.md',
    'a:stream.md',
    'NUL.md',
    'docs/COM1.txt',
    'a./b.md',
    'a//b.md',
    '%2e%2e/file.md',
  ])
    it(`rejects unsafe logical name ${name}`, () =>
      expect(portableName(name)).toBe(false));
  it('supports ordinary dot/underscore documentation without exposing generated configuration names', () => {
    expect(portableName('.github/_index.md')).toBe(true);
    const project = preparedProject();
    expect(() =>
      parseNativeProject(
        JSON.stringify({
          ...project,
          attachments: [{ path: '.docquality.json', base64: '' }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseNativeProject(
        JSON.stringify({
          ...project,
          documents: [
            { path: 'docs.md', text: 'x', selected: true },
            { path: 'docs.md/nested.md', text: 'x', selected: true },
          ],
        }),
      ),
    ).toThrow();
  });
  it('rejects unknown fields, nonboolean selection, duplicate names and binary extensions', () => {
    const project = preparedProject();
    for (const value of [
      { ...project, endpoint: 'https://example.invalid' },
      { ...project, documents: [{ ...project.documents[0], selected: 1 }] },
      {
        ...project,
        documents: [...project.documents, { ...project.documents[0], path: 'readme.MD' }],
      },
      { ...project, attachments: [{ path: 'tool.exe', base64: 'YWJj' }] },
    ])
      expect(() => parseNativeProject(JSON.stringify(value))).toThrow();
  });
  it('rejects repeated JSON keys, excessive structural depth and complete-project byte overflow', () => {
    expect(() => parseNativeProject('{"schema":1,"schema":1}')).toThrow(/repeated keys/u);
    expect(() => parseNativeProject('['.repeat(33) + '0' + ']'.repeat(33))).toThrow(
      /nesting/u,
    );
    expect(() => parseNativeProject(' '.repeat(MAX_PROJECT_BYTES + 1))).toThrow(
      /16 MiB/u,
    );
  });
  it('validates document Unicode and both per-file and complete-corpus actual UTF8 bytes', () => {
    const project = preparedProject();
    for (const text of ['\0', '\ud800', '😀'.repeat(262145)])
      expect(() =>
        parseNativeProject(
          JSON.stringify({
            ...project,
            documents: [{ path: 'guide.md', text, selected: true }],
          }),
        ),
      ).toThrow();
    const documents = Array.from({ length: 9 }, (_, i) => ({
      path: `guide-${i}.md`,
      text: 'x'.repeat(1024 * 1024),
      selected: true,
    }));
    expect(() => parseNativeProject(JSON.stringify({ ...project, documents }))).toThrow(
      /corpus budget/u,
    );
  });
  it('keeps attachments inert and canonical, with explicit aggregate byte limits', () => {
    const project = preparedProject();
    const valid = parseNativeProject(
      JSON.stringify({
        ...project,
        attachments: [{ path: 'assets/example.svg', base64: 'YWJj' }],
      }),
    );
    expect(projectFiles(valid).get('assets/example.svg')).toEqual(Buffer.from('abc'));
    for (const base64 of ['YWJj!', 'YQ', 'YQ===='])
      expect(() =>
        parseNativeProject(
          JSON.stringify({ ...project, attachments: [{ path: 'asset.txt', base64 }] }),
        ),
      ).toThrow();
    const attachments = Array.from({ length: 3 }, (_, i) => ({
      path: `asset-${i}.txt`,
      base64: Buffer.alloc(1024 * 1024, 0x61).toString('base64'),
    }));
    expect(() => parseNativeProject(JSON.stringify({ ...project, attachments }))).toThrow(
      /corpus budget/u,
    );
  });
  it('represents no selection as no source documents rather than silently selecting everything', () => {
    const project = preparedProject();
    for (const document of project.documents) document.selected = false;
    const actual = effectiveConfiguration(project);
    expect(actual.include).toEqual(['native-empty-selection.no-docs']);
    expect(actual.exclude).toEqual([]);
  });
  it('keeps imported missing-file baseline debt and refuses duplicate fingerprints', () => {
    const project = preparedProject(),
      entry = {
        fingerprint: 'a'.repeat(64),
        ruleId: 'DQ001',
        path: 'removed.md',
        line: 1,
      };
    const baseline = {
      version: 1,
      generatedAt: '2026-11-11T12:00:00Z',
      entries: [entry],
    };
    const actual = parseNativeProject(JSON.stringify({ ...project, baseline }));
    expect(projectFiles(actual).get('.docquality-baseline.json')).toContain('removed.md');
    expect(() =>
      parseNativeProject(
        JSON.stringify({
          ...project,
          baseline: { ...baseline, entries: [entry, entry] },
        }),
      ),
    ).toThrow(/unique/u);
  });
  it('navigates exact content and refuses stale or out-of-range locations without guessing', () => {
    const project = preparedProject(),
      fingerprint = projectFingerprint(project);
    const diagnostic = createDiagnostic({
      ruleId: 'DQ002',
      severity: 'warning',
      message: 'Heading order',
      remediation: 'Use H2',
      file: 'docs/handoff.md',
      location: { line: 7, column: 1 },
    });
    expect(diagnosticSource(project, fingerprint, diagnostic)?.text.split('\n')[6]).toBe(
      '### Restore checks',
    );
    expect(
      diagnosticSource(project, fingerprint, { ...diagnostic, file: 'absent.md' }),
    ).toBeNull();
    expect(() =>
      diagnosticSource(project, fingerprint, {
        ...diagnostic,
        location: { line: 100, column: 1 },
      }),
    ).toThrow(/extent/u);
    const current = project.documents[1];
    if (!current) throw new Error('Fixture missing');
    current.text += 'Changed evidence\n';
    expect(() => diagnosticSource(project, fingerprint, diagnostic)).toThrow(/stale/u);
  });
});
