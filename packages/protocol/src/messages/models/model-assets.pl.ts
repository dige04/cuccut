import type { ModelsModelAssetsMessages } from './model-assets.ts';

export const pl: ModelsModelAssetsMessages = {
  appFileMissing: (p: { what: string }) => `Dołączony do aplikacji komponent ${p.what} nie istnieje lub jest nieczytelny, więc instalacja CucCut jest niepełna. Zainstaluj CucCut ponownie`,
};
