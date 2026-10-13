import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const ptBR: RuntimeStoragePublishingMessages = {
  unreadable: "Não foi possível ler os dados de publicação. O CucCut deixou o arquivo como está e não o alterará. Restaure-o de um backup ou mova-o para começar do zero.",
  newerVersion: "Os dados de publicação foram salvos por uma versão mais recente do CucCut. Atualize o CucCut para alterá-los; até lá, você só pode visualizá-los.",
  conflict: "Esta publicação foi alterada em outro lugar. Recarregue a versão salva antes de aplicar suas alterações.",
  settingsConflict: "As configurações de publicação foram alteradas em outro lugar. Recarregue-as antes de salvar.",
  notFound: "Esta publicação não existe mais.",
  invalidRecord: "Esta alteração deixaria um registro de publicação incompleto, por isso não foi salva. Verifique os valores e tente novamente.",
  writeFailed: "Não foi possível salvar os dados de publicação no disco. Verifique se o disco tem espaço e se o CucCut pode gravar na sua pasta, depois tente novamente.",
};
