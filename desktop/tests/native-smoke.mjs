/**
 * @file Real native corpus authoring, original quality review, baseline acceptance, exports and durable restart.
 * @description Only explicit synthetic profiles and deterministic native file-picker choices are used.
 * @remarks No normal user data, generic desktop input, document script execution or forced process cleanup.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { once } from 'node:events';
const root = path.resolve(import.meta.dirname, '../..');
const output = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !output.startsWith(path.join(root, '.runtime') + path.sep))
  throw new Error('Use a fresh own-project acceptance directory.');
await fs.mkdir(output);
await fs.writeFile(
  path.join(output, 'acceptance.marker'),
  'documentation-quality-synthetic-v1\n',
  { flag: 'wx' },
);
const profile = path.join(output, 'profile');
const executable = process.env.DOCQUALITY_NATIVE_EXECUTABLE;
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry) => typeof entry[1] === 'string'),
);
delete environment.ELECTRON_RUN_AS_NODE;
const errors = [],
  exits = [],
  identities = [];
let active;
async function launch() {
  const app = await electron.launch({
    executablePath:
      executable ?? path.join(root, 'desktop/node_modules/electron/dist/electron.exe'),
    args: [...(executable ? [] : [path.join(root, 'desktop')]), '--profile', profile],
    env: environment,
    timeout: 45000,
  });
  const page = await app.firstWindow();
  active = app;
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 1000)));
  page.setDefaultTimeout(12000);
  await expect(page.locator('#status')).toContainText('Private corpus ready');
  await expect(
    page.getByRole('heading', { name: 'Documentation Quality', exact: true }),
  ).toBeVisible();
  expect(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible(),
    ),
  ).toBe(true);
  const identity = await app.evaluate(({ app }) => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    packaged: app.isPackaged,
  }));
  expect(identity.version).toBe('1.1.1');
  expect(identity.electron).toBe('44.11.1');
  expect(identity.packaged).toBe(Boolean(executable));
  identities.push(identity);
  return { app, page };
}
async function finish(app) {
  const ended = once(app.process(), 'exit');
  await app.evaluate(({ app }) => app.quit());
  const result = await Promise.race([
    ended,
    new Promise((_resolve, reject) =>
      setTimeout(
        () => reject(new Error('Actual normal process exit did not complete.')),
        30000,
      ),
    ),
  ]);
  expect(result[0]).toBe(0);
  exits.push(result[0]);
  active = undefined;
}
async function analyze(page) {
  await page.locator('#analyze').click();
  await expect(page.locator('#status')).toContainText('Actual quality scan completed');
}
async function save(page) {
  await page.locator('#save').click();
  await expect(page.locator('#status')).toContainText('Corpus saved');
}
async function pick(app, destination, open = false) {
  await app.evaluate(
    ({ dialog }, choice) => {
      if (choice.open)
        dialog.showOpenDialog = async () => ({
          canceled: choice.destination === null,
          filePaths: choice.destination === null ? [] : [choice.destination],
        });
      else
        dialog.showSaveDialog = async () => ({
          canceled: choice.destination === null,
          filePath: choice.destination ?? '',
        });
    },
    { destination, open },
  );
}
try {
  let { app, page } = await launch();
  await analyze(page);
  await expect(page.locator('#findings')).toContainText('DQ002');
  await expect(page.locator('#findings')).toContainText('docs/handoff.md:7:1');
  await page.locator('#findings button').click();
  await expect(page.locator('#inspection-title')).toContainText('docs/handoff.md:7:1');
  await expect(page.locator('#inspection-source')).toHaveValue(/### Restore checks/u);
  await page.screenshot({
    path: path.join(output, 'native-exact-source-review.png'),
    fullPage: true,
  });
  await page.locator('#documents button').filter({ hasText: 'docs/handoff.md' }).click();
  const old = await page.locator('#source').inputValue();
  await page
    .locator('#source')
    .fill(old.replace('### Restore checks', '## Restore checks'));
  await expect(page.locator('#analyze')).toBeDisabled();
  await expect(page.locator('#findings button')).toBeDisabled();
  await save(page);
  await analyze(page);
  await expect(page.locator('#summary')).toContainText('CLEAR');
  await page.locator('#metadata').fill('title, owner, reviewed');
  await save(page);
  await analyze(page);
  await expect(page.locator('#findings button')).toHaveCount(2);
  await expect(page.locator('#summary')).toContainText('2 errors');
  await page
    .locator('#reason')
    .fill(
      'Training-only runbook metadata debt; the documentation owner will review before operational use.',
    );
  await page.locator('#accept').click();
  await expect(page.locator('#status')).toContainText('Exact reviewed debt accepted');
  await expect(page.locator('#summary')).toContainText('DEBT-REVIEW');
  await expect(page.locator('#summary')).toContainText('2 accepted/excepted');
  await expect(page.locator('#debt')).toContainText('2 retained baseline entries');
  await page.screenshot({
    path: path.join(output, 'native-governed-baseline.png'),
    fullPage: true,
  });
  for (const format of ['project', 'json', 'sarif', 'html']) {
    const destination = path.join(
      output,
      format === 'project' ? 'corpus.json' : 'report.' + format,
    );
    await pick(app, destination);
    await page.locator(`[data-export="${format}"]`).click();
    await expect(page.locator('#status')).toContainText('new evidence file was written');
    const text = await fs.readFile(destination, 'utf8');
    if (format === 'json') {
      const report = JSON.parse(text);
      expect(report.summary.files).toBe(2);
      expect(report.diagnostics).toHaveLength(2);
    }
    if (format === 'sarif') {
      const report = JSON.parse(text);
      expect(report.runs[0].tool.driver.version).toBe('1.1.1');
      expect(report.runs[0].results).toHaveLength(0); // Original SARIF exports active findings; JSON/HTML retain accepted debt.
    }
    if (format === 'html') expect(text.toLowerCase()).toContain('<!doctype html>');
  }
  const prior = await fs.readFile(path.join(output, 'report.json'));
  await pick(app, path.join(output, 'report.json'));
  await page.locator('[data-export=json]').click();
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  expect((await fs.readFile(path.join(output, 'report.json'))).equals(prior)).toBe(true);
  await pick(app, null);
  await page.locator('[data-export=json]').click();
  await expect(page.locator('#status')).toContainText('Export canceled');
  const invalid = path.join(output, 'invalid.json');
  await fs.writeFile(invalid, '{"schema":1,"rootDirectory":"../outside"}', {
    flag: 'wx',
  });
  await pick(app, invalid, true);
  await page.locator('#import-project').click();
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await expect(page.locator('#title')).toHaveValue(
    'Service recovery documentation review',
  );
  await page.locator('#documents button').first().click();
  await page.locator('#selected').uncheck();
  await page.locator('#documents button').nth(1).click();
  await page.locator('#selected').uncheck();
  await save(page);
  await analyze(page);
  await expect(page.locator('#summary')).toContainText('EMPTY-SELECTION');
  await expect(page.locator('#accept')).toBeDisabled();
  await expect(page.locator('#baseline')).toContainText('unexamined');
  await page.locator('#selected').check();
  await page.locator('#documents button').first().click();
  await page.locator('#selected').check();
  await save(page);
  await analyze(page);
  // A second industry corpus is real editable HTML plus an inert calibration table, not a separate demo app.
  const calibration = path.join(output, 'calibration.html');
  await fs.writeFile(
    calibration,
    '<!doctype html><html lang="en"><head><title>Calibration instruction</title></head><body><main><h1>Gauge calibration</h1><p>Use the <a href="readings.csv">authorized reference readings</a>.</p></main></body></html>',
    { flag: 'wx' },
  );
  await pick(app, calibration, true);
  await page.locator('#import-document').click();
  await expect(page.locator('#filename')).toHaveValue('calibration.html');
  await save(page);
  await analyze(page);
  await page.locator('#search').fill('DQ005');
  await expect(page.locator('#findings button')).toHaveCount(1);
  await expect(page.locator('#findings')).toContainText('calibration.html');
  await page.locator('#search').fill('');
  const readings = path.join(output, 'readings.csv');
  await fs.writeFile(readings, 'reference_kPa,measured_kPa\n0,0\n100,100.2\n', {
    flag: 'wx',
  });
  await pick(app, readings, true);
  await page.locator('#import-attachment').click();
  await expect(page.locator('#attachments')).toContainText('readings.csv');
  await save(page);
  await analyze(page);
  await page.locator('#search').fill('DQ005');
  await expect(page.locator('#findings button')).toHaveCount(0);
  await page.locator('#search').fill('');
  await page.locator('#remove').click();
  await page.locator('#attachments button').click();
  await save(page);
  await analyze(page);
  // Explicit unsaved-change cancellation preserves the visible editor and admits a later normal save.
  await page.locator('#title').fill('Unsaved review title');
  await app.evaluate(({ dialog }) => {
    globalThis.docQualityCancelPrompts = 0;
    dialog.showMessageBox = async () => {
      globalThis.docQualityCancelPrompts++;
      return { response: 0, checkboxChecked: false };
    };
  });
  await app.evaluate(({ app }) => app.quit());
  await expect.poll(() => app.evaluate(() => globalThis.docQualityCancelPrompts)).toBe(1);
  expect(app.process().exitCode).toBeNull();
  await expect(page.locator('#title')).toHaveValue('Unsaved review title');
  await page.locator('#title').fill('Service recovery documentation review');
  await save(page);
  await analyze(page);
  // Actual owned export promise remains held through repeated Quit/Close, and the visible owner does not disappear.
  const held = path.join(output, 'held-report.json');
  await app.evaluate(({ dialog }, destination) => {
    globalThis.docQualityReleaseChoice = null;
    dialog.showSaveDialog = () =>
      new Promise((resolve) => {
        globalThis.docQualityReleaseChoice = () =>
          resolve({ canceled: false, filePath: destination });
      });
  }, held);
  await page.locator('[data-export=json]').click();
  await expect
    .poll(() => app.evaluate(() => typeof globalThis.docQualityReleaseChoice))
    .toBe('function');
  await app.evaluate(({ app, BrowserWindow }) => {
    app.quit();
    app.quit();
    BrowserWindow.getAllWindows()[0].close();
  });
  expect(app.process().exitCode).toBeNull();
  expect(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
  ).toBe(true);
  const ended = once(app.process(), 'exit');
  await app.evaluate(() => globalThis.docQualityReleaseChoice());
  const heldExit = await Promise.race([
    ended,
    new Promise((_resolve, reject) =>
      setTimeout(
        () => reject(new Error('Held export did not complete its actual shutdown.')),
        30000,
      ),
    ),
  ]);
  expect(heldExit[0]).toBe(0);
  exits.push(heldExit[0]);
  active = undefined;
  expect(JSON.parse(await fs.readFile(held, 'utf8')).diagnostics).toHaveLength(2);
  ({ app, page } = await launch());
  await expect(page.locator('#metadata')).toHaveValue('title, owner, reviewed');
  await analyze(page);
  await expect(page.locator('#summary')).toContainText('DEBT-REVIEW');
  await expect(page.locator('#debt')).toContainText('2 retained baseline entries');
  await page.screenshot({
    path: path.join(output, 'native-restored-corpus.png'),
    fullPage: true,
  });
  // Whole-corpus replacements require a choice before discarding unapplied text, policy and selection.
  const savedBeforeReplacement = await fs.readFile(path.join(profile, 'project.json'));
  const previousProject = JSON.parse(
    await fs.readFile(path.join(profile, 'previous.json'), 'utf8'),
  ).project;
  const exportedProject = JSON.parse(
    await fs.readFile(path.join(output, 'corpus.json'), 'utf8'),
  );
  const replacementCases = [];
  for (const target of ['prepared', 'restore', 'import-project']) {
    const marker = 'Keep this unsaved source before ' + target;
    await page.locator('#source').fill(marker);
    await page.locator('#title').fill('Unsaved corpus title for ' + target);
    await page.locator('#metadata').fill('title, owner');
    await page.locator('#selected').uncheck();
    const before = await page.evaluate(() => ({
      source: globalThis.document.querySelector('#source').value,
      title: globalThis.document.querySelector('#title').value,
      metadata: globalThis.document.querySelector('#metadata').value,
      filename: globalThis.document.querySelector('#filename').value,
      selected: globalThis.document.querySelector('#selected').checked,
      exceptions: globalThis.document.querySelector('#exceptions').value,
    }));
    await app.evaluate(
      ({ dialog }, filename) => {
        globalThis.replacementChoices = [];
        globalThis.replacementPickers = 0;
        dialog.showMessageBox = async (_window, options) => {
          globalThis.replacementChoices.push({
            buttons: options.buttons,
            defaultId: options.defaultId,
            cancelId: options.cancelId,
          });
          return { response: 0, checkboxChecked: false };
        };
        dialog.showOpenDialog = async () => {
          globalThis.replacementPickers++;
          return { canceled: false, filePaths: [filename] };
        };
      },
      path.join(output, 'corpus.json'),
    );
    await page.locator('#' + target).click();
    await expect(page.locator('#status')).toContainText('Kept unsaved corpus edits');
    expect(
      await page.evaluate(() => ({
        source: globalThis.document.querySelector('#source').value,
        title: globalThis.document.querySelector('#title').value,
        metadata: globalThis.document.querySelector('#metadata').value,
        filename: globalThis.document.querySelector('#filename').value,
        selected: globalThis.document.querySelector('#selected').checked,
        exceptions: globalThis.document.querySelector('#exceptions').value,
      })),
    ).toEqual(before);
    expect(await app.evaluate(() => globalThis.replacementChoices)).toEqual([
      { buttons: ['Keep editing', 'Discard and replace'], defaultId: 0, cancelId: 0 },
    ]);
    expect(await app.evaluate(() => globalThis.replacementPickers)).toBe(0);
    expect(
      (await fs.readFile(path.join(profile, 'project.json'))).equals(
        savedBeforeReplacement,
      ),
    ).toBe(true);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await page.locator('#' + target).click();
    await expect(page.locator('#status')).toContainText(
      target === 'prepared'
        ? 'Prepared runbook loaded'
        : target === 'restore'
          ? 'Previous save loaded'
          : 'Imported data is staged',
    );
    const expected =
      target === 'restore'
        ? previousProject
        : target === 'import-project'
          ? exportedProject
          : null;
    await expect(page.locator('#title')).toHaveValue(
      expected?.title ?? 'Service recovery documentation review',
    );
    await expect(page.locator('#filename')).toHaveValue(
      expected?.documents[0].path ?? 'README.md',
    );
    if (expected) {
      await expect(page.locator('#source')).toHaveValue(expected.documents[0].text);
      await expect(page.locator('#metadata')).toHaveValue(
        expected.policy.requiredMetadata.join(', '),
      );
    } else {
      await expect(page.locator('#source')).toHaveValue(/# Recovery runbook/u);
      await expect(page.locator('#metadata')).toHaveValue('title, owner');
    }
    expect(
      (await fs.readFile(path.join(profile, 'project.json'))).equals(
        savedBeforeReplacement,
      ),
    ).toBe(true);
    replacementCases.push({
      target,
      keepPreservedAllFields: true,
      discardLoadedExpectedCorpus: true,
      replacementDoesNotSave: true,
    });
  }
  await finish(app);
  expect(
    (await fs.readFile(path.join(profile, 'project.json'))).equals(
      savedBeforeReplacement,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(exits).toEqual([0, 0]);
  await fs.writeFile(
    path.join(output, 'proof.json'),
    JSON.stringify(
      {
        passed: true,
        version: '1.1.1',
        visibleLaunches: 2,
        actualWorker: true,
        exactSourceLine: 7,
        retainedDebtEntries: 2,
        emptySelectionUnexamined: true,
        noOverwrite: true,
        customHtmlAndAttachment: true,
        unsavedQuitCanceled: true,
        heldQuit: true,
        wholeCorpusReplacementChoices: replacementCases,
        exits,
        pageErrors: errors,
        identities,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  console.log('Actual two-launch native corpus workflow passed.');
} catch (error) {
  await fs.writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ passed: false, error: String(error), errors, exits }, null, 2) +
      '\n',
    { flag: 'wx' },
  );
  if (active)
    await active
      .evaluate(({ app, dialog }) => {
        dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
        app.quit();
      })
      .catch(() => {});
  throw error;
}
