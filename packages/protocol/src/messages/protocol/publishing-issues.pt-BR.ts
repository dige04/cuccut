import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const ptBR: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Aprove a exportação fixada antes de publicar.',
  exportRequired: 'Renderize e fixe o vídeo para publicá-lo.',
  accountsRequired: 'Escolha pelo menos uma conta.',
  timezoneInvalid: 'Escolha um fuso horário válido.',
  accountUnavailable: 'Esta conta não está mais disponível. Reconecte-a ou escolha outra conta.',
  accountDuplicateRoute: 'A mesma conta está selecionada por duas rotas. Escolha uma rota.',
  accountNotConnected: 'Conecte esta conta nas configurações de publicação antes de enviar.',
  formatMismatch: 'Este formato não corresponde à rede da conta. Escolha outro formato.',
  descriptionRequired: 'Escreva uma descrição para esta conta.',
  titleLength: (p: { max: number }) => `O YouTube exige um título de 1 a ${p.max} caracteres.`,
  audienceRequired: 'Informe se este vídeo do YouTube é feito para crianças.',
  tagsTooLong: (p: { max: number }) => `Mantenha as tags do YouTube em até ${p.max} caracteres, ou o YouTube pode descartá-las.`,
  shortTooLong: 'Os Shorts do YouTube podem ter no máximo três minutos. Escolha vídeo do YouTube ou encurte a exportação.',
  shortsClassification: 'O YouTube trata vídeos quadrados ou verticais de até três minutos como Shorts. Escolha YouTube Short para esta exportação.',
  portraitRequired: 'Este formato exige uma exportação vertical ou quadrada. Renderize uma versão vertical ou escolha outro formato.',
  captionTooLong: (p: { length: number; max: number }) => `A descrição e as hashtags têm ${p.length} caracteres; esta rede permite ${p.max}. Encurte-as.`,
  timeInPast: 'Este horário já passou. Escolha um horário futuro ou limpe-o para enviar agora.',
  expiresBefore: 'Esta publicação expira antes de entrar no ar. Escolha um horário anterior ou uma expiração posterior.',
  deliveryUnsettled:
    'Outro lançamento deste vídeo para esta conta ainda está aguardando ou não confirmado. Registre o resultado antes de enviar de novo.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'A visibilidade não listada está disponível apenas no YouTube.',
  optionTagsYoutubeOnly: 'As tags estão disponíveis apenas no YouTube. Coloque as hashtags na descrição.',
  optionPhoneYoutubeTags: 'A rota do telefone não pode definir tags do YouTube. Remova-as ou escolha outra rota.',
  optionPostbridgeYoutubeAudience:
    'O Postbridge não pode definir público ou visibilidade do YouTube. Aceite as configurações definidas no Postbridge ou escolha outra rota.',
  optionPostgunSynthetic: 'O Postgun não pode adicionar a declaração de mídia sintética do YouTube. Escolha outra rota.',
  optionYoutubeApiInteractions: 'Esta rota não pode aplicar as opções selecionadas de interação ou parceria do YouTube.',
  optionInstagramApi: 'Esta rota não pode aplicar as opções selecionadas de visibilidade, divulgação ou interação do Instagram.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Informe uma data e um horário válidos.',
  timeRequired: 'Escolha uma data e um horário.',
  timeGap: (p: { timezone: string }) => `Este horário não existe em ${p.timezone} porque os relógios mudam. Escolha outro horário.`,
  timeFold: (p: { timezone: string }) =>
    `Este horário acontece duas vezes em ${p.timezone} porque os relógios mudam. Informe um timestamp exato com o deslocamento UTC.`,
  timestampInvalid: 'Informe um timestamp com o deslocamento UTC, como 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Nenhum horário livre cabe antes da expiração. Verifique as contas, os horários semanais e o espaçamento.',
  destinationMissing: 'Esta conta não faz mais parte da publicação. Recarregue-a e tente novamente.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Escolha um arquivo de calendário do CucCut (JSON) exportado por uma versão compatível.',
  archiveDuplicatePublications: 'O arquivo de calendário lista uma publicação duas vezes. Exporte-o novamente no computador original.',
  archiveDuplicateAccounts: 'O arquivo de calendário lista uma conta duas vezes. Exporte-o novamente no computador original.',
  archiveDuplicateConnections: 'O arquivo de calendário lista uma conexão duas vezes. Exporte-o novamente no computador original.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `“${p.label}” lista a mesma conta duas vezes no arquivo de calendário. Exporte-o novamente no computador original.`,
  archiveTimezone: (p: { timezone: string }) => `O arquivo de calendário usa um fuso horário desconhecido (${p.timezone}). Exporte-o novamente no computador original.`,
  archiveMissingConnection: (p: { name: string }) => `O arquivo de calendário não tem a conexão de “${p.name}”.`,
  archiveLinkedAccount: (p: { name: string }) => `A conta vinculada de “${p.name}” no arquivo de calendário é inválida.`,
  archiveMissingAccount: (p: { label: string }) => `O arquivo de calendário não tem uma conta usada por “${p.label}”.`,
  archiveInvalidDate: (p: { label: string }) => `O arquivo de calendário tem uma data inválida para “${p.label}”.`,
  importConnectionConflict: (p: { name: string }) =>
    `A conexão “${p.name}” no arquivo de calendário conflita com uma conexão deste computador.`,
  importAccountConflict: (p: { name: string }) => `A conta “${p.name}” no arquivo de calendário conflita com uma conta deste computador.`,
  importedInFlight: 'Importado durante um envio. Verifique o resultado no aplicativo da rede e registre-o antes de enviar de novo.',
};
