import type { ModelsModelAssetsMessages } from './model-assets.ts';

export const ja: ModelsModelAssetsMessages = {
  appFileMissing: (p: { what: string }) =>
    `アプリに付属の ${p.what} が見つからないか読み取れないため、CucCut のインストールが不完全です。CucCut を再インストールしてください`,
};
