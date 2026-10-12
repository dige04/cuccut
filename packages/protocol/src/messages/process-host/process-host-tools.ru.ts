import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const ru: ProcessHostToolsMessages = {
  hintMac: "например, brew install ffmpeg",
  hintWindows: "например, winget install --id Gyan.FFmpeg -e, затем снова откройте CucCut",
  hintLinux: "например, sudo apt install ffmpeg",
  hintDownload: (p) => `скачайте с ${p.url}`,
  remedyWithProbe: (p) => `Установите ffmpeg (включает ffprobe; ${p.hint}) или укажите исполняемые файлы в переменных окружения CUCCUT_FFMPEG / CUCCUT_FFPROBE`,
  remedy: (p) => `Установите ffmpeg (${p.hint}) или задайте путь к нему через CUCCUT_FFMPEG`,
  terminalBanner: (p) => `CucCut: выполнение ${p.command}`,
};
