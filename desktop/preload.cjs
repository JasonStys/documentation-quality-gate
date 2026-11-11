/**
 * @file Closed main-frame application requests; no Node, raw IPC or arbitrary host paths are exposed.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'docQuality',
  Object.freeze({
    request: (operation, value) =>
      ipcRenderer.invoke('quality:request', operation, value),
    changed: (value) => ipcRenderer.invoke('quality:dirty', value),
    ready: () => ipcRenderer.invoke('quality:ready'),
    quit: () => ipcRenderer.invoke('quality:quit'),
    onClosing: (handler) => {
      const listener = () => handler();
      ipcRenderer.on('quality:closing', listener);
    },
  }),
);
