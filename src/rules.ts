/**
 * @file Built-in documentation rules.
 * @description Evaluates metadata, structure, links, accessibility, examples, warnings, and identifiers.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createDiagnostic } from './diagnostics.js';
import type {
  Diagnostic,
  DocumentFacts,
  QualityConfiguration,
  SourceLocation,
} from './model.js';

export interface RuleDefinition {
  readonly id: string;
  readonly title: string;
  readonly defaultSeverity: 'error' | 'warning' | 'notice';
  readonly description: string;
}

export const RULES: readonly RuleDefinition[] = [
  {
    id: 'DQ001',
    title: 'Required metadata',
    defaultSeverity: 'error',
    description: 'Required front-matter fields must be present and non-empty.',
  },
  {
    id: 'DQ002',
    title: 'Heading order',
    defaultSeverity: 'warning',
    description: 'Heading levels must not skip a level.',
  },
  {
    id: 'DQ003',
    title: 'Unique headings',
    defaultSeverity: 'warning',
    description: 'A document must not produce duplicate heading anchors.',
  },
  {
    id: 'DQ004',
    title: 'Image alternatives',
    defaultSeverity: 'error',
    description: 'Images require meaningful alternative text.',
  },
  {
    id: 'DQ005',
    title: 'Local link targets',
    defaultSeverity: 'error',
    description: 'Relative files and anchors must resolve.',
  },
  {
    id: 'DQ006',
    title: 'Safe link schemes',
    defaultSeverity: 'error',
    description: 'Links must use approved schemes and public HTTP links should use TLS.',
  },
  {
    id: 'DQ007',
    title: 'Table headers',
    defaultSeverity: 'warning',
    description: 'Tables require non-empty header cells.',
  },
  {
    id: 'DQ008',
    title: 'Typed code examples',
    defaultSeverity: 'warning',
    description: 'Code blocks need a language and JSON examples must parse.',
  },
  {
    id: 'DQ009',
    title: 'Structured warnings',
    defaultSeverity: 'error',
    description: 'Warnings require condition, consequence, and avoidance fields.',
  },
  {
    id: 'DQ010',
    title: 'HTML accessibility structure',
    defaultSeverity: 'error',
    description: 'HTML pages require language, title, one main landmark, and unique IDs.',
  },
  {
    id: 'DQ011',
    title: 'Document identity and version',
    defaultSeverity: 'error',
    description: 'Document IDs must be unique and versions must be semantic versions.',
  },
  {
    id: 'DQ012',
    title: 'External link health',
    defaultSeverity: 'warning',
    description:
      'Optional bounded network checks distinguish broken and transient links.',
  },
  {
    id: 'DQ000',
    title: 'Expired suppression',
    defaultSeverity: 'error',
    description: 'Expired governance exceptions must be reviewed or removed.',
  },
  {
    id: 'DQ013',
    title: 'Parseable input',
    defaultSeverity: 'error',
    description:
      'Documentation inputs must be valid UTF-8 and parse within the size limit.',
  },
] as const;

const externalScheme = /^[a-z][a-z\d+.-]*:/i;
const semanticVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** Safely decodes a URI path while retaining the original on malformed escapes. */
function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Formats untrusted metadata values without implicit object stringification. */
function displayValue(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value === null || value === undefined) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '<non-serializable value>';
  }
}

/** Builds a diagnostic with the shared remediation language for a document. */
function documentDiagnostic(
  document: DocumentFacts,
  ruleId: string,
  severity: 'error' | 'warning' | 'notice',
  message: string,
  remediation: string,
  location: SourceLocation,
): Diagnostic {
  return createDiagnostic({
    ruleId,
    severity,
    message,
    remediation,
    file: document.relativePath,
    location,
  });
}

/** Tests whether a filesystem path exists without leaking the platform-specific error. */
async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

