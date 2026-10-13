import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const zhHans: RuntimeStoragePublishingMessages = {
  unreadable: "无法读取发布数据。CucCut 保持该文件不变，也不会修改它。请从备份中恢复，或将其移开以重新开始。",
  newerVersion: "发布数据由更新版本的 CucCut 保存。请更新 CucCut 后再进行更改；在此之前您只能查看。",
  conflict: "此发布已在别处被更改。请先重新加载已保存的版本，再应用您的更改。",
  settingsConflict: "发布设置已在别处被更改。保存前请先重新加载。",
  notFound: "此发布已不存在。",
  invalidRecord: "此更改会使发布记录不完整，因此未保存。请检查数值后重试。",
  writeFailed: "无法将发布数据保存到磁盘。请检查磁盘空间是否充足，以及 CucCut 是否有权写入其文件夹，然后重试。",
};
