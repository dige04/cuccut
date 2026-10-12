import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const pl: ProcessHostToolsMessages = {
  hintMac: "na przykład brew install ffmpeg",
  hintWindows: "na przykład winget install --id Gyan.FFmpeg -e, a następnie otwórz CucCut ponownie",
  hintLinux: "na przykład sudo apt install ffmpeg",
  hintDownload: (p) => `pobierz z ${p.url}`,
  remedyWithProbe: (p) => `Zainstaluj ffmpeg (zawiera ffprobe; ${p.hint}) lub wskaż pliki wykonywalne w zmiennych środowiskowych CUCCUT_FFMPEG / CUCCUT_FFPROBE`,
  remedy: (p) => `Zainstaluj ffmpeg (${p.hint}) lub ustaw jego ścieżkę przez CUCCUT_FFMPEG`,
  terminalBanner: (p) => `CucCut: uruchamianie ${p.command}`,
};
