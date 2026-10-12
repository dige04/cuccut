import type { ModelSourceMessages } from './model-source-copy.ts';

export const pl: ModelSourceMessages = {
  label: "Źródło pobierania",
  fold: "Pobieranie i przechowywanie",
  custom: "Własne",
  isDefault: "Domyślne",
  msHint: "Zwykle szybsze w Chinach kontynentalnych",
  customHint: "Podaj bazowy URL serwera lustrzanego",
  hfDesc: "Pobieraj z Hugging Face (huggingface.co).",
  msDesc: "Pobieraj z ModelScope (modelscope.cn), zwykle szybciej w Chinach kontynentalnych.",
  customDesc: "Pobieraj z serwera lustrzanego, który udostępnia pliki pod tymi samymi ścieżkami co Hugging Face.",
  msNote: "Nieliczne pliki, których nie ma w ModelScope (whisper.cpp, GPT-SoVITS), nadal pochodzą z Hugging Face. Każdy plik jest sprawdzany wbudowaną sumą kontrolną.",
  pending: (current: string) => `Zapisz adres, aby się na niego przełączyć. Na razie pliki nadal pochodzą z ${current}.`,
  envNote: (name: string) => `Jeśli ustawiono zmienną środowiskową ${name}, używana jest ona.`,
  webNote: "W przeglądarce nie można zmienić źródła pobierania. Ustaw je w aplikacji CucCut na komputer.",
  fieldLabel: "Bazowy URL serwera lustrzanego",
  save: "Zapisz",
  changed: (source: string) => `Źródło pobierania zmienione na ${source}`,
};
