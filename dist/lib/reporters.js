/**
 * @file Console, JSON, SARIF, and HTML reporters.
 * @description Converts one scan result into human-readable and machine-readable evidence without source injection.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RULES } from './rules.js';
/** Escapes user-controlled text before inserting it into HTML. */
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
/** Renders one diagnostic in a compiler-style console format. */
function consoleLine(diagnostic) {
    const state = diagnostic.suppressed ? 'suppressed' : diagnostic.severity;
    return `${diagnostic.file}:${diagnostic.location.line}:${diagnostic.location.column} ${state} ${diagnostic.ruleId} ${diagnostic.message}`;
}
/** Renders concise console output suitable for terminals and CI logs. */
export function renderConsole(result) {
    const lines = result.diagnostics.map(consoleLine);
    lines.push(`Scanned ${result.summary.files} files: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.notices} notices, ${result.summary.suppressed} suppressed (${result.summary.durationMs} ms).`);
    if (result.baselineReview) {
        const counts = Object.fromEntries(['new', 'persistent', 'not-reproduced', 'unexamined'].map((state) => [
            state,
            result.baselineReview?.entries.filter((entry) => entry.state === state).length ??
                0,
        ]));
        lines.push(`Baseline review: ${JSON.stringify(counts)}. Not-reproduced is not proof of a fix; unexamined debt is retained.`);
    }
    return `${lines.join('\n')}\n`;
}
/** Builds the stable JSON report contract. */
export function createJsonReport(result) {
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        summary: result.summary,
        failed: result.failed,
        diagnostics: result.diagnostics,
        ...(result.baselineReview ? { baselineReview: result.baselineReview } : {}),
    };
}
/** Builds SARIF 2.1.0 for GitHub code scanning and compatible tooling. */
export function createSarifReport(result) {
    return {
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'documentation-quality-gate',
                        version: '1.0.0',
                        informationUri: 'https://github.com/JasonStys/documentation-quality-gate',
                        rules: RULES.map((rule) => ({
                            id: rule.id,
                            name: rule.title.replaceAll(' ', ''),
                            shortDescription: { text: rule.title },
                            fullDescription: { text: rule.description },
                            defaultConfiguration: {
                                level: rule.defaultSeverity === 'notice' ? 'note' : rule.defaultSeverity,
                            },
                        })),
                    },
                },
                automationDetails: { id: 'documentation-quality-gate/' },
                results: result.diagnostics
                    .filter((diagnostic) => !diagnostic.suppressed)
                    .map((diagnostic) => ({
                    ruleId: diagnostic.ruleId,
                    level: diagnostic.severity === 'notice' ? 'note' : diagnostic.severity,
                    message: {
                        text: `${diagnostic.message} Remediation: ${diagnostic.remediation}`,
                    },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { uri: diagnostic.file.replaceAll('\\', '/') },
                                region: {
                                    startLine: diagnostic.location.line,
                                    startColumn: diagnostic.location.column,
                                    ...(diagnostic.location.endLine === undefined
                                        ? {}
                                        : { endLine: diagnostic.location.endLine }),
                                    ...(diagnostic.location.endColumn === undefined
                                        ? {}
                                        : { endColumn: diagnostic.location.endColumn }),
                                },
                            },
                        },
                    ],
                    partialFingerprints: { primaryLocationLineHash: diagnostic.fingerprint },
                })),
            },
        ],
    };
}
/** Creates a self-contained accessible report with severity and suppression context. */
export function createHtmlReport(result) {
    const rows = result.diagnostics
        .map((diagnostic) => `
        <tr data-severity="${escapeHtml(diagnostic.severity)}"${diagnostic.suppressed ? ' class="suppressed"' : ''}>
          <td><code>${escapeHtml(diagnostic.ruleId)}</code></td>
          <td>${escapeHtml(diagnostic.suppressed ? 'suppressed' : diagnostic.severity)}</td>
          <td><code>${escapeHtml(diagnostic.file)}:${diagnostic.location.line}</code></td>
          <td>${escapeHtml(diagnostic.message)}<br><small>${escapeHtml(diagnostic.remediation)}</small></td>
        </tr>`)
        .join('');
    const review = result.baselineReview;
    const reviewHtml = review
        ? `<section aria-label="Baseline review"><h2>Review accepted documentation debt</h2>
    <p>Current configuration: <code>${review.configurationSha256}</code>. Successfully parsed files: ${review.successfullyScannedFiles.length}.</p>
    <p>Not-reproduced means absent under this configuration, not proven fixed. Unexamined includes excluded, missing and unreadable files. Line moves create a new fingerprint. Refresh is an explicit acceptance of new findings; configured temporary exceptions do not become new baseline debt.</p>
    <p>Scroll the comparison table horizontally on narrow screens.</p><div class="table-scroll" role="region" aria-label="Scrollable debt comparison" tabindex="0"><table><caption>Baseline changes and retained debt</caption><thead><tr><th scope="col">State</th><th scope="col">Location</th><th scope="col">Rule</th><th scope="col">Reason</th></tr></thead><tbody>${review.entries.map((entry) => `<tr><td>${entry.state}</td><td><code>${escapeHtml(entry.path)}:${entry.line}</code></td><td>${entry.ruleId}</td><td>${escapeHtml(entry.reason)}</td></tr>`).join('') || '<tr><td colspan="4">No baseline findings.</td></tr>'}</tbody></table></div></section>`
        : '';
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Documentation quality report</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0 auto; max-width: 90rem; padding: 1.5rem; overflow-wrap: anywhere; }
    table { border-collapse: collapse; width: 100%; min-width: 48rem; }
    .table-scroll { overflow-x: auto; }
    td, th { overflow-wrap: anywhere; }
    caption { font-size: 1.25rem; font-weight: 700; padding: 1rem 0; text-align: left; }
    th, td { border: 1px solid #7778; padding: .6rem; text-align: left; vertical-align: top; }
    th { background: #1769aa; color: white; }
    .summary { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0; }
    .summary li { border: 1px solid #7778; border-radius: .4rem; list-style: none; padding: .7rem; }
    .suppressed { opacity: .7; }
    small { line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>Documentation quality report</h1>
    <ul class="summary" aria-label="Scan summary">
      <li><strong>${result.summary.files}</strong> files</li>
      <li><strong>${result.summary.errors}</strong> errors</li>
      <li><strong>${result.summary.warnings}</strong> warnings</li>
      <li><strong>${result.summary.notices}</strong> notices</li>
      <li><strong>${result.summary.suppressed}</strong> suppressed</li>
    </ul>
    ${reviewHtml}
    <div class="table-scroll" role="region" aria-label="Scrollable diagnostics" tabindex="0"><table>
      <caption>Diagnostics</caption>
      <thead><tr><th scope="col">Rule</th><th scope="col">Severity</th><th scope="col">Location</th><th scope="col">Finding and remediation</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No diagnostics.</td></tr>'}</tbody>
    </table></div>
  </main>
</body>
</html>
`;
}
/** Writes all machine-readable and human-readable reports atomically enough for CI artifact collection. */
export async function writeReports(result, outputDirectory) {
    const absoluteDirectory = path.resolve(result.rootDirectory, outputDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    const paths = {
        json: path.join(absoluteDirectory, 'documentation-quality.json'),
        sarif: path.join(absoluteDirectory, 'documentation-quality.sarif'),
        html: path.join(absoluteDirectory, 'documentation-quality.html'),
    };
    await Promise.all([
        writeFile(paths.json, `${JSON.stringify(createJsonReport(result), null, 2)}\n`, 'utf8'),
        writeFile(paths.sarif, `${JSON.stringify(createSarifReport(result), null, 2)}\n`, 'utf8'),
        writeFile(paths.html, createHtmlReport(result), 'utf8'),
    ]);
    return paths;
}
//# sourceMappingURL=reporters.js.map