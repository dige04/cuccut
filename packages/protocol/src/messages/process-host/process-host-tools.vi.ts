import type { ProcessHostToolsMessages } from './process-host-tools.ts';

export const vi: ProcessHostToolsMessages = {
hintMac: 'ví dụ brew install ffmpeg', hintWindows: 'ví dụ winget install --id Gyan.FFmpeg -e rồi mở lại CucCut', hintLinux: 'ví dụ sudo apt install ffmpeg', hintDownload: (p) => `tải từ ${p.url}`, remedyWithProbe: (p) => `Cài ffmpeg (kèm ffprobe; ${p.hint}) hoặc trỏ biến môi trường CUCCUT_FFMPEG / CUCCUT_FFPROBE đến tệp chạy`, remedy: (p) => `Cài ffmpeg (${p.hint}) hoặc đặt đường dẫn bằng CUCCUT_FFMPEG`, terminalBanner: (p) => `CucCut: đang chạy ${p.command}`,
};
