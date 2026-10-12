import type { ModelSourceMessages } from './model-source-copy.ts';

export const ru: ModelSourceMessages = {
  label: "Источник скачивания",
  fold: "Скачивание и хранение",
  custom: "Свой",
  isDefault: "По умолчанию",
  msHint: "Обычно быстрее в материковом Китае",
  customHint: "Укажите базовый URL зеркала",
  hfDesc: "Скачивать с Hugging Face (huggingface.co).",
  msDesc: "Скачивать с ModelScope (modelscope.cn), обычно быстрее в материковом Китае.",
  customDesc: "Скачивать с зеркала, которое отдаёт файлы по тем же путям, что и Hugging Face.",
  msNote: "Немногие файлы, которых нет на ModelScope (whisper.cpp, GPT-SoVITS), по-прежнему скачиваются с Hugging Face. Каждый файл сверяется со встроенной контрольной суммой.",
  pending: (current: string) => `Сохраните адрес, чтобы перейти на него. Пока скачивание идёт с ${current}.`,
  envNote: (name: string) => `Если задана переменная окружения ${name}, используется она.`,
  webNote: "В браузере нельзя изменить источник скачивания. Настройте его в настольном приложении CucCut.",
  fieldLabel: "Базовый URL зеркала",
  save: "Сохранить",
  changed: (source: string) => `Источник скачивания: ${source}`,
};
