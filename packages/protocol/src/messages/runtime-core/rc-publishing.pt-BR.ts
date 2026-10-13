import type { RcPublishingMessages } from './rc-publishing.ts';

export const ptBR: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Só o proprietário pode fazer isto, no aplicativo CucCut deste computador.',
  desktopOnly: 'Autorizar, enviar, registrar resultados e gerenciar conexões estão disponíveis apenas no aplicativo CucCut deste computador.',
  settingsOwnerOnly: 'Só o proprietário pode alterar a agenda de publicação. Peça a ele que a altere nas configurações de publicação.',
  transferNotAllowed: 'A importação e a exportação do calendário estão disponíveis no aplicativo CucCut e na linha de comando.',
  authorizationRequired: 'O proprietário precisa autorizar esta publicação exata no CucCut antes que um agente possa enviá-la.',
  // Publications.
  publicationArchived: 'Esta publicação está arquivada. Restaure-a antes de alterá-la.',
  publicationLocked: 'Destinos enviados mantêm o conteúdo compartilhado. Edite um destino com falha ou prepare um novo lançamento.',
  destinationLocked: 'O envio desta conta já começou. Retire-o ou registre o resultado antes de alterá-lo.',
  destinationKept: 'Um destino enviado permanece na publicação. Retire-o ou registre o resultado antes de removê-lo.',
  destinationAccountFixed: 'Para usar outra conta, remova este destino e adicione a conta no lugar.',
  destinationNotFound: 'Esta conta não faz mais parte da publicação. Recarregue-a e tente novamente.',
  duplicateAccount: 'Escolha cada conta apenas uma vez.',
  duplicatePlacement: 'Escolha o horário de cada conta apenas uma vez.',
  afterExpiry: 'Escolha um horário antes de esta publicação expirar.',
  invalid: 'Esta publicação ainda não está pronta. Corrija os problemas listados e tente novamente.',
  nothingToSend: 'Todas as contas desta publicação já foram enviadas. Prepare um novo lançamento para enviá-la novamente.',
  slotTaken: (p: { account: string }) =>
    `Este horário conflita com outra publicação de ${p.account}. Escolha outro horário ou permita menos tempo entre as publicações nas configurações de publicação.`,
  calendarRange: 'Escolha um intervalo de calendário de no máximo 93 dias, com o início antes do fim.',
  archiveInFlight: 'Retire os envios que estão aguardando ou registre o resultado deles antes de arquivar esta publicação.',
  // Delivery.
  providerUnsupported: 'Esta versão do CucCut publica apenas manualmente. Escolha Manual para esta conexão.',
  notWaiting: 'Só é possível retirar uma conta que está aguardando você.',
  cancelNotAllowed: 'Só é possível cancelar uma conta que não foi enviada. Retire-a ou registre antes o resultado.',
  reconcileFinal: 'Um envio publicado ou cancelado faz parte do histórico. Prepare um novo lançamento em vez de alterá-lo.',
  reconcileSending: 'Aguarde o envio atual terminar antes de registrar um resultado.',
  reconcileFutureTime: 'Informe o horário futuro que a rede mostra para esta publicação.',
  // Pinned exports.
  exportRequired: 'Renderize e fixe o vídeo primeiro.',
  exportChanged: 'A exportação aprovada mudou. Fixe uma exportação verificada antes de publicar.',
  exportStale: 'Exporte a revisão atual antes de fixá-la, ou escolha Renderizar e fixar.',
  exportNotFinished: 'Esta exportação ainda não terminou. Aguarde ou escolha outra exportação.',
  exportNotVideo: 'Escolha uma exportação MP4 concluída do vídeo inteiro.',
  exportOtherVideo: 'Esta exportação é de outro vídeo ou sequência. Escolha uma exportação deste vídeo.',
  exportFileMissing: 'O arquivo exportado não está mais neste computador. Renderize e fixe o vídeo novamente.',
  exportFileChanged: 'O arquivo exportado mudou depois de renderizado. Renderize e fixe o vídeo novamente.',
  pinLocked: 'Destinos enviados mantêm a exportação fixada. Prepare um novo lançamento para usar outra exportação.',
  renderFailed: 'A exportação desta publicação não terminou. Renderize e fixe-a novamente.',
  renderCancelled: 'A exportação desta publicação foi cancelada. Renderize e fixe-a novamente quando estiver pronto.',
  videoNotFound: 'Este vídeo não está neste computador. Abra o projeto dele e tente novamente.',
  sequenceNotFound: "Este vídeo não tem essa sequência. Deixe a sequência de fora para publicar a sequência principal do vídeo.",
  sequenceOneVideo: 'Escolha uma sequência só ao preparar um único vídeo.',
  // Settings, connections and accounts.
  accountNotFound: 'Esta conta não existe mais. Recarregue as configurações de publicação e tente novamente.',
  connectionNotFound: 'Esta conexão não existe mais. Recarregue as configurações de publicação e tente novamente.',
  defaultAccountMissing: 'Uma conta padrão não existe mais. Escolha novamente as contas padrão.',
  connectionProviderFixed: 'Uma conexão mantém a rota com que foi adicionada. Adicione uma nova conexão para publicar de outra forma.',
  accountIdentityFixed: 'Uma conta mantém sua conexão e sua rede. Adicione uma nova conta no lugar.',
  accountDuplicate: 'Esta conta já foi adicionada a esta conexão.',
  accountInUse: (p: { name: string }) =>
    `${p.name} tem uma publicação aguardando, agendada ou não confirmada. Registre o resultado antes de remover a conta.`,
  linkInvalid: 'Escolha outra conta da mesma rede que não esteja vinculada a si mesma.',
  linkCanonical: 'Outras contas estão vinculadas a esta. Vincule a outra rota a esta conta.',
  // Copy proposals.
  proposalReason: 'Rascunho baseado no vídeo, na transcrição e nas suas orientações de escrita. Revise antes de aplicar.',
  proposalUnreadable: "A resposta do modelo de texto não pôde ser lida. Tente Sugerir texto de novo, ou escreva o texto você mesmo.",
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'Publicação do CucCut',
  // Calendar transfer and cleanup.
  backupFailed: 'Não foi possível gravar um backup dos dados de publicação, então nada foi importado. Verifique o disco e tente novamente.',
};
