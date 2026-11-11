/**
 * @file Bounded editable documentation corpus for the genuine offline quality engine.
 * @description Owns portable logical names, inert attachments, explicit file selection, policy and retained baseline data.
 * @remarks No endpoint, executable, repository path or Git revision is part of this native project contract.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { parseConfiguration } from '../config.js';
import type { Diagnostic, QualityConfiguration } from '../model.js';

export const MAX_PROJECT_BYTES = 16 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 1024 * 1024;
const BASELINE_NAME = '.docquality-baseline.json';
const CONFIG_NAME = '.docquality.json';
const EMPTY_SELECTION = 'native-empty-selection.no-docs';
const RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

/** Native names are inert relative identifiers, with Windows aliases/devices refused before materialization. */
export function portableName(value: string): boolean {
  return (
    value.length <= 512 &&
    /^(?:[a-z0-9_.-]{1,64}\/){0,7}[a-z0-9_.-]{1,128}$/iu.test(value) &&
    value
      .split('/')
      .every(
        (part) =>
          part !== '.' && part !== '..' && !part.endsWith('.') && !RESERVED.test(part),
      )
  );
}

const name = z
  .string()
  .refine(
    portableName,
    'Use a portable relative name with ordinary ASCII path segments.',
  );
const documentName = name.refine(
  (value) => /\.(?:md|html?)$/iu.test(value),
  'Document must be Markdown or HTML.',
);
const document = z
  .object({
    path: documentName,
    text: z
      .string()
      .max(MAX_DOCUMENT_BYTES)
      .refine(
        (value) =>
          value.isWellFormed() &&
          !value.includes('\0') &&
          Buffer.byteLength(value, 'utf8') <= MAX_DOCUMENT_BYTES,
        'Document must be valid Unicode without NUL and at most 1 MiB.',
      ),
    selected: z.boolean().default(true),
  })
  .strict();
const attachment = z
  .object({
    path: name.refine(
      (value) => /\.(?:png|jpe?g|svg|txt|json|csv|ya?ml)$/iu.test(value),
      'Unsupported inert attachment extension.',
    ),
    base64: z
      .string()
      .max(1_398_104)
      .refine(
        (value) =>
          Buffer.from(value, 'base64').toString('base64') === value &&
          Buffer.from(value, 'base64').length <= MAX_DOCUMENT_BYTES,
        'Attachment must be canonical bounded base64.',
      ),
  })
  .strict();
const exception = z
  .object({
    ruleId: z.string().regex(/^DQ\d{3}$/u),
    path: documentName.optional(),
    line: z.number().int().min(1).max(1_000_000).optional(),
    rationale: z.string().trim().min(8).max(1000),
    expires: z.iso.date().optional(),
  })
  .strict();
const baselineEntry = z
  .object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    ruleId: z.string().regex(/^DQ\d{3}$/u),
    path: documentName,
    line: z.number().int().min(1).max(1_000_000),
  })
  .strict();
