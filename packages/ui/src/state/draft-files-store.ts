import { create } from 'zustand';
import type { MessageFile } from '../host.ts';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@cuccut/protocol';

export type DraftFile = Pick<MessageFile, 'path' | 'kind'>;
const EMPTY: DraftFile[] = [];

interface DraftFilesStore {
  files: Record<string, DraftFile[]>;
  add(key: string, files: readonly DraftFile[]): number;
  remove(key: string, path: string): void;
  /** Clear only the references that were sent; files added during sending are kept. */
  sent(key: string, paths: readonly string[]): void;
}

/** Local file references are stored per session draft. They carry only paths and do not change the Agent's permission scope. */
export const useDraftFiles = create<DraftFilesStore>()((set, get) => ({
  files: {},
  add(key, incoming) {
    const next = [...(get().files[key] ?? EMPTY)];
    let rejected = 0;
    for (const file of incoming) {
      if (!file.path || next.some(entry => entry.path === file.path)) continue;
      if (next.length >= MAX_ATTACHMENTS_PER_MESSAGE) rejected++;
      else next.push({ path: file.path, kind: file.kind });
    }
    set(state => ({ files: { ...state.files, [key]: next } }));
    return rejected;
  },
  remove(key, path) { get().sent(key, [path]); },
  sent(key, paths) {
    const removed = new Set(paths);
    set(state => {
      const files = { ...state.files };
      const rest = (files[key] ?? EMPTY).filter(file => !removed.has(file.path));
      if (rest.length) files[key] = rest;
      else delete files[key];
      return { files };
    });
  },
}));

export function useDraftFileList(key: string): DraftFile[] {
  return useDraftFiles(state => state.files[key] ?? EMPTY);
}
