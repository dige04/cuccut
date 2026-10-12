import type { ModelSourceMessages } from './model-source-copy.ts';

export const nl: ModelSourceMessages = {
  label: "Downloadbron",
  fold: "Downloaden en opslag",
  custom: "Aangepast",
  isDefault: "Standaard",
  msHint: "Meestal sneller in het Chinese vasteland",
  customHint: "Voer de basis-URL van een mirror in",
  hfDesc: "Downloaden van Hugging Face (huggingface.co).",
  msDesc: "Downloaden van ModelScope (modelscope.cn), meestal sneller in het Chinese vasteland.",
  customDesc: "Downloaden van een mirror die de bestanden onder dezelfde paden als Hugging Face aanbiedt.",
  msNote: "De paar bestanden die ModelScope niet heeft (whisper.cpp, GPT-SoVITS) komen nog steeds van Hugging Face. Elk bestand wordt gecontroleerd met de ingebouwde checksum.",
  pending: (current: string) => `Sla een adres op om erop over te stappen. Tot dan wordt nog gedownload van ${current}.`,
  envNote: (name: string) => `Als de omgevingsvariabele ${name} is ingesteld, wordt die gebruikt.`,
  webNote: "Een browser kan de downloadbron niet wijzigen. Stel dit in de CucCut-desktopapp in.",
  fieldLabel: "Basis-URL van de mirror",
  save: "Opslaan",
  changed: (source: string) => `Downloadbron gewijzigd in ${source}`,
};
