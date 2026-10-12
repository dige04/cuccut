import type { ModelSourceMessages } from './model-source-copy.ts';

export const zhHant: ModelSourceMessages = {
  label: "下載來源",
  fold: "下載與儲存",
  custom: "自訂",
  isDefault: "預設",
  msHint: "中國大陸通常較快",
  customHint: "填寫鏡像的基址",
  hfDesc: "從 Hugging Face（huggingface.co）下載。",
  msDesc: "從 ModelScope（modelscope.cn）下載，中國大陸通常較快。",
  customDesc: "從鏡像下載，檔案按 Hugging Face 的路徑提供。",
  msNote: "ModelScope 上沒有的少數檔案（whisper.cpp、GPT-SoVITS）仍從 Hugging Face 下載；每個檔案都按內建的校驗值核對。",
  pending: (current: string) => `填好位址並儲存後改用它；目前仍從 ${current} 下載。`,
  envNote: (name: string) => `設定了環境變數 ${name} 時以它為準。`,
  webNote: "瀏覽器中無法變更下載來源，請在 CucCut 桌面版中設定。",
  fieldLabel: "鏡像的基址",
  save: "儲存",
  changed: (source: string) => `下載來源已改為 ${source}`,
};
