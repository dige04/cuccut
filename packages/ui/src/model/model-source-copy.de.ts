import type { ModelSourceMessages } from './model-source-copy.ts';

export const de: ModelSourceMessages = {
  label: "Downloadquelle",
  fold: "Download und Speicher",
  custom: "Benutzerdefiniert",
  isDefault: "Standard",
  msHint: "In Festlandchina meist schneller",
  customHint: "Basis-URL eines Spiegels eingeben",
  hfDesc: "Von Hugging Face (huggingface.co) herunterladen.",
  msDesc: "Von ModelScope (modelscope.cn) herunterladen, in Festlandchina meist schneller.",
  customDesc: "Von einem Spiegel herunterladen, der die Dateien unter denselben Pfaden wie Hugging Face bereitstellt.",
  msNote: "Die wenigen Dateien, die ModelScope nicht hat (whisper.cpp, GPT-SoVITS), kommen weiterhin von Hugging Face. Jede Datei wird mit ihrer integrierten Prüfsumme abgeglichen.",
  pending: (current: string) => `Speichern Sie eine Adresse, um zu ihr zu wechseln. Bis dahin wird weiter von ${current} heruntergeladen.`,
  envNote: (name: string) => `Ist die Umgebungsvariable ${name} gesetzt, wird sie stattdessen verwendet.`,
  webNote: "Im Browser lässt sich die Downloadquelle nicht ändern. Stellen Sie sie in der CucCut-Desktop-App ein.",
  fieldLabel: "Basis-URL des Spiegels",
  save: "Speichern",
  changed: (source: string) => `Downloadquelle auf ${source} geändert`,
};
