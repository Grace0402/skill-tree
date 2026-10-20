import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppInfo,
  CreateNodeInput,
  DiaryInput,
  DiaryUpdateInput,
  Result,
  SkillTreeApi,
  SuggestDifficultyResult,
  TreeSnapshot,
  UpdateNodeInput,
} from '../shared/types'

const api: SkillTreeApi = {
  getSnapshot: () => ipcRenderer.invoke('tree:get'),
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  createNode: (input: CreateNodeInput) => ipcRenderer.invoke('node:create', input),
  updateNode: (input: UpdateNodeInput) => ipcRenderer.invoke('node:update', input),
  renameNode: (id: string, name: string) => ipcRenderer.invoke('node:rename', id, name),
  setLit: (id: string, lit: boolean) => ipcRenderer.invoke('node:set-lit', id, lit),
  archiveNode: (id: string) => ipcRenderer.invoke('node:archive', id),
  restoreArchived: (archivedId: string) =>
    ipcRenderer.invoke('archive:restore', archivedId),

  writeDiary: (input: DiaryInput) => ipcRenderer.invoke('diary:write', input),
  updateDiary: (input: DiaryUpdateInput) => ipcRenderer.invoke('diary:update', input),
  deleteDiary: (id: string, name: string) => ipcRenderer.invoke('diary:delete', id, name),

  saveConfig: (patch) => ipcRenderer.invoke('config:save', patch),
  suggestDifficulty: (description: string, name: string): Promise<Result<SuggestDifficultyResult>> =>
    ipcRenderer.invoke('ai:suggest', description, name),
  aiStatus: () => ipcRenderer.invoke('ai:status'),

  chooseDataDir: () => ipcRenderer.invoke('data:choose'),
  openDataDir: () => ipcRenderer.invoke('data:open'),
  revealNode: (id: string) => ipcRenderer.invoke('node:reveal', id),
  copyNodePath: (id: string) => ipcRenderer.invoke('node:copy-path', id),

  minimizeWindow: () => ipcRenderer.send('win:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('win:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('win:close'),
  isWindowMaximized: () => ipcRenderer.invoke('win:is-maximized'),

  onTreeChanged: (cb: (snapshot: TreeSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: TreeSnapshot): void => cb(snapshot)
    ipcRenderer.on('tree:changed', listener)
    return () => ipcRenderer.removeListener('tree:changed', listener)
  },
  onWindowMaximized: (cb: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean): void => cb(maximized)
    ipcRenderer.on('win:maximized', listener)
    return () => ipcRenderer.removeListener('win:maximized', listener)
  },
}

contextBridge.exposeInMainWorld('skillTree', api)
