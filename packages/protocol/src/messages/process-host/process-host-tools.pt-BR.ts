import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const ptBR: ProcessHostToolsMessages = {
  hintMac: "por exemplo, brew install ffmpeg",
  hintWindows: "por exemplo, winget install --id Gyan.FFmpeg -e, depois reabra o CucCut",
  hintLinux: "por exemplo, sudo apt install ffmpeg",
  hintDownload: (p) => `baixe em ${p.url}`,
  remedyWithProbe: (p) => `Instale ffmpeg (inclui ffprobe; ${p.hint}), ou aponte as variáveis de ambiente CUCCUT_FFMPEG / CUCCUT_FFPROBE para os executáveis`,
  remedy: (p) => `Instale ffmpeg (${p.hint}), ou defina o caminho com CUCCUT_FFMPEG`,
  terminalBanner: (p) => `CucCut: executando ${p.command}`,
};
