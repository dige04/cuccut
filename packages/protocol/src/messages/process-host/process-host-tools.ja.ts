import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const ja: ProcessHostToolsMessages = {
  hintMac: '例：brew install ffmpeg',
  hintWindows: '例：winget install --id Gyan.FFmpeg -e を実行してから CucCut を開き直す',
  hintLinux: '例：sudo apt install ffmpeg',
  hintDownload: (p) => `${p.url} からダウンロード`,
  remedyWithProbe: (p) =>
    `ffmpeg（ffprobe 同梱、${p.hint}）をインストールするか、環境変数 CUCCUT_FFMPEG / CUCCUT_FFPROBE で実行ファイルを指定してください`,
  remedy: (p) => `ffmpeg（${p.hint}）をインストールするか、CUCCUT_FFMPEG でパスを指定してください`,
  terminalBanner: (p) => `CucCut：${p.command} を実行中`,
};
