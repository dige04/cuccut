import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const zhHant: RuntimeStoragePublishingMessages = {
  unreadable: "無法讀取發布資料。CucCut 保持該檔案不變，也不會修改它。請從備份還原，或將其移開以重新開始。",
  newerVersion: "發布資料由較新版本的 CucCut 儲存。請更新 CucCut 後再進行變更；在此之前您只能檢視。",
  conflict: "此發布已在別處被變更。請先重新載入已儲存的版本，再套用您的變更。",
  settingsConflict: "發布設定已在別處被變更。儲存前請先重新載入。",
  notFound: "此發布已不存在。",
  invalidRecord: "此變更會使發布紀錄不完整，因此未儲存。請檢查數值後重試。",
  writeFailed: "無法將發布資料儲存到磁碟。請檢查磁碟空間是否充足，以及 CucCut 是否有權寫入其資料夾，然後重試。",
};