const schema = z
  .object({
    schema: z.literal(1),
    title: z.string().trim().min(1).max(100),
    documents: z.array(document).min(1).max(64),
    attachments: z.array(attachment).max(16).default([]),
    policy: z
      .object({
        failOn: z.enum(['error', 'warning', 'notice', 'none']).default('error'),
        requiredMetadata: z
          .array(z.string().regex(/^[a-z_][a-z0-9_-]{0,63}$/iu))
          .max(32)
          .default(['title']),
        suppressions: z.array(exception).max(64).default([]),
      })
      .strict(),
    baseline: z
      .object({
        version: z.literal(1),
        generatedAt: z.iso.datetime({ offset: true }),
        entries: z.array(baselineEntry).max(10_000),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((project, context) => {
    const paths = new Set<string>([CONFIG_NAME, BASELINE_NAME]);
    for (const file of [...project.documents, ...project.attachments]) {
      const key = file.path.toLowerCase();
      if (paths.has(key))
        context.addIssue({
          code: 'custom',
          message: 'Logical filenames must be unique ignoring case.',
        });
      paths.add(key);
    }
    for (const file of [...project.documents, ...project.attachments]) {
      const parts = file.path.toLowerCase().split('/');
      for (let end = 1; end < parts.length; end++)
        if (paths.has(parts.slice(0, end).join('/')))
          context.addIssue({
            code: 'custom',
            message: "A logical file cannot also be another file's directory.",
          });
    }
    if (
      project.documents.reduce(
        (total, file) => total + Buffer.byteLength(file.text, 'utf8'),
        0,
      ) >
      8 * 1024 * 1024
    )
      context.addIssue({
        code: 'custom',
        message: 'Document text exceeds the 8 MiB corpus budget.',
      });
    if (
      project.attachments.reduce(
        (total, file) => total + Buffer.from(file.base64, 'base64').length,
        0,
      ) >
      2 * 1024 * 1024
    )
      context.addIssue({
        code: 'custom',
        message: 'Inert attachments exceed the 2 MiB corpus budget.',
      });
    if (
      new Set(project.policy.requiredMetadata).size !==
      project.policy.requiredMetadata.length
    )
      context.addIssue({
        code: 'custom',
        message: 'Required metadata names must be unique.',
      });
    const entries = project.baseline?.entries ?? [];
    if (new Set(entries.map((entry) => entry.fingerprint)).size !== entries.length)
      context.addIssue({
        code: 'custom',
        message: 'Baseline fingerprints must be unique.',
      });
  });
export type NativeProject = z.infer<typeof schema>;

/** Bound nesting/structural work before either parser; braces inside strings remain ordinary authored text. */
function jsonBudget(source: string): void {
  if (
    source.length > MAX_PROJECT_BYTES ||
    Buffer.byteLength(source, 'utf8') > MAX_PROJECT_BYTES
  )
    throw new Error('Native project exceeds 16 MiB.');
  let quoted = false,
    escaped = false,
    depth = 0,
    structures = 0;
  for (const character of source) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{' || character === '[') {
      if (++depth > 32 || ++structures > 100_000)
        throw new Error('Project JSON exceeds its nesting/node budget.');
    } else if (character === '}' || character === ']') depth--;
  }
}

/** Parse data only; JSON syntax and repeated keys are both rejected before a saved project can change. */
export function parseNativeProject(source: string): NativeProject {
  jsonBudget(source);
  const value: unknown = JSON.parse(source);
  if (parseDocument(source, { uniqueKeys: true, prettyErrors: false }).errors.length)
    throw new Error('Project JSON contains repeated keys or invalid Unicode.');
  return schema.parse(value);
}

/** Store/export one constant explicit shape, without dropping invalid input or overwriting existing author files. */
export function serializeNativeProject(project: NativeProject): string {
  const serialized = JSON.stringify(project, null, 2) + '\n';
  return JSON.stringify(parseNativeProject(serialized), null, 2) + '\n';
}

/** Revision identity includes text, selections, policy, inert bytes and retained debt; it is not a signature. */
export function projectFingerprint(project: NativeProject): string {
  return createHash('sha256')
    .update(serializeNativeProject(project), 'utf8')
    .digest('hex');
}

/** Exact safe selected names replace filesystem globs; excluded/removed debt remains unexamined in the original engine. */
export function effectiveConfiguration(project: NativeProject): QualityConfiguration {
  const selected = project.documents
    .filter((file) => file.selected)
    .map((file) => file.path);
  return parseConfiguration({
    ...project.policy,
    include: selected.length ? selected : [EMPTY_SELECTION],
    exclude: [],
    baselineFile: BASELINE_NAME,
    externalLinks: { enabled: false },
  });
}

/** Materialize only bounded project data inside a separately owned snapshot; no host source directory is an input. */
export function projectFiles(
  project: NativeProject,
): ReadonlyMap<string, string | Buffer> {
  const files = new Map<string, string | Buffer>(
    project.documents.map((file) => [file.path, file.text]),
  );
  for (const asset of project.attachments)
    files.set(asset.path, Buffer.from(asset.base64, 'base64'));
  files.set(CONFIG_NAME, JSON.stringify(effectiveConfiguration(project), null, 2) + '\n');
  if (project.baseline)
    files.set(BASELINE_NAME, JSON.stringify(project.baseline, null, 2) + '\n');
  return files;
}

/** Exact source navigation refuses stale editor/policy revisions; policy findings retain their generated source context. */
export function diagnosticSource(
  project: NativeProject,
  analyzedFingerprint: string,
  diagnostic: Diagnostic,
): { text: string; line: number; column: number } | null {
  if (projectFingerprint(project) !== analyzedFingerprint)
    throw new Error('This result is stale; analyze the applied project again.');
  const text = projectFiles(project).get(diagnostic.file);
  if (typeof text !== 'string') return null;
  if (
    !Number.isSafeInteger(diagnostic.location.line) ||
    diagnostic.location.line < 1 ||
    !Number.isSafeInteger(diagnostic.location.column) ||
    diagnostic.location.column < 1
  )
    throw new Error('Diagnostic location is not valid.');
  const line = text.split(/\r?\n/u)[diagnostic.location.line - 1];
  if (line === undefined || diagnostic.location.column > line.length + 1)
    throw new Error('Diagnostic is outside the current source extent.');
  return { text, line: diagnostic.location.line, column: diagnostic.location.column };
}

/** Prepared material is data inside the full editor; both documents and policy remain editable. */
export function preparedProject(): NativeProject {
  return parseNativeProject(
    JSON.stringify({
      schema: 1,
      title: 'Service recovery documentation review',
      documents: [
        {
          path: 'README.md',
          selected: true,
          text: '---\ntitle: Recovery runbook\nowner: Operations training\nversion: 1.0.0\n---\n# Recovery runbook\n\nSee the [handoff procedure](docs/handoff.md).\n\n```json\n{"batch":4,"mode":"synthetic"}\n```\n',
        },
        {
          path: 'docs/handoff.md',
          selected: true,
          text: '---\ntitle: Shift handoff\nowner: Operations training\n---\n# Shift handoff\n\n### Restore checks\n\nVerify the accepted batch and retain the audit receipt.\n',
        },
      ],
      attachments: [],
      policy: {
        failOn: 'warning',
        requiredMetadata: ['title', 'owner'],
        suppressions: [],
      },
      baseline: null,
    }),
  );
}
