/**
 * @file Baseline and suppression governance.
 * @description Applies explicit, expiring exceptions while ensuring new diagnostics remain visible.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { minimatch } from 'minimatch';
import { baselineEligible, loadBaselineSnapshot, refreshBaseline } from './baseline.js';
import type { BaselineSnapshot } from './baseline.js';
import { createDiagnostic } from './diagnostics.js';
import type {
  Diagnostic,
  QualityConfiguration,
  ScanResult,
  SuppressionConfiguration,
} from './model.js';

/** Loads a strictly validated baseline; missing files mean no accepted findings. */
export async function loadBaseline(
  rootDirectory: string,
  baselineFile: string,
): Promise<ReadonlySet<string>> {
  return new Set(
    (await loadBaselineSnapshot(rootDirectory, baselineFile)).entries.map(
      (entry) => entry.fingerprint,
    ),
  );
}

/** Determines whether a live suppression selects a diagnostic. */
function matchesSuppression(
  diagnostic: Diagnostic,
  suppression: SuppressionConfiguration,
): boolean {
  return (
    suppression.ruleId === diagnostic.ruleId &&
    (suppression.path === undefined || minimatch(diagnostic.file, suppression.path)) &&
    (suppression.line === undefined || suppression.line === diagnostic.location.line)
  );
}

/** Applies baselines and suppressions and emits errors for expired exceptions. */
export async function applyGovernance(
  rootDirectory: string,
  diagnostics: readonly Diagnostic[],
  configuration: QualityConfiguration,
  now = new Date(),
  snapshot?: BaselineSnapshot,
): Promise<Diagnostic[]> {
  const loaded =
    snapshot ?? (await loadBaselineSnapshot(rootDirectory, configuration.baselineFile));
  const baseline = new Map(loaded.entries.map((entry) => [entry.fingerprint, entry]));
  const today = now.toISOString().slice(0, 10);
  const expired = configuration.suppressions.filter(
    (suppression) => suppression.expires !== undefined && suppression.expires < today,
  );
  const active = configuration.suppressions.filter(
    (suppression) => suppression.expires === undefined || suppression.expires >= today,
  );
  const governed = diagnostics.map((diagnostic) => {
    if (!baselineEligible(diagnostic)) return diagnostic;
    const suppression = active.find((candidate) =>
      matchesSuppression(diagnostic, candidate),
    );
    if (suppression !== undefined) {
      return {
        ...diagnostic,
        suppressed: true,
        suppressionReason: `configured: ${suppression.rationale}`,
      };
    }
    const prior = baseline.get(diagnostic.fingerprint);
    if (
      prior &&
      (prior.path !== diagnostic.file ||
        prior.line !== diagnostic.location.line ||
        prior.ruleId !== diagnostic.ruleId)
    )
      throw new Error(
        'Baseline fingerprint metadata does not match the current finding.',
      );
    if (prior) {
      return { ...diagnostic, suppressed: true, suppressionReason: 'baseline' };
    }
    return diagnostic;
  });

  for (const suppression of expired) {
    governed.push(
      createDiagnostic({
        ruleId: 'DQ000',
        severity: 'error',
        message: `Suppression expired on ${suppression.expires}: ${suppression.ruleId}`,
        remediation:
          'Remove the suppression, fix the issue, or renew it with a reviewed expiry and rationale.',
        file: suppression.path ?? '.docquality.json',
        location: { line: suppression.line ?? 1, column: 1 },
      }),
    );
  }
  return governed;
}

/** Refreshes explicitly reviewed debt atomically without dropping findings outside this scan's scope. */
export async function writeBaselineFile(
  result: ScanResult,
  destination = result.configuration.baselineFile,
): Promise<string> {
  return refreshBaseline(result, destination);
}
