/**
 * @file HTML fact extractor.
 * @description Traverses parse5 output to collect document structure and static accessibility facts.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { parse } from 'parse5';
import type {
  CodeBlockFact,
  DocumentFacts,
  HeadingFact,
  ImageFact,
  LinkFact,
  LocatedText,
  SourceLocation,
  TableFact,
  WarningFact,
} from '../model.js';
import { headingSlug } from './markdown.js';

interface HtmlAttribute {
  readonly name: string;
  readonly value: string;
}

interface HtmlLocation {
  readonly startLine?: number;
  readonly startCol?: number;
  readonly endLine?: number;
  readonly endCol?: number;
}

interface HtmlNode {
  readonly nodeName: string;
  readonly tagName?: string;
  readonly attrs?: readonly HtmlAttribute[];
  readonly childNodes?: readonly HtmlNode[];
  readonly value?: string;
  readonly sourceCodeLocation?: HtmlLocation;
}

/** Returns the value of a case-insensitive HTML attribute. */
function attribute(node: HtmlNode, name: string): string | null {
  return (
    node.attrs?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ??
    null
  );
}

/** Returns visible text below an HTML node. */
function textOf(node: HtmlNode): string {
  if (node.nodeName === '#text') {
    return node.value ?? '';
  }
  return (node.childNodes ?? []).map((child) => textOf(child)).join('');
}

/** Converts parse5 coordinates to the shared one-based location contract. */
function locationOf(node: HtmlNode): SourceLocation {
  return {
    line: node.sourceCodeLocation?.startLine ?? 1,
    column: node.sourceCodeLocation?.startCol ?? 1,
    ...(node.sourceCodeLocation?.endLine === undefined
      ? {}
      : { endLine: node.sourceCodeLocation.endLine }),
    ...(node.sourceCodeLocation?.endCol === undefined
      ? {}
      : { endColumn: node.sourceCodeLocation.endCol }),
  };
}

/** Returns all descendants that satisfy a predicate. */
function descendants(
  node: HtmlNode,
  predicate: (candidate: HtmlNode) => boolean,
): HtmlNode[] {
  const matches: HtmlNode[] = [];
  for (const child of node.childNodes ?? []) {
    if (predicate(child)) {
      matches.push(child);
    }
    matches.push(...descendants(child, predicate));
  }
  return matches;
}

/** Extracts HTML structure, links, media, tables, warnings, and static accessibility facts. */
export function parseHtmlDocument(
  absolutePath: string,
  relativePath: string,
  source: string,
): DocumentFacts {
  const tree = parse(source, { sourceCodeLocationInfo: true }) as unknown as HtmlNode;
  const elements = descendants(tree, (node) => typeof node.tagName === 'string');
  const headings: HeadingFact[] = [];
  const images: ImageFact[] = [];
  const links: LinkFact[] = [];
  const tables: TableFact[] = [];
  const codeBlocks: CodeBlockFact[] = [];
  const warnings: WarningFact[] = [];
  const anchors = new Set<string>();
  const ids = new Map<string, LocatedText[]>();
  let mainCount = 0;
  let title: LocatedText | null = null;
  let htmlLanguage: string | null = null;

  for (const node of elements) {
    const tag = node.tagName?.toLowerCase() ?? '';
    const id = attribute(node, 'id');
    if (id !== null && id.length > 0) {
      anchors.add(id);
      const locations = ids.get(id) ?? [];
      locations.push({ text: id, location: locationOf(node) });
      ids.set(id, locations);
    }
    if (tag === 'html') {
      htmlLanguage = attribute(node, 'lang');
    } else if (/^h[1-6]$/.test(tag)) {
      const text = textOf(node).trim();
      const slug = id ?? headingSlug(text);
      anchors.add(slug);
      headings.push({
        text,
        slug,
        depth: Number(tag.slice(1)),
        location: locationOf(node),
      });
    } else if (tag === 'img') {
      images.push({
        alt: attribute(node, 'alt'),
        source: attribute(node, 'src') ?? '',
        location: locationOf(node),
      });
    } else if (tag === 'a') {
      links.push({
        target: attribute(node, 'href') ?? '',
        label: textOf(node).trim(),
        location: locationOf(node),
      });
    } else if (tag === 'table') {
      const headers = descendants(
        node,
        (candidate) => candidate.tagName?.toLowerCase() === 'th',
      );
      tables.push({
        headerCells: headers.map((header) => textOf(header).trim()),
        location: locationOf(node),
      });
    } else if (tag === 'pre') {
      const code = descendants(
        node,
        (candidate) => candidate.tagName?.toLowerCase() === 'code',
      )[0];
      const className = code === undefined ? null : attribute(code, 'class');
      const language = className?.match(/(?:^|\s)language-([\w-]+)/)?.[1] ?? null;
      codeBlocks.push({
        language,
        value: textOf(code ?? node),
        location: locationOf(node),
      });
    } else if (tag === 'main') {
      mainCount += 1;
    } else if (tag === 'title') {
      title = { text: textOf(node).trim(), location: locationOf(node) };
    }

    if (attribute(node, 'role') === 'alert' || attribute(node, 'data-warning') !== null) {
      const value = textOf(node).trim();
      const fields = new Set<string>();
      for (const field of ['condition', 'consequence', 'avoidance']) {
        if (new RegExp(`${field}\\s*:`, 'i').test(value)) {
          fields.add(field);
        }
      }
      warnings.push({ value, fields, location: locationOf(node) });
    }
  }

  const duplicateIds = [...ids.values()]
    .filter((locations) => locations.length > 1)
    .flat();
  return {
    absolutePath,
    relativePath,
    format: 'html',
    metadata: title === null ? {} : { title: title.text },
    metadataLocation: title?.location ?? { line: 1, column: 1 },
    headings,
    images,
    links,
    tables,
    codeBlocks,
    warnings,
    anchors,
    html: { duplicateIds, htmlLanguage, mainCount, title },
  };
}
