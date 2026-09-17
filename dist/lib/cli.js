#!/usr/bin/env node
/**
 * @file Command-line entry point.
 * @description Exposes repository scanning, report generation, changed-file mode, and baseline creation.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { realpathSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';
import { writeBaselineFile } from './governance.js';
import { renderConsole, writeReports } from './reporters.js';
import { scanRepository } from './scanner.js';
/** Builds the CLI independently so integration tests can invoke it without global state. */
export function createProgram() {
    return new Command()
        .name('doc-quality')
        .description('Validate technical-documentation structure, safety, links, and accessibility.')
        .argument('[paths...]', 'files or directories to scan', ['.'])
        .option('-c, --config <path>', 'configuration path relative to the repository root', '.docquality.json')
        .option('-o, --output-dir <path>', 'report output directory', 'reports/documentation-quality')
        .option('--changed-from <revision>', 'scan only documentation changed since a Git revision')
        .addOption(new Option('--fail-on <severity>', 'override the failure threshold').choices([
        'error',
        'warning',
        'notice',
        'none',
    ]))
        .option('--write-baseline', 'write current unsuppressed findings to the configured baseline', false);
}
/** Runs the CLI and returns the intended process exit code. */
export async function runCli(arguments_, rootDirectory = process.cwd()) {
    const program = createProgram();
    program.exitOverride();
    await program.parseAsync([...arguments_], { from: 'user' });
    const paths = program.args.length === 0 ? ['.'] : program.args;
    const options = program.opts();
    const result = await scanRepository({
        rootDirectory,
        paths,
        configPath: options.config,
        ...(options.changedFrom === undefined ? {} : { changedFrom: options.changedFrom }),
        ...(options.failOn === undefined ? {} : { failureThreshold: options.failOn }),
    });
    await writeReports(result, options.outputDir);
    if (options.writeBaseline) {
        await writeBaselineFile(result);
    }
    process.stdout.write(renderConsole(result));
    return result.failed ? 1 : 0;
}
const isDirectInvocation = process.argv[1] !== undefined &&
    realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isDirectInvocation) {
    runCli(process.argv.slice(2))
        .then((code) => {
        process.exitCode = code;
    })
        .catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 2;
    });
}
//# sourceMappingURL=cli.js.map