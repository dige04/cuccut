import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const fr: RuntimeStoragePublishingMessages = {
  unreadable: "Les données de publication n'ont pas pu être lues. CucCut a laissé le fichier tel quel et ne le modifiera pas. Restaurez-le depuis une sauvegarde, ou déplacez-le pour repartir de zéro.",
  newerVersion: "Les données de publication ont été enregistrées par une version plus récente de CucCut. Mettez CucCut à jour pour les modifier ; d'ici là, vous ne pouvez que les consulter.",
  conflict: "Cette publication a été modifiée ailleurs. Rechargez la version enregistrée avant d'appliquer vos modifications.",
  settingsConflict: "Les paramètres de publication ont été modifiés ailleurs. Rechargez-les avant d'enregistrer.",
  notFound: "Cette publication n'existe plus.",
  invalidRecord: "Cette modification laisserait un enregistrement de publication incomplet, elle n'a donc pas été enregistrée. Vérifiez les valeurs et réessayez.",
  writeFailed: "Les données de publication n'ont pas pu être enregistrées sur le disque. Vérifiez que le disque a de l'espace libre et que CucCut peut écrire dans son dossier, puis réessayez.",
};
