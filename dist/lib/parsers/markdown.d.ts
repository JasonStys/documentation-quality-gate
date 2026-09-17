import type { DocumentFacts } from '../model.js';
/** Produces GitHub-compatible-enough heading slugs for local anchor validation. */
export declare function headingSlug(value: string): string;
/** Extracts front matter, document structure, links, media, tables, code, and warnings. */
export declare function parseMarkdownDocument(absolutePath: string, relativePath: string, source: string): DocumentFacts;
//# sourceMappingURL=markdown.d.ts.map