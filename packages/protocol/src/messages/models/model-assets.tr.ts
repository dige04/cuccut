import type { ModelsModelAssetsMessages } from './model-assets.ts';

export const tr: ModelsModelAssetsMessages = {
  appFileMissing: (p: { what: string }) => `Uygulamayla gelen ${p.what} eksik veya okunamıyor; CucCut tam yüklenmemiş. CucCut uygulamasını yeniden yükleyin`,
};
