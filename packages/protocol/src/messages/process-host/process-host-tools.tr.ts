import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const tr: ProcessHostToolsMessages = {
hintMac: 'örneğin brew install ffmpeg', hintWindows: 'örneğin winget install --id Gyan.FFmpeg -e, sonra CucCut yeniden açın', hintLinux: 'örneğin sudo apt install ffmpeg', hintDownload: (p) => `${p.url} kaynağından indirin`, remedyWithProbe: (p) => `ffmpeg yükleyin (ffprobe dahil; ${p.hint}) veya CUCCUT_FFMPEG / CUCCUT_FFPROBE ortam değişkenlerini çalıştırılabilir dosyalara yönlendirin`, remedy: (p) => `ffmpeg yükleyin (${p.hint}) veya CUCCUT_FFMPEG ile yolunu ayarlayın`, terminalBanner: (p) => `CucCut: çalıştırılıyor ${p.command}`,
};
