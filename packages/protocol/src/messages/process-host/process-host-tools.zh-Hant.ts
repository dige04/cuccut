import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const zhHant: ProcessHostToolsMessages = {
  hintMac: '例如 brew install ffmpeg',
  hintWindows: '例如 winget install --id Gyan.FFmpeg -e，安裝後重新開啟 CucCut',
  hintLinux: '例如 sudo apt install ffmpeg',
  hintDownload: (p) => `從 ${p.url} 下載`,
  remedyWithProbe: (p) => `安裝 ffmpeg（含 ffprobe；${p.hint}），或用環境變數 CUCCUT_FFMPEG / CUCCUT_FFPROBE 指定執行檔`,
  remedy: (p) => `安裝 ffmpeg（${p.hint}），或用 CUCCUT_FFMPEG 設定其路徑`,
  terminalBanner: (p) => `CucCut：正在執行 ${p.command}`,
};