/** Resolves same-file and cross-document local anchors. */
async function evaluateLocalLinks(
  rootDirectory: string,
  document: DocumentFacts,
  documentsByPath: ReadonlyMap<string, DocumentFacts>,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const link of document.links) {
    const target = link.target.trim();
    if (target.length === 0) {
      diagnostics.push(
        documentDiagnostic(
          document,
          'DQ005',
          'error',
          'Link target is empty.',
          'Provide a relative path, fragment, or approved absolute URL.',
          link.location,
        ),
      );
      continue;
    }
    if (externalScheme.test(target)) {
      continue;
    }
    const [rawFile = '', rawAnchor] = target.split('#', 2);
    const normalizedFile =
      rawFile.length === 0
        ? document.relativePath
        : path
            .relative(
              rootDirectory,
              path.resolve(path.dirname(document.absolutePath), decodePath(rawFile)),
            )
            .replaceAll('\\', '/');
    const targetDocument = documentsByPath.get(normalizedFile);
    const absoluteTarget = path.resolve(rootDirectory, normalizedFile);
    if (
      rawFile.length > 0 &&
      targetDocument === undefined &&
      !(await pathExists(absoluteTarget))
    ) {
      diagnostics.push(
        documentDiagnostic(
          document,
          'DQ005',
          'error',
          `Local link target does not exist: ${rawFile}`,
          'Create the target or update the relative path and preserve filename casing.',
          link.location,
        ),
      );
      continue;
    }
    if (rawAnchor !== undefined) {
      const anchor = decodePath(rawAnchor);
      const anchors = targetDocument?.anchors ?? document.anchors;
      if (!anchors.has(anchor)) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ005',
            'error',
            `Local link anchor does not exist: #${anchor}`,
            'Use an existing heading or element ID; anchor matching is case-sensitive.',
            link.location,
          ),
        );
      }
    }
  }
  return diagnostics;
}

