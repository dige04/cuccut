import type { ModelsModelAssetsMessages } from './model-assets.ts';

export const de: ModelsModelAssetsMessages = {
  appFileMissing: (p: { what: string }) => `${p.what} aus der App fehlt oder ist nicht lesbar. CucCut ist daher nicht vollständig installiert. CucCut erneut installieren`,
};
