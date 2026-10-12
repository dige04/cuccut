import type { JobsGeneratedImportMessages } from './generated-import.ts';

export const zhHans: JobsGeneratedImportMessages = {
  voiceOverName: (p: { head: string }) => `配音：${p.head}`,
  imageName: (p: { head: string }) => `图片：${p.head}`,
  musicName: (p: { head: string }) => `音乐：${p.head}`,
};
