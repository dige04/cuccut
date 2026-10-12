import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const it: ProcessHostToolsMessages = {
  hintMac: "ad esempio, brew install ffmpeg",
  hintWindows: "ad esempio, winget install --id Gyan.FFmpeg -e, poi riapri CucCut",
  hintLinux: "ad esempio, sudo apt install ffmpeg",
  hintDownload: (p) => `scaricalo da ${p.url}`,
  remedyWithProbe: (p) => `Installa ffmpeg (include ffprobe; ${p.hint}), oppure indica gli eseguibili con le variabili d’ambiente CUCCUT_FFMPEG / CUCCUT_FFPROBE`,
  remedy: (p) => `Installa ffmpeg (${p.hint}), oppure imposta il percorso con CUCCUT_FFMPEG`,
  terminalBanner: (p) => `CucCut: esecuzione di ${p.command}`,
};
