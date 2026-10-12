import type { ModelSourceMessages } from './model-source-copy.ts';

export const tr: ModelSourceMessages = {
  label: "İndirme kaynağı",
  fold: "İndirme ve depolama",
  custom: "Özel",
  isDefault: "Varsayılan",
  msHint: "Çin anakarasında genellikle daha hızlı",
  customHint: "Bir yansının temel URL’sini girin",
  hfDesc: "Hugging Face’ten (huggingface.co) indir.",
  msDesc: "ModelScope’tan (modelscope.cn) indir; Çin anakarasında genellikle daha hızlı.",
  customDesc: "Dosyaları Hugging Face ile aynı yollarda sunan bir yansıdan indir.",
  msNote: "ModelScope’ta olmayan birkaç dosya (whisper.cpp, GPT-SoVITS) yine Hugging Face’ten gelir. Her dosya yerleşik sağlama toplamıyla denetlenir.",
  pending: (current: string) => `Geçmek için bir adres kaydedin. Şimdilik indirmeler hâlâ ${current} kaynağından geliyor.`,
  envNote: (name: string) => `${name} ortam değişkeni ayarlıysa o kullanılır.`,
  webNote: "Tarayıcı indirme kaynağını değiştiremez. Bunu CucCut masaüstü uygulamasında ayarlayın.",
  fieldLabel: "Yansı temel URL’si",
  save: "Kaydet",
  changed: (source: string) => `İndirme kaynağı ${source} olarak değiştirildi`,
};
