import type { ModelSourceMessages } from './model-source-copy.ts';

export const zhHans: ModelSourceMessages = {
  label: "下载来源",
  fold: "下载与存储",
  custom: "自定义",
  isDefault: "默认",
  msHint: "中国大陆通常更快",
  customHint: "填镜像的基址",
  hfDesc: "从 Hugging Face（huggingface.co）下载。",
  msDesc: "从 ModelScope（modelscope.cn）下载，中国大陆通常更快。",
  customDesc: "从镜像下载，文件按 Hugging Face 的路径提供。",
  msNote: "ModelScope 上没有的少数文件（whisper.cpp、GPT-SoVITS）仍从 Hugging Face 下载；每个文件都按内置的校验值核对。",
  pending: (current: string) => `填好地址并保存后改用它；现在仍从 ${current} 下载。`,
  envNote: (name: string) => `设了环境变量 ${name} 时以它为准。`,
  webNote: "浏览器里不能更改下载来源，请在 CucCut 桌面版里设置。",
  fieldLabel: "镜像的基址",
  save: "保存",
  changed: (source: string) => `下载来源已改为 ${source}`,
};
