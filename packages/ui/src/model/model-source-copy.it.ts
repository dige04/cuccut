import type { ModelSourceMessages } from './model-source-copy.ts';

export const it: ModelSourceMessages = {
  label: "Origine del download",
  fold: "Download e archiviazione",
  custom: "Personalizzata",
  isDefault: "Predefinita",
  msHint: "Di solito più veloce nella Cina continentale",
  customHint: "Inserisci l’URL di base di un mirror",
  hfDesc: "Scarica da Hugging Face (huggingface.co).",
  msDesc: "Scarica da ModelScope (modelscope.cn), di solito più veloce nella Cina continentale.",
  customDesc: "Scarica da un mirror che fornisce i file agli stessi percorsi di Hugging Face.",
  msNote: "I pochi file che ModelScope non ha (whisper.cpp, GPT-SoVITS) vengono ancora scaricati da Hugging Face. Ogni file viene verificato con il checksum integrato.",
  pending: (current: string) => `Salva un indirizzo per passare a quello. Per ora i download arrivano ancora da ${current}.`,
  envNote: (name: string) => `Se è impostata la variabile d’ambiente ${name}, viene usata quella.`,
  webNote: "Un browser non può cambiare l’origine del download. Impostala nell’app desktop di CucCut.",
  fieldLabel: "URL di base del mirror",
  save: "Salva",
  changed: (source: string) => `Origine del download cambiata in ${source}`,
};
