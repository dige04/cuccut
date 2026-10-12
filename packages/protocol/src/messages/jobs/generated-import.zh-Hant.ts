import type { JobsGeneratedImportMessages } from './generated-import.ts';

export const zhHant: JobsGeneratedImportMessages = {
  voiceOverName: (p: { head: string }) => `配音：${p.head}`,
  imageName: (p: { head: string }) => `圖片：${p.head}`,
  musicName: (p: { head: string }) => `音樂：${p.head}`,
};
