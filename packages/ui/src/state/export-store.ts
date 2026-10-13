import { create } from 'zustand';
import type { Id } from '@cuccut/protocol';

/**
 * Export location (design draft export.jsx; architecture design §9.13 `ExportDestination.dir`). By default the Runtime decides (`exports/` under the project). On desktop, the final render exports to the folder that holds the original video (`ExportEnv.sourceDir`). A directory the user picked with "choose location" is remembered per video and reused for later exports during this run. Export progress is not here; it is in the job record in jobs-store.
 */
interface ExportPlaces {
  dirs: Record<Id, string>;
  setDir(videoId: Id, dir: string | null): void;
}

export const useExportPlaces = create<ExportPlaces>()((set) => ({
  dirs: {},
  setDir: (videoId, dir) =>
    set((s) => {
      const dirs = { ...s.dirs };
      if (dir) dirs[videoId] = dir;
      else delete dirs[videoId];
      return { dirs };
    }),
}));
