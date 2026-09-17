#!/usr/bin/env node
import { Command } from 'commander';
/** Builds the CLI independently so integration tests can invoke it without global state. */
export declare function createProgram(): Command;
/** Runs the CLI and returns the intended process exit code. */
export declare function runCli(arguments_: readonly string[], rootDirectory?: string): Promise<number>;
//# sourceMappingURL=cli.d.ts.map