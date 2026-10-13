import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const zhHant: RuntimeStoragePublishingMessages = {
  unreadable:
    "Publishing data couldn't be read. CucCut left the file as it is and won't change it. Restore it from a backup, or move it aside to start over.",
  newerVersion: 'Publishing data was saved by a newer version of CucCut. Update CucCut to change it; until then you can only view it.',
  conflict: 'This publication changed elsewhere. Reload the saved version before applying your changes.',
  settingsConflict: 'Publishing settings changed elsewhere. Reload them before saving.',
  notFound: 'This publication no longer exists.',
  invalidRecord: "This change would leave a publishing record incomplete, so it wasn't saved. Check the values and try again.",
  writeFailed: "Publishing data couldn't be saved to disk. Check that the disk has space and CucCut can write to its folder, then try again.",
};