/** Evaluates all deterministic built-in rules except optional network checks. */
export async function evaluateRules(
  rootDirectory: string,
  documents: readonly DocumentFacts[],
  configuration: QualityConfiguration,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const documentsByPath = new Map(
    documents.map((document) => [document.relativePath, document]),
  );
  const identifiers = new Map<string, DocumentFacts[]>();

  for (const document of documents) {
    if (document.format === 'markdown') {
      for (const key of configuration.requiredMetadata) {
        const value = document.metadata[key];
        if (
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim().length === 0)
        ) {
          diagnostics.push(
            documentDiagnostic(
              document,
              'DQ001',
              'error',
              `Required metadata field is missing or empty: ${key}`,
              `Add ${key} to the YAML front matter with a non-empty value.`,
              document.metadataLocation,
            ),
          );
        }
      }
    }

    let previousDepth = 0;
    const seenSlugs = new Set<string>();
    for (const heading of document.headings) {
      if (previousDepth > 0 && heading.depth > previousDepth + 1) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ002',
            'warning',
            `Heading level jumps from H${previousDepth} to H${heading.depth}: ${heading.text}`,
            `Use H${previousDepth + 1} or add the missing structural level.`,
            heading.location,
          ),
        );
      }
      previousDepth = heading.depth;
      if (seenSlugs.has(heading.slug)) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ003',
            'warning',
            `Duplicate heading anchor: #${heading.slug}`,
            'Rename one heading so every generated anchor is unique.',
            heading.location,
          ),
        );
      }
      seenSlugs.add(heading.slug);
    }

    for (const image of document.images) {
      if (image.alt === null || image.alt.trim().length === 0) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ004',
            'error',
            `Image is missing alternative text: ${image.source || '<empty source>'}`,
            'Describe the information conveyed by the image; use an explicit decorative pattern only when appropriate.',
            image.location,
          ),
        );
      }
    }

    for (const link of document.links) {
      const target = link.target.trim();
      if (/^(?:javascript|data|file):/i.test(target)) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ006',
            'error',
            `Unsafe link scheme: ${target.split(':', 1)[0] ?? 'unknown'}`,
            'Use an HTTPS URL, mailto/tel link, or a repository-relative path.',
            link.location,
          ),
        );
      } else if (
        /^http:\/\//i.test(target) &&
        !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(target)
      ) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ006',
            'warning',
            `External link does not use HTTPS: ${target}`,
            'Use the HTTPS endpoint when the destination supports it.',
            link.location,
          ),
        );
      } else if (
        externalScheme.test(target) &&
        !/^(?:https?|mailto|tel):/i.test(target)
      ) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ006',
            'error',
            `Unsupported link scheme: ${target.split(':', 1)[0] ?? 'unknown'}`,
            'Use an HTTPS URL, mailto/tel link, or a repository-relative path.',
            link.location,
          ),
        );
      }
    }
    diagnostics.push(
      ...(await evaluateLocalLinks(rootDirectory, document, documentsByPath)),
    );

    for (const table of document.tables) {
      if (
        table.headerCells.length === 0 ||
        table.headerCells.some((cell) => cell.length === 0)
      ) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ007',
            'warning',
            'Table is missing one or more non-empty header cells.',
            'Add concise headers for every column; in HTML, use th elements.',
            table.location,
          ),
        );
      }
    }

    for (const code of document.codeBlocks) {
      if (code.language === null) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ008',
            'warning',
            'Code example has no language identifier.',
            'Add a fenced-code language such as json, bash, typescript, or cpp.',
            code.location,
          ),
        );
      } else if (code.language.toLowerCase() === 'json') {
        try {
          JSON.parse(code.value);
        } catch {
          diagnostics.push(
            documentDiagnostic(
              document,
              'DQ008',
              'error',
              'JSON code example is not valid JSON.',
              'Correct the syntax or label intentionally non-JSON content with another language.',
              code.location,
            ),
          );
        }
      }
    }

    for (const warning of document.warnings) {
      const missing = ['condition', 'consequence', 'avoidance'].filter(
        (field) => !warning.fields.has(field),
      );
      if (missing.length > 0) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ009',
            'error',
            `Warning is missing required fields: ${missing.join(', ')}`,
            'State the condition, consequence, and avoidance action explicitly.',
            warning.location,
          ),
        );
      }
    }

    if (document.html !== null) {
      if (
        document.html.htmlLanguage === null ||
        document.html.htmlLanguage.trim().length === 0
      ) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ010',
            'error',
            'HTML document has no language declaration.',
            'Add a valid lang attribute to the html element.',
            { line: 1, column: 1 },
          ),
        );
      }
      if (document.html.title === null || document.html.title.text.length === 0) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ010',
            'error',
            'HTML document has no non-empty title element.',
            'Add a concise, unique title inside head.',
            { line: 1, column: 1 },
          ),
        );
      }
      if (document.html.mainCount !== 1) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ010',
            'error',
            `HTML document must contain exactly one main landmark; found ${document.html.mainCount}.`,
            'Wrap the primary page content in one main element.',
            { line: 1, column: 1 },
          ),
        );
      }
      for (const duplicate of document.html.duplicateIds) {
        diagnostics.push(
          documentDiagnostic(
            document,
            'DQ010',
            'error',
            `Duplicate HTML id: ${duplicate.text}`,
            'Assign a unique id to every element.',
            duplicate.location,
          ),
        );
      }
    }

    const identifier = document.metadata.id;
    if (typeof identifier === 'string' && identifier.trim().length > 0) {
      const grouped = identifiers.get(identifier) ?? [];
      grouped.push(document);
      identifiers.set(identifier, grouped);
    }
    const version = document.metadata.version;
    if (
      version !== undefined &&
      (typeof version !== 'string' || !semanticVersion.test(version))
    ) {
      diagnostics.push(
        documentDiagnostic(
          document,
          'DQ011',
          'error',
          `Document version is not a semantic version: ${displayValue(version)}`,
          'Use MAJOR.MINOR.PATCH with an optional prerelease/build suffix.',
          document.metadataLocation,
        ),
      );
    }
  }

  for (const [identifier, groupedDocuments] of identifiers) {
    if (groupedDocuments.length < 2) {
      continue;
    }
    for (const document of groupedDocuments) {
      diagnostics.push(
        documentDiagnostic(
          document,
          'DQ011',
          'error',
          `Document id is not unique: ${identifier}`,
          'Assign a stable repository-unique id in front matter.',
          document.metadataLocation,
        ),
      );
    }
  }

  return diagnostics;
}
