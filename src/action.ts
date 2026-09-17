/**
 * @file GitHub Action entry point.
 * @description Runs the quality gate, emits workflow annotations, publishes outputs, and enforces severity policy.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import process from 'node:process';
import * as core from '@actions/core';
import type { FailureThreshold } from './model.js';
import { writeReports } from './reporters.js';
import { scanRepository } from './scanner.js';

/** Converts a newline-separated Action input into normalized scan roots. */
function parsePaths(value: string): string[] {
  const paths = value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
  return paths.length === 0 ? ['.'] : paths;
}

/** Emits one GitHub workflow annotation at the diagnostic source location. */
function annotate(
  severity: 'error' | 'warning' | 'notice',
  message: string,
  properties: core.AnnotationProperties,
): void {
  if (severity === 'error') {
    core.error(message, properties);
  } else if (severity === 'warning') {
    core.warning(message, properties);
  } else {
    core.notice(message, properties);
  }
}

/** Executes the Action using least-privilege local filesystem behavior. */
export async function runAction(): Promise<void> {
  try {
    const config = core.getInput('config') || '.docquality.json';
    const paths = parsePaths(core.getInput('paths') || '.');
    const changedFrom = core.getInput('changed-from') || undefined;
    const failOn = (core.getInput('fail-on') || undefined) as
      FailureThreshold | undefined;
    const outputDirectory =
      core.getInput('output-directory') || 'reports/documentation-quality';
    const result = await scanRepository({
      rootDirectory: process.env.GITHUB_WORKSPACE ?? process.cwd(),
      paths,
      configPath: config,
      ...(changedFrom === undefined ? {} : { changedFrom }),
      ...(failOn === undefined ? {} : { failureThreshold: failOn }),
    });
    const reports = await writeReports(result, outputDirectory);
    for (const diagnostic of result.diagnostics.filter((item) => !item.suppressed)) {
      annotate(
        diagnostic.severity,
        `${diagnostic.ruleId}: ${diagnostic.message} Remediation: ${diagnostic.remediation}`,
        {
          title: `Documentation quality ${diagnostic.ruleId}`,
          file: diagnostic.file,
          startLine: diagnostic.location.line,
          startColumn: diagnostic.location.column,
          ...(diagnostic.location.endLine === undefined
            ? {}
            : { endLine: diagnostic.location.endLine }),
          ...(diagnostic.location.endColumn === undefined
            ? {}
            : { endColumn: diagnostic.location.endColumn }),
        },
      );
    }
    core.setOutput('errors', result.summary.errors);
    core.setOutput('warnings', result.summary.warnings);
    core.setOutput('notices', result.summary.notices);
    core.setOutput('report-json', reports.json);
    core.setOutput('report-sarif', reports.sarif);
    core.setOutput('report-html', reports.html);
    core.summary.addHeading('Documentation quality gate').addTable([
      [
        { data: 'Files', header: true },
        { data: 'Errors', header: true },
        { data: 'Warnings', header: true },
        { data: 'Notices', header: true },
        { data: 'Suppressed', header: true },
      ],
      [
        String(result.summary.files),
        String(result.summary.errors),
        String(result.summary.warnings),
        String(result.summary.notices),
        String(result.summary.suppressed),
      ],
    ]);
    await core.summary.write();
    if (result.failed) {
      core.setFailed(
        'Documentation quality policy failed. Review the annotations and generated reports.',
      );
    }
  } catch (error: unknown) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void runAction();
