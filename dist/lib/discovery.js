/**
 * @file Documentation file discovery.
 * @description Expands configured globs, applies path scopes, and optionally filters by a Git revision.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import fastGlob from 'fast-glob';
const execFileAsync = promisify(execFile);
/** Normalizes a repository-relative path to portable forward slashes. */
function normalizeRelative(value) {
    return value.replaceAll('\\', '/').replace(/^\.\//, '');
}
/** Returns changed filenames using an argument-array Git call rather than a shell command. */
async function changedFiles(rootDirectory, revision) {
    try {
        const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${revision}...HEAD`, '--'], { cwd: rootDirectory, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        return new Set(stdout.split(/\r?\n/u).filter(Boolean).map(normalizeRelative));
    }
    catch (error) {
        throw new Error(`Unable to calculate changed files from ${revision}; ensure the revision was fetched.`, { cause: error });
    }
}
/** Discovers supported documentation files in deterministic order. */
export async function discoverFiles(rootDirectory, configuration, paths = ['.'], changedFrom) {
    const candidates = await fastGlob([...configuration.include], {
        absolute: false,
        cwd: rootDirectory,
        dot: true,
        followSymbolicLinks: false,
        ignore: [...configuration.exclude],
        onlyFiles: true,
        unique: true,
    });
    const scopes = paths
        .map((item) => normalizeRelative(path.normalize(item)))
        .map((item) => (item === '.' ? '' : item.replace(/\/$/, '')));
    const changed = changedFrom === undefined ? null : await changedFiles(rootDirectory, changedFrom);
    return candidates
        .map(normalizeRelative)
        .filter((candidate) => scopes.some((scope) => scope.length === 0 || candidate === scope || candidate.startsWith(`${scope}/`)))
        .filter((candidate) => changed === null || changed.has(candidate))
        .filter((candidate) => /\.(?:md|html?)$/i.test(candidate))
        .sort((left, right) => left.localeCompare(right));
}
//# sourceMappingURL=discovery.js.map