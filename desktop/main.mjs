/**
 * @file Genuine offline documentation authoring, exact findings and governed baseline review in an owned native app.
 * @description One private corpus, fixed scanner worker and retained real I/O; no repository execution or external-link requests.
 * @remarks Plaintext trusted-OS-owner workflow; selected documents and reports may contain confidential information.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session } from 'electron';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { openProfile } = require('./profile.cjs');
const { openState } = require('./state.cjs');
const { createOperations } = require('./operation.cjs');
const { runTask } = require('./tasks.cjs');
const { newFile, readUtf8, readRegular } = require('./files.cjs');
const { verifiedResources, responseFor } = require('./resources.cjs');
const owner = createOperations();
const ownerRoot = dirname(fileURLToPath(import.meta.url));
const resourceRoot = app.isPackaged
  ? join(process.resourcesPath, 'workbench')
  : resolve(
      process.env.DOCQUALITY_NATIVE_RESOURCES ??
        resolve(ownerRoot, '../.runtime/native-resources'),
    );
const flag = process.argv.indexOf('--profile');
const profilePath =
  flag < 0
    ? join(
        process.env.LOCALAPPDATA ?? app.getPath('appData'),
        'JasonStysPortfolio',
        'documentation-quality-gate',
        'workspace',
      )
    : process.argv[flag + 1];
let window,
  profile,
  store,
  api,
  startup,
  closing,
  exiting = false,
  dirty = false,
  lastAnalysis;
app.setName('Documentation Quality Workbench');
app.commandLine.appendSwitch('disable-background-networking');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'docquality',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

function sender(event) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !['docquality://workbench/', 'docquality://workbench/index.html'].includes(
      event.senderFrame.url,
    ) ||
    owner.closing
  )
    throw new Error('The active documentation window is required.');
}
function envelope(value) {
  if (
    !value ||
    Object.keys(value).sort().join('|') !== 'decision|project|schema' ||
    value.schema !== 1
  )
    throw new Error('Invalid corpus state.');
  const project = api.parseNativeProject(JSON.stringify(value.project));
  const decision = value.decision;
  if (
    decision !== null &&
    (!decision ||
      Object.keys(decision).sort().join('|') !== 'at|reason|reviewSha256' ||
      typeof decision.reason !== 'string' ||
      decision.reason.trim().length < 8 ||
      decision.reason.length > 1000 ||
      !/^[a-f0-9]{64}$/.test(decision.reviewSha256) ||
      typeof decision.at !== 'string' ||
      !Number.isFinite(Date.parse(decision.at)))
  )
    throw new Error('Invalid recorded baseline review.');
  return { schema: 1, project, decision };
}
function result() {
  return { ...store.load(), analysis: lastAnalysis ?? null, version: '1.1.0' };
}

async function request(operation, value) {
  if (operation === 'load' && value === null) return result();
  if (operation === 'prepared' && value === null) return api.preparedProject();
  if (operation === 'previous' && value === null) return store.previous().project;
  if (operation === 'save') {
    if (!value || Object.keys(value).sort().join('|') !== 'project|sha256')
      throw new Error('Invalid corpus save.');
    const project = api.parseNativeProject(JSON.stringify(value.project));
    store.save({ ...store.load().value, project }, value.sha256);
    lastAnalysis = undefined;
    dirty = false;
    return result();
  }
  if (operation === 'analyze' && value === null) {
    lastAnalysis = await runTask(
      join(resourceRoot, 'worker.cjs'),
      'analyze',
      store.load().value.project,
    );
    return result();
  }
  if (operation === 'accept') {
    if (
      !value ||
      Object.keys(value).sort().join('|') !== 'reason|reviewSha256' ||
      typeof value.reason !== 'string' ||
      value.reason.trim().length < 8 ||
      value.reason.length > 1000 ||
      !lastAnalysis ||
      value.reviewSha256 !== lastAnalysis.reviewSha256
    )
      throw new Error(
        'Review the exact current result and provide a meaningful debt-acceptance reason.',
      );
    const current = store.load();
    const project = await runTask(
      join(resourceRoot, 'worker.cjs'),
      'accept',
      current.value.project,
      value.reviewSha256,
    );
    store.save(
      {
        schema: 1,
        project,
        decision: {
          at: new Date().toISOString(),
          reason: value.reason.trim(),
          reviewSha256: value.reviewSha256,
        },
      },
      current.sha256,
    );
    lastAnalysis = await runTask(join(resourceRoot, 'worker.cjs'), 'analyze', project);
    return result();
  }
  if (operation === 'import' && ['project', 'document', 'attachment'].includes(value)) {
    const choice = await dialog.showOpenDialog(window, { properties: ['openFile'] });
    if (choice.canceled || choice.filePaths.length !== 1) return null;
    const name = choice.filePaths[0];
    if (value === 'project')
      return { project: api.parseNativeProject(readUtf8(name, 16 * 1024 * 1024)) };
    const fileName = name.replaceAll('\\', '/').split('/').at(-1);
    return value === 'document'
      ? { path: fileName, text: readUtf8(name, 1024 * 1024), selected: true }
      : { path: fileName, base64: readRegular(name, 1024 * 1024).toString('base64') };
  }
  if (operation === 'export' && ['project', 'json', 'sarif', 'html'].includes(value)) {
    if (
      value !== 'project' &&
      (!lastAnalysis ||
        lastAnalysis.projectSha256 !== api.projectFingerprint(store.load().value.project))
    )
      throw new Error('Analyze the current saved corpus before exporting its reports.');
    const text =
      value === 'project'
        ? JSON.stringify(store.load().value.project, null, 2) + '\n'
        : lastAnalysis.reports[value];
    const choice = await dialog.showSaveDialog(window, {
      defaultPath:
        value === 'project' ? 'documentation-corpus.json' : 'quality-review.' + value,
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (choice.canceled || !choice.filePath) return { canceled: true };
    newFile(choice.filePath, text);
    return { canceled: false };
  }
  if (operation === 'source') {
    if (
      !value ||
      Object.keys(value).sort().join('|') !== 'index|projectSha256' ||
      !Number.isSafeInteger(value.index) ||
      value.index < 0 ||
      !lastAnalysis ||
      value.projectSha256 !== lastAnalysis.projectSha256
    )
      throw new Error('Choose a current exact finding.');
    const diagnostic = lastAnalysis.diagnostics[value.index];
    if (!diagnostic) throw new Error('Finding is outside the current review.');
    return api.diagnosticSource(
      store.load().value.project,
      value.projectSha256,
      diagnostic,
    );
  }
  throw new Error('Unknown bounded workbench request.');
}

function closeOwned() {
  if (!closing)
    closing = (async () => {
      await startup;
      if (dirty) {
        const choice = await dialog.showMessageBox(window, {
          type: 'warning',
          message: 'Discard unsaved editor changes?',
          detail:
            'The last saved corpus remains intact. Choose Keep editing to save first.',
          buttons: ['Keep editing', 'Discard and exit'],
          defaultId: 0,
          cancelId: 0,
        });
        if (choice.response !== 1) {
          closing = undefined;
          return;
        }
      }
      window?.webContents.send('quality:closing');
      window?.setTitle('Documentation Workbench — finishing accepted local work');
      await owner.finish();
      session.defaultSession.flushStorageData();
      profile.close();
      exiting = true;
      app.quit();
    })().catch(() => {
      process.exitCode = 1;
      dialog.showErrorBox(
        'Workspace requires review',
        'An owned operation or shutdown did not finish normally. Existing data and lock evidence were preserved.',
      );
    });
  return closing;
}
app.on('before-quit', (event) => {
  if (!exiting) {
    event.preventDefault();
    void closeOwned();
  }
});
app.on('window-all-closed', () => {
  if (!exiting) void closeOwned();
});
try {
  if (typeof profilePath !== 'string')
    throw new Error('An absolute profile is required.');
  profile = openProfile(profilePath, [
    dirname(process.execPath),
    process.resourcesPath,
    app.getAppPath(),
  ]);
  app.setPath('userData', profile.browser);
  if (!app.requestSingleInstanceLock())
    throw new Error('The native workspace already has an owner.');
  startup = app.whenReady().then(async () => {
    const resources = verifiedResources(resourceRoot, ownerRoot);
    api = require(join(resourceRoot, 'api.cjs'));
    store = openState(profile.directory, envelope, {
      schema: 1,
      project: api.preparedProject(),
      decision: null,
    });
    protocol.handle('docquality', (event) => responseFor(event, resources.data));
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: !details.url.startsWith('docquality://workbench/') }),
    );
    session.defaultSession.on('will-download', (event) => event.preventDefault());
    window = new BrowserWindow({
      width: 1480,
      height: 980,
      minWidth: 980,
      minHeight: 700,
      show: false,
      title: 'Documentation Quality Workbench | Jason Stys | 1.1.0',
      webPreferences: {
        preload: join(ownerRoot, 'preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: false,
        webSecurity: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.on('close', (event) => {
      if (!exiting) {
        event.preventDefault();
        void closeOwned();
      }
    });
    ipcMain.handle('quality:request', (event, operation, value) => {
      sender(event);
      return owner.run(async () => {
        try {
          return { success: true, value: await request(operation, value) };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : 'Local operation was refused.',
          };
        }
      });
    });
    ipcMain.handle('quality:dirty', (event, value) => {
      sender(event);
      if (typeof value !== 'boolean') throw new Error('Invalid edit state.');
      dirty = value;
    });
    let readyResolve;
    const ready = new Promise((resolve) => {
      readyResolve = resolve;
    });
    ipcMain.handle('quality:ready', (event) => {
      sender(event);
      readyResolve();
    });
    ipcMain.handle('quality:quit', (event) => {
      sender(event);
      void closeOwned();
    });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'Workbench',
          submenu: [
            {
              label: 'Help',
              click: () => {
                void dialog.showMessageBox(window, {
                  message: 'Documentation Quality Workbench — Jason Stys',
                  detail:
                    'Edit Markdown/HTML and policy, save, then analyze with the original quality engine. Click findings for exact saved source. Accepted debt stays visible; baseline acceptance is not a clean-document claim. Import only authorized files. Project data is plaintext under your OS account. No document scripts, external links or repository commands run. github.com/JasonStys',
                });
              },
            },
            {
              label: 'Exit application',
              click: () => {
                void closeOwned();
              },
            },
          ],
        },
        { role: 'editMenu' },
      ]),
    );
    await window.loadURL('docquality://workbench/');
    await Promise.race([
      ready,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Actual workbench readiness failed.')), 30000),
      ),
    ]);
    window.show();
  });
  startup.catch(() => {
    process.exitCode = 1;
    dialog.showErrorBox(
      'Workbench did not start',
      'The source, private profile or actual application could not be opened. Existing files were preserved.',
    );
    exiting = true;
    profile?.close();
    app.quit();
  });
} catch {
  process.exitCode = 1;
  dialog.showErrorBox(
    'Private workspace was refused',
    'Choose an empty or identified ordinary local profile outside application resources. Existing data and ownership evidence were preserved.',
  );
  exiting = true;
  app.quit();
}
