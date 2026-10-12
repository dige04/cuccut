import type { JobsGeneratedImportMessages } from './generated-import.ts';

export const tr: JobsGeneratedImportMessages = {
  voiceOverName: (p: { head: string }) => `Dublaj: ${p.head}`,
  imageName: (p: { head: string }) => `Görsel: ${p.head}`,
  musicName: (p: { head: string }) => `Müzik: ${p.head}`,
};
