import type { ModelSourceMessages } from './model-source-copy.ts';

export const ja: ModelSourceMessages = {
  label: "ダウンロード元",
  fold: "ダウンロードと保存",
  custom: "カスタム",
  isDefault: "既定",
  msHint: "中国本土では通常より高速",
  customHint: "ミラーのベース URL を入力",
  hfDesc: "Hugging Face（huggingface.co）からダウンロードします。",
  msDesc: "ModelScope（modelscope.cn）からダウンロードします。中国本土では通常より高速です。",
  customDesc: "Hugging Face と同じパスでファイルを提供するミラーからダウンロードします。",
  msNote: "ModelScope にない一部のファイル（whisper.cpp、GPT-SoVITS）は引き続き Hugging Face からダウンロードします。どのファイルも内蔵のチェックサムで照合します。",
  pending: (current: string) => `アドレスを入力して保存すると切り替わります。現在は引き続き ${current} からダウンロードします。`,
  envNote: (name: string) => `環境変数 ${name} が設定されている場合はそちらが優先されます。`,
  webNote: "ブラウザーではダウンロード元を変更できません。CucCut デスクトップアプリで設定してください。",
  fieldLabel: "ミラーのベース URL",
  save: "保存",
  changed: (source: string) => `ダウンロード元を ${source} に変更しました`,
};
