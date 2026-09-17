/**
 * @file Baseline and suppression governance.
 * @description Applies explicit, expiring exceptions while ensuring new diagnostics remain visible.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { minimatch } from 'minimatch';
import { createDiagnostic } from './diagnostics.js';
/** Loads and minimally validates a baseline, returning an empty set when it does not exist. */
export async function loadBaseline(rootDirectory, baselineFile) {
    try {
        const source = await readFile(path.resolve(rootDirectory, baselineFile), 'utf8');
        const parsed = JSON.parse(source);
        if (parsed === null ||
            typeof parsed !== 'object' ||
            !('version' in parsed) ||
            parsed.version !== 1 ||
            !('entries' in parsed) ||
            !Array.isArray(parsed.entries)) {
            throw new Error('Baseline must use version 1 and contain an entries array.');
        }
        return new Set(parsed.entries
            .map((entry) => entry !== null &&
            typeof entry === 'object' &&
            'fingerprint' in entry &&
            typeof entry.fingerprint === 'string'
            ? entry.fingerprint
            : undefined)
            .filter((value) => typeof value === 'string'));
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return new Set();
        }
        throw new Error(`Unable to load baseline ${baselineFile}`, { cause: error });
    }
}
/** Determines whether a live suppression selects a diagnostic. */
function matchesSuppression(diagnostic, suppression) {
    return (suppression.ruleId === diagnostic.ruleId &&
        (suppression.path === undefined || minimatch(diagnostic.file, suppression.path)) &&
        (suppression.line === undefined || suppression.line === diagnostic.location.line));
}
/** Applies baselines and suppressions and emits errors for expired exceptions. */
export async function applyGovernance(rootDirectory, diagnostics, configuration, now = new Date()) {
    const baseline = await loadBaseline(rootDirectory, configuration.baselineFile);
    const today = now.toISOString().slice(0, 10);
    const expired = configuration.suppressions.filter((suppression) => suppression.expires !== undefined && suppression.expires < today);
    const active = configuration.suppressions.filter((suppression) => suppression.expires === undefined || suppression.expires >= today);
    const governed = diagnostics.map((diagnostic) => {
        const suppression = active.find((candidate) => matchesSuppression(diagnostic, candidate));
        if (suppression !== undefined) {
            return {
                ...diagnostic,
                suppressed: true,
                suppressionReason: `configured: ${suppression.rationale}`,
            };
        }
        if (baseline.has(diagnostic.fingerprint)) {
            return { ...diagnostic, suppressed: true, suppressionReason: 'baseline' };
        }
        return diagnostic;
    });
    for (const suppression of expired) {
        governed.push(createDiagnostic({
            ruleId: 'DQ000',
            severity: 'error',
            message: `Suppression expired on ${suppression.expires}: ${suppression.ruleId}`,
            remediation: 'Remove the suppression, fix the issue, or renew it with a reviewed expiry and rationale.',
            file: suppression.path ?? '.docquality.json',
            location: { line: suppression.line ?? 1, column: 1 },
        }));
    }
    return governed;
}
/** Writes the current unsuppressed findings as an explicit versioned baseline. */
export async function writeBaselineFile(result, destination = result.configuration.baselineFile) {
    const absolutePath = path.resolve(result.rootDirectory, destination);
    const baseline = {
        version: 1,
        generatedAt: new Date().toISOString(),
        entries: result.diagnostics
            .filter((diagnostic) => !diagnostic.suppressed)
            .map((diagnostic) => ({
            fingerprint: diagnostic.fingerprint,
            ruleId: diagnostic.ruleId,
            path: diagnostic.file,
            line: diagnostic.location.line,
        })),
    };
    await writeFile(absolutePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    return absolutePath;
}
//# sourceMappingURL=governance.js.map