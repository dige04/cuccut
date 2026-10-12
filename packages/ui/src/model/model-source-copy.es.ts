import type { ModelSourceMessages } from './model-source-copy.ts';

export const es: ModelSourceMessages = {
  label: "Origen de descarga",
  fold: "Descarga y almacenamiento",
  custom: "Personalizado",
  isDefault: "Predeterminado",
  msHint: "Suele ser más rápido en China continental",
  customHint: "Introduce la URL base de un espejo",
  hfDesc: "Descarga desde Hugging Face (huggingface.co).",
  msDesc: "Descarga desde ModelScope (modelscope.cn); suele ser más rápido en China continental.",
  customDesc: "Descarga desde un espejo que sirve los archivos en las mismas rutas que Hugging Face.",
  msNote: "Los pocos archivos que ModelScope no tiene (whisper.cpp, GPT-SoVITS) se siguen descargando de Hugging Face. Cada archivo se comprueba con su suma de verificación integrada.",
  pending: (current: string) => `Guarda una dirección para cambiar a ella. Por ahora las descargas siguen viniendo de ${current}.`,
  envNote: (name: string) => `Si la variable de entorno ${name} está definida, se usa esa.`,
  webNote: "Un navegador no puede cambiar el origen de descarga. Configúralo en la app de escritorio de CucCut.",
  fieldLabel: "URL base del espejo",
  save: "Guardar",
  changed: (source: string) => `Origen de descarga cambiado a ${source}`,
};
