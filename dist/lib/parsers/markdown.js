import { unified } from 'unified';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import YAML from 'yaml';
/** Returns a stable one-based source location even for parser-generated nodes. */
function locationOf(node) {
    return {
        line: node.position?.start.line ?? 1,
        column: node.position?.start.column ?? 1,
        ...(node.position?.end.line === undefined ? {} : { endLine: node.position.end.line }),
        ...(node.position?.end.column === undefined
            ? {}
            : { endColumn: node.position.end.column }),
    };
}
/** Collects visible text recursively without interpreting embedded HTML. */
function textOf(node) {
    const candidate = node;
    if (typeof candidate.value === 'string') {
        return candidate.value;
    }
    if (typeof candidate.alt === 'string') {
        return candidate.alt;
    }
    return (candidate.children ?? []).map((child) => textOf(child)).join('');
}
/** Produces GitHub-compatible-enough heading slugs for local anchor validation. */
export function headingSlug(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
/** Extracts front matter, document structure, links, media, tables, code, and warnings. */
export function parseMarkdownDocument(absolutePath, relativePath, source) {
    const tree = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml'])
        .use(remarkGfm)
        .parse(source);
    const headings = [];
    const images = [];
    const links = [];
    const tables = [];
    const codeBlocks = [];
    const warnings = [];
    const anchors = new Set();
    let metadata = {};
    let metadataLocation = { line: 1, column: 1 };
    visit(tree, (node) => {
        const candidate = node;
        if (node.type === 'yaml') {
            metadataLocation = locationOf(node);
            const parsed = YAML.parse(candidate.value ?? '');
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                metadata = parsed;
            }
            return;
        }
        if (node.type === 'heading') {
            const text = textOf(node).trim();
            const slug = headingSlug(text);
            headings.push({
                text,
                slug,
                depth: candidate.depth ?? 1,
                location: locationOf(node),
            });
            anchors.add(slug);
            return;
        }
        if (node.type === 'image') {
            images.push({
                alt: candidate.alt ?? null,
                source: candidate.url ?? '',
                location: locationOf(node),
            });
            return;
        }
        if (node.type === 'link') {
            links.push({
                target: candidate.url ?? '',
                label: textOf(node).trim(),
                location: locationOf(node),
            });
            return;
        }
        if (node.type === 'table') {
            const firstRow = candidate.children?.[0]?.children ?? [];
            tables.push({
                headerCells: firstRow.map((cell) => textOf(cell).trim()),
                location: locationOf(node),
            });
            return;
        }
        if (node.type === 'code') {
            codeBlocks.push({
                language: candidate.lang?.trim() || null,
                value: candidate.value ?? '',
                location: locationOf(node),
            });
            return;
        }
        if (node.type === 'blockquote') {
            const value = textOf(node).trim();
            if (/^\[!WARNING\]/i.test(value)) {
                const fields = new Set();
                for (const field of ['condition', 'consequence', 'avoidance']) {
                    if (new RegExp(`(?:^|\\n)${field}\\s*:`, 'i').test(value)) {
                        fields.add(field);
                    }
                }
                warnings.push({ value, fields, location: locationOf(node) });
            }
        }
    });
    return {
        absolutePath,
        relativePath,
        format: 'markdown',
        metadata,
        metadataLocation,
        headings,
        images,
        links,
        tables,
        codeBlocks,
        warnings,
        anchors,
        html: null,
    };
}
//# sourceMappingURL=markdown.js.map