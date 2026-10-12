import type { ModelSourceMessages } from './model-source-copy.ts';

export const fr: ModelSourceMessages = {
  label: "Source de téléchargement",
  fold: "Téléchargement et stockage",
  custom: "Personnalisée",
  isDefault: "Par défaut",
  msHint: "Souvent plus rapide en Chine continentale",
  customHint: "Saisissez l’URL de base d’un miroir",
  hfDesc: "Télécharger depuis Hugging Face (huggingface.co).",
  msDesc: "Télécharger depuis ModelScope (modelscope.cn), souvent plus rapide en Chine continentale.",
  customDesc: "Télécharger depuis un miroir qui sert les fichiers aux mêmes chemins que Hugging Face.",
  msNote: "Les quelques fichiers absents de ModelScope (whisper.cpp, GPT-SoVITS) viennent toujours de Hugging Face. Chaque fichier est vérifié avec sa somme de contrôle intégrée.",
  pending: (current: string) => `Enregistrez une adresse pour l’utiliser. Pour l’instant, les téléchargements viennent toujours de ${current}.`,
  envNote: (name: string) => `Si la variable d’environnement ${name} est définie, c’est elle qui est utilisée.`,
  webNote: "Un navigateur ne peut pas changer la source de téléchargement. Réglez-la dans l’app de bureau CucCut.",
  fieldLabel: "URL de base du miroir",
  save: "Enregistrer",
  changed: (source: string) => `Source de téléchargement : ${source}`,
};
