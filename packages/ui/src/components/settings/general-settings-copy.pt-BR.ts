import type { GeneralSettingsMessages } from './general-settings-copy.ts';

export const ptBR: GeneralSettingsMessages = {
  interfaceGroup: "Interface",
  language: "Idioma",
  languageDesc: "Efeito imediato, sem reiniciar.",
  languageSystem: (current: string) => `Sistema (${current})`,
  appearance: "Aparência",
  appearanceDesc: "Só afeta janelas locais do CucCut.",
  schemeSystem: "Sistema",
  schemeLight: "Claro",
  schemeDark: "Escuro",

  saveFailed: (message: string) => `Não foi possível salvar: ${message}`,

  editingGroup: "Edição e transcrição",
  autoOpen: "Abrir vídeo automaticamente após transcrever",
  autoOpenDesc: "Para importações locais. Links em segundo plano só notificam, sem mudar sua página.",
  autoOpenNote: "Ainda não conectado: transcrição sempre mantém a página, sem abrir vídeo automaticamente.",
  lineLength: "Comprimento da linha de legenda",
  lineLengthDesc: "Define tamanho alvo das quebras automáticas; linhas editadas manualmente não mudam.",

  lineLengthNote: (maxChars: number, custom: string | null) =>
    `Ainda não conectado: quebras fixas em ${maxChars} caracteres de meia largura por linha (CJK conta como dois).${custom ? ` Valor salvo personalizado (${custom}).` : ""}`,
  cueShading: "Sombrear legendas na transcrição",
  cueShadingDesc: "Sombreia levemente o intervalo de cada legenda para ver a divisão.",
  cueShadingNote: "Não implementado: transcrição não sombreia intervalos.",

  downloadsGroup: "Downloads e atualizações",
  autoUpdateOn: "Verificação e download automáticos ativados",
  autoUpdateOff: "Download automático de atualizações desativado",
  downloader: "Ferramenta de download de vídeo",
  downloaderWeb: "Navegador não verifica ferramentas locais; use desktop.",
  checking: "Verificando…",
  checkFailed: (message: string) => `Não foi possível verificar: ${message}`,
  checkAgain: "Verificar novamente",

  sourcesGroup: "Fontes de download e off-line",
  modelsEndpoint: "Fonte de download de modelos",
  toolsEndpoint: "Fonte de download de ferramentas",
  toolsEndpointDesc:
    "Ferramentas como yt-dlp baixadas em “URL base/ferramenta/versão/arquivo”. Vazio usa URL oficial. CUCCUT_TOOLS_ENDPOINT tem prioridade.",
  toolsEndpointPlaceholder: "URL oficial de lançamento",
  strictOffline: "Off-line estrito",
  strictOfflineDesc:
    "Ativado: não baixa modelos, ferramentas ou vídeos por links. Conexões dos modelos de nuvem e agentes não mudam.",
  strictOfflineOn: "Off-line estrito ativado",
  strictOfflineOff: "Off-line estrito desativado",
  endpointChanged: (endpoint: string) => `Agora usando ${endpoint}`,
  endpointReset: (label: string) => `${label} redefinido ao padrão`,
  save: "Salvar",
  resetDefault: "Redefinir",

  trashDays: "Dias na Lixeira",
  trashDaysDesc: (fallback: number | null) =>
    `Itens antigos sem referências e vídeos excluídos são apagados permanentemente; verifica ao iniciar e a cada 6 horas. Referenciados mantidos. Limpe para padrão${fallback ? ` de ${fallback} dias` : ""}.`,
  webNote: "Um navegador não pode alterar esta configuração. Altere-a no app para desktop do CucCut.",
  webViewOnly: "No navegador você só pode ver isto. Faça as alterações no app para desktop do CucCut.",
  webUnavailable: "Isto não está disponível no navegador. Use o app para desktop do CucCut.",
};
