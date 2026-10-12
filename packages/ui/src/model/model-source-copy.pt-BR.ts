import type { ModelSourceMessages } from './model-source-copy.ts';

export const ptBR: ModelSourceMessages = {
  label: "Fonte de download",
  fold: "Download e armazenamento",
  custom: "Personalizada",
  isDefault: "Padrão",
  msHint: "Geralmente mais rápido na China continental",
  customHint: "Informe a URL base de um espelho",
  hfDesc: "Baixar do Hugging Face (huggingface.co).",
  msDesc: "Baixar do ModelScope (modelscope.cn), geralmente mais rápido na China continental.",
  customDesc: "Baixar de um espelho que fornece os arquivos nos mesmos caminhos do Hugging Face.",
  msNote: "Os poucos arquivos que o ModelScope não tem (whisper.cpp, GPT-SoVITS) continuam vindo do Hugging Face. Cada arquivo é conferido com sua soma de verificação integrada.",
  pending: (current: string) => `Salve um endereço para passar a usá-lo. Por enquanto, os downloads continuam vindo de ${current}.`,
  envNote: (name: string) => `Se a variável de ambiente ${name} estiver definida, ela é usada no lugar.`,
  webNote: "Um navegador não pode alterar a fonte de download. Configure isso no app para desktop do CucCut.",
  fieldLabel: "URL base do espelho",
  save: "Salvar",
  changed: (source: string) => `Fonte de download alterada para ${source}`,
};
