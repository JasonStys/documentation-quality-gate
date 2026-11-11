/**
 * @file Complete local documentation editor and governed review workflow.
 * @description Text-only rendering, exact saved-source navigation and explicit stale-result boundaries.
 * @remarks Imported HTML and diagnostic strings are never inserted as markup or executed.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import type { NativeProject } from '../../src/workbench/project.js';
import type { NativeAnalysis } from '../../src/workbench/analysis.js';

interface Saved {
  value: {
    schema: 1;
    project: NativeProject;
    decision: { at: string; reason: string; reviewSha256: string } | null;
  };
  sha256: string;
  hasPrevious: boolean;
  analysis: NativeAnalysis | null;
  version: string;
}
declare global {
  interface Window {
    docQuality: {
      request: (operation: string, value: unknown) => Promise<unknown>;
      changed: (value: boolean) => Promise<void>;
      ready: () => Promise<void>;
      quit: () => Promise<void>;
      onClosing: (handler: () => void) => void;
    };
  }
}
const bridge = window.docQuality;
let project: NativeProject;
let saved: Saved;
let current = 0;
let dirty = false;
let busy = false;

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error('Required application control is absent.');
  return value as T;
}
const input = (id: string): HTMLInputElement => element(id);
const area = (id: string): HTMLTextAreaElement => element(id);
const button = (id: string): HTMLButtonElement => element(id);
function message(text: string, error = false): void {
  element('status').textContent = text;
  element('status').dataset.error = String(error);
}
async function call<T>(operation: string, value: unknown = null): Promise<T> {
  const response = await bridge.request(operation, value);
  if (!response || typeof response !== 'object' || !('success' in response))
    throw new Error('The native owner did not return a complete response.');
  if (response.success !== true)
    throw new Error(
      'error' in response && typeof response.error === 'string'
        ? response.error
        : 'The local operation was refused.',
    );
  if (!('value' in response)) throw new Error('The native response is incomplete.');
  return response.value as T;
}
function controls(): void {
  for (const control of document.querySelectorAll<
    HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('button,input,textarea,select'))
    control.disabled = busy;
  for (const control of document.querySelectorAll<HTMLButtonElement>('.finding'))
    control.disabled = busy || dirty;
  button('analyze').disabled = busy || dirty;
  button('accept').disabled =
    busy || dirty || !saved?.analysis || saved.analysis.status === 'empty-selection';
  button('restore').disabled = busy || !saved?.hasPrevious;
  for (const control of document.querySelectorAll<HTMLButtonElement>('[data-export]'))
    control.disabled =
      busy || dirty || (control.dataset.export !== 'project' && !saved?.analysis);
}
async function work(action: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  controls();
  try {
    await action();
  } catch (error) {
    message(
      error instanceof Error ? error.message : 'Local operation was refused.',
      true,
    );
  } finally {
    busy = false;
    controls();
  }
}
function changed(): void {
  dirty = true;
  void bridge.changed(true);
  element('inspection').hidden = true;
  message(
    'Unsaved changes — save, then analyze again. Previous results cannot be used for source navigation or debt acceptance.',
  );
  controls();
  renderReview();
}
function capture(): void {
  const file = project.documents[current];
  if (!file) return;
  file.path = input('filename').value;
  file.text = area('source').value;
  file.selected = input('selected').checked;
  project.title = input('title').value;
  project.policy.requiredMetadata = input('metadata')
    .value.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  project.policy.failOn = element<HTMLSelectElement>('threshold')
    .value as NativeProject['policy']['failOn'];
}
function exceptions(): void {
  const value: unknown = JSON.parse(area('exceptions').value);
  // The owner performs the strict actual schema validation before any state or snapshot write.
  project.policy.suppressions = value as NativeProject['policy']['suppressions'];
}
function renderFiles(): void {
  const list = element('documents');
  list.replaceChildren();
  project.documents.forEach((file, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = (file.selected ? '● ' : '○ ') + file.path;
    item.setAttribute('aria-current', String(index === current));
    item.addEventListener('click', () => {
      capture();
      current = index;
      renderFiles();
      renderEditor();
    });
    list.append(item);
  });
  const attachments = element('attachments');
  attachments.replaceChildren();
  project.attachments.forEach((file, index) => {
    const row = document.createElement('li');
    row.textContent = file.path;
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      project.attachments.splice(index, 1);
      changed();
      renderFiles();
    });
    row.append(remove);
    attachments.append(row);
  });
}
function renderEditor(): void {
  const file = project.documents[current];
  if (!file) throw new Error('A document must remain in the corpus.');
  input('filename').value = file.path;
  input('selected').checked = file.selected;
  area('source').value = file.text;
}
function renderReview(): void {
  const analysis = saved?.analysis;
  element('findings').replaceChildren();
  element('baseline').replaceChildren();
  if (!analysis) {
    element('summary').textContent = 'Save and analyze to create a review.';
    element('debt').textContent = 'No current baseline review.';
    return;
  }
  element('summary').textContent =
    (dirty ? 'STALE · ' : '') +
    analysis.status.toUpperCase() +
    ' · ' +
    (analysis.failed ? 'Gate fails' : 'Gate passes') +
    '\n' +
    analysis.summary.files +
    ' parsed files · ' +
    analysis.summary.errors +
    ' errors · ' +
    analysis.summary.warnings +
    ' warnings · ' +
    analysis.summary.suppressed +
    ' accepted/excepted';
  const query = input('search').value.toLowerCase();
  analysis.diagnostics.forEach((finding, index) => {
    if (
      (!input('show-suppressed').checked && finding.suppressed) ||
      !`${finding.ruleId} ${finding.file} ${finding.message}`
        .toLowerCase()
        .includes(query)
    )
      return;
    const row = document.createElement('button');
    row.className = 'finding' + (finding.suppressed ? ' accepted' : '');
    row.disabled = dirty || busy;
    const title = document.createElement('strong');
    title.textContent = `${finding.ruleId} · ${finding.severity} · ${finding.file}:${finding.location.line}:${finding.location.column}`;
    const text = document.createElement('span');
    text.textContent = finding.message;
    const advice = document.createElement('span');
    advice.textContent =
      finding.remediation +
      (finding.suppressed ? ' · Accepted/excepted — retained, not fixed.' : '');
    row.append(title, text, advice);
    row.addEventListener('click', () => {
      void work(async () => {
        const source = await call<{ text: string; line: number; column: number } | null>(
          'source',
          { index, projectSha256: analysis.projectSha256 },
        );
        if (!source)
          throw new Error('This finding has no text source in the current corpus.');
        element('inspection').hidden = false;
        element('inspection-title').textContent =
          `${finding.file}:${source.line}:${source.column} · exact saved source`;
        const editor = area('inspection-source');
        editor.value = source.text;
        const lines = source.text.split(/\r?\n/u);
        const start = lines
          .slice(0, source.line - 1)
          .reduce((total, line) => total + line.length + 1, 0);
        editor.focus();
        editor.setSelectionRange(start, start + (lines[source.line - 1]?.length ?? 0));
        editor.scrollTop = Math.max(0, (source.line - 4) * 24);
        element('inspection').scrollIntoView({ block: 'nearest' });
      });
    });
    element('findings').append(row);
  });
  const entries = analysis.baselineReview?.entries ?? [];
  const retained = saved.value.project.baseline?.entries.length ?? 0;
  const candidates = entries.filter((entry) => entry.state === 'new').length;
  element('debt').textContent = retained
    ? retained + ' retained baseline entries. Unexamined is not proof of repair.'
    : 'No accepted baseline debt. ' + candidates + ' new candidate findings for review.';
  for (const entry of entries) {
    const li = document.createElement('li');
    li.textContent = `${entry.ruleId} · ${entry.path}:${entry.line} · ${entry.state}`;
    element('baseline').append(li);
  }
}
function adopt(value: Saved): void {
  saved = value;
  project = structuredClone(value.value.project);
  current = Math.min(current, project.documents.length - 1);
  dirty = false;
  void bridge.changed(false);
  input('title').value = project.title;
  input('metadata').value = project.policy.requiredMetadata.join(', ');
  element<HTMLSelectElement>('threshold').value = project.policy.failOn;
  area('exceptions').value = JSON.stringify(project.policy.suppressions, null, 2);
  element('decision').textContent = value.value.decision
    ? `Last recorded debt decision: ${value.value.decision.at} · ${value.value.decision.reason}`
    : 'No debt-acceptance decision has been recorded.';
  renderFiles();
  renderEditor();
  renderReview();
  controls();
}
function replaceProject(value: NativeProject): void {
  project = structuredClone(value);
  current = 0;
  input('title').value = project.title;
  input('metadata').value = project.policy.requiredMetadata.join(', ');
  element<HTMLSelectElement>('threshold').value = project.policy.failOn;
  area('exceptions').value = JSON.stringify(project.policy.suppressions, null, 2);
  renderFiles();
  renderEditor();
  changed();
}
async function allowReplacement(
  target: 'prepared' | 'previous' | 'import-project',
): Promise<boolean> {
  if (!dirty) return true;
  const confirmed = await call<boolean>('discard-replacement', target);
  if (!confirmed) message('Kept unsaved corpus edits. No replacement was loaded.');
  return confirmed;
}
for (const id of [
  'title',
  'metadata',
  'threshold',
  'filename',
  'selected',
  'source',
  'exceptions',
])
  element(id).addEventListener('input', () => {
    capture();
    changed();
    if (id === 'filename' || id === 'selected') renderFiles();
  });
button('save').addEventListener('click', () => {
  void work(async () => {
    capture();
    exceptions();
    adopt(await call<Saved>('save', { project, sha256: saved.sha256 }));
    message('Corpus saved. Analyze to review this exact revision.');
  });
});
button('analyze').addEventListener('click', () => {
  void work(async () => {
    adopt(await call<Saved>('analyze'));
    message('Actual quality scan completed. Review findings and retained debt below.');
  });
});
button('prepared').addEventListener('click', () => {
  void work(async () => {
    if (!(await allowReplacement('prepared'))) return;
    replaceProject(await call<NativeProject>('prepared'));
    message('Prepared runbook loaded into the full editor. Save to apply it.');
  });
});
button('restore').addEventListener('click', () => {
  void work(async () => {
    if (!(await allowReplacement('previous'))) return;
    replaceProject(await call<NativeProject>('previous'));
    message('Previous save loaded for inspection. Save explicitly to restore it.');
  });
});
button('add').addEventListener('click', () => {
  capture();
  project.documents.push({
    path: `docs/document-${project.documents.length + 1}.md`,
    text: '---\ntitle: New document\nowner: Documentation team\n---\n# New document\n',
    selected: true,
  });
  current = project.documents.length - 1;
  renderFiles();
  renderEditor();
  changed();
});
button('remove').addEventListener('click', () => {
  if (project.documents.length === 1) {
    message(
      'Keep at least one document; uncheck it for an explicit empty selection.',
      true,
    );
    return;
  }
  project.documents.splice(current, 1);
  current = 0;
  renderFiles();
  renderEditor();
  changed();
});
for (const kind of ['project', 'document', 'attachment'] as const)
  button('import-' + kind).addEventListener('click', () => {
    void work(async () => {
      if (kind === 'project' && !(await allowReplacement('import-project'))) return;
      const value = await call<
        | null
        | { project: NativeProject }
        | NativeProject['documents'][number]
        | NativeProject['attachments'][number]
      >('import', kind);
      if (!value) {
        message('Import canceled; current corpus preserved.');
        return;
      }
      capture();
      if ('project' in value) replaceProject(value.project);
      else if ('text' in value) {
        project.documents.push(value);
        current = project.documents.length - 1;
        renderFiles();
        renderEditor();
        changed();
      } else {
        project.attachments.push(value);
        renderFiles();
        changed();
      }
      message('Imported data is staged for review. Save to validate and apply it.');
    });
  });
button('accept').addEventListener('click', () => {
  void work(async () => {
    if (!saved.analysis) throw new Error('Analyze the saved corpus first.');
    adopt(
      await call<Saved>('accept', {
        reason: area('reason').value,
        reviewSha256: saved.analysis.reviewSha256,
      }),
    );
    message(
      'Exact reviewed debt accepted and reanalyzed. Retained findings remain visible.',
    );
  });
});
for (const control of document.querySelectorAll<HTMLButtonElement>('[data-export]'))
  control.addEventListener('click', () => {
    void work(async () => {
      const result = await call<{ canceled: boolean }>('export', control.dataset.export);
      message(
        result.canceled
          ? 'Export canceled; no file changed.'
          : 'A new evidence file was written. Existing files were preserved.',
      );
    });
  });
input('search').addEventListener('input', renderReview);
input('show-suppressed').addEventListener('input', renderReview);
button('close-inspection').addEventListener('click', () => {
  element('inspection').hidden = true;
});
button('help').addEventListener('click', () => {
  element('help-panel').hidden = !element('help-panel').hidden;
});
button('quit').addEventListener('click', () => {
  void bridge.quit();
});
bridge.onClosing(() => {
  busy = true;
  controls();
  message('Finishing accepted local work before closing the owned workspace…');
});
void work(async () => {
  adopt(await call<Saved>('load'));
  message(
    'Private corpus ready. Edit, save and analyze; the full workflow is available offline.',
  );
  await bridge.ready();
});
