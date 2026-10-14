/**
 * @file Repository scan orchestrator.
 * @description Loads configuration, parses bounded inputs, runs rules, applies governance, and computes exit policy.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { open } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { loadConfiguration } from './config.js';
import { createDiagnostic } from './diagnostics.js';
import { discoverFiles } from './discovery.js';
import { evaluateExternalLinks } from './external-links.js';
import { applyGovernance } from './governance.js';
import { SEVERITY_ORDER } from './model.js';
import { parseHtmlDocument } from './parsers/html.js';
import { parseMarkdownDocument } from './parsers/markdown.js';
import { evaluateRules } from './rules.js';
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
/** Reads one open descriptor with a strict byte cap, even if the file grows. */
export async function readBoundedDocument(absolutePath) {
    const handle = await open(absolutePath, 'r');
    try {
        const details = await handle.stat();
        if (!details.isFile() || details.size > MAX_DOCUMENT_BYTES) {
            throw new Error(`Document exceeds the ${MAX_DOCUMENT_BYTES}-byte input limit or is not a regular file.`);
        }
        const chunks = [];
        let total = 0;
        while (total <= MAX_DOCUMENT_BYTES) {
            const chunk = Buffer.alloc(Math.min(64 * 1024, MAX_DOCUMENT_BYTES + 1 - total));
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
            if (bytesRead === 0)
                break;
            total += bytesRead;
            if (total > MAX_DOCUMENT_BYTES) {
                throw new Error(`Document exceeds the ${MAX_DOCUMENT_BYTES}-byte input limit.`);
            }
            chunks.push(chunk.subarray(0, bytesRead));
        }
        return Buffer.concat(chunks, total).toString('utf8');
    }
    finally {
        await handle.close();
    }
}
/** Parses one bounded UTF-8 document or returns a precise parse diagnostic. */
async function parseDocument(rootDirectory, relativePath) {
    const absolutePath = path.resolve(rootDirectory, relativePath);
    try {
        const source = await readBoundedDocument(absolutePath);
        const document = /\.html?$/i.test(relativePath)
            ? parseHtmlDocument(absolutePath, relativePath, source)
            : parseMarkdownDocument(absolutePath, relativePath, source);
        return { document };
    }
    catch (error) {
        return {
            diagnostic: createDiagnostic({
                ruleId: 'DQ013',
                severity: 'error',
                message: `Document could not be parsed: ${error instanceof Error ? error.message : 'unknown error'}`,
                remediation: 'Correct the encoding or syntax and keep individual documentation files below 5 MiB.',
                file: relativePath,
                location: { line: 1, column: 1 },
            }),
        };
    }
}
/** Parses files with a bounded worker pool to avoid unbounded memory and file-descriptor use. */
async function parseDocuments(rootDirectory, files, concurrency = 8) {
    const documents = [];
    const diagnostics = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, files.length) }, async () => {
        while (cursor < files.length) {
            const index = cursor;
            cursor += 1;
            const file = files[index];
            if (file === undefined) {
                continue;
            }
            const result = await parseDocument(rootDirectory, file);
            if (result.document !== undefined) {
                documents.push(result.document);
            }
            if (result.diagnostic !== undefined) {
                diagnostics.push(result.diagnostic);
            }
        }
    });
    await Promise.all(workers);
    documents.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    diagnostics.sort((left, right) => left.file.localeCompare(right.file));
    return { documents, diagnostics };
}
/** Scans a repository and returns a policy-aware, report-ready result. */
export async function scanRepository(options) {
    const started = performance.now();
    const rootDirectory = path.resolve(options.rootDirectory);
    const configuration = await loadConfiguration(rootDirectory, options.configPath);
    const effectiveConfiguration = {
        ...configuration,
        ...(options.failureThreshold === undefined
            ? {}
            : { failOn: options.failureThreshold }),
    };
    const files = await discoverFiles(rootDirectory, effectiveConfiguration, options.paths, options.changedFrom);
    const parsed = await parseDocuments(rootDirectory, files);
    const ruleDiagnostics = await evaluateRules(rootDirectory, parsed.documents, effectiveConfiguration);
    const networkDiagnostics = await evaluateExternalLinks(rootDirectory, parsed.documents, effectiveConfiguration.externalLinks, options.now);
    const diagnostics = await applyGovernance(rootDirectory, [...parsed.diagnostics, ...ruleDiagnostics, ...networkDiagnostics], effectiveConfiguration, options.now);
    diagnostics.sort((left, right) => left.file.localeCompare(right.file) ||
        left.location.line - right.location.line ||
        left.ruleId.localeCompare(right.ruleId));
    const active = diagnostics.filter((diagnostic) => !diagnostic.suppressed);
    const summary = {
        files: parsed.documents.length,
        errors: active.filter((diagnostic) => diagnostic.severity === 'error').length,
        warnings: active.filter((diagnostic) => diagnostic.severity === 'warning').length,
        notices: active.filter((diagnostic) => diagnostic.severity === 'notice').length,
        suppressed: diagnostics.length - active.length,
        durationMs: Number((performance.now() - started).toFixed(3)),
    };
    const threshold = SEVERITY_ORDER[effectiveConfiguration.failOn];
    const failed = active.some((diagnostic) => SEVERITY_ORDER[diagnostic.severity] >= threshold) &&
        threshold > 0;
    return {
        rootDirectory,
        configuration: effectiveConfiguration,
        documents: parsed.documents,
        diagnostics,
        summary,
        failed,
    };
}
//# sourceMappingURL=scanner.js.map