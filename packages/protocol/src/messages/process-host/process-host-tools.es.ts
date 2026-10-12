import type { ProcessHostToolsMessages } from './process-host-tools.ts';
export const es: ProcessHostToolsMessages = {
 hintMac: 'por ejemplo, brew install ffmpeg', hintWindows: 'por ejemplo, winget install --id Gyan.FFmpeg -e y después vuelve a abrir CucCut', hintLinux: 'por ejemplo, sudo apt install ffmpeg', hintDownload: (p) => `descárgalo de ${p.url}`,
 remedyWithProbe: (p) => `Instala ffmpeg (incluye ffprobe; ${p.hint}) o apunta las variables de entorno CUCCUT_FFMPEG / CUCCUT_FFPROBE a los ejecutables`, remedy: (p) => `Instala ffmpeg (${p.hint}) o establece su ruta con CUCCUT_FFMPEG`, terminalBanner: (p) => `CucCut: ejecutando ${p.command}`,
};
