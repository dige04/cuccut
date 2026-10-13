import type { SpaceMessages } from './space-copy.ts';
import { pluralForm } from '@cuccut/protocol';

const plural = (n: number, one: string, many: string) => `${n} ${pluralForm('fr', n, { one, other: many })}`;

export const fr: SpaceMessages = {
  help: `Utilisation :
  cuccut space rescan              Analyser à nouveau les dossiers sources
  cuccut space rebuild             Reconstruire le catalogue de la Bibliothèque depuis les dossiers et enregistrements ;
                                   l’index de contenu relit toutes les vidéos en arrière-plan
  cuccut space trash|restore <entry id>
                                   Placer dans la corbeille / restaurer (fichiers inchangés ;
                                   pour les vidéos, leur dossier entre ou sort de la corbeille)
  cuccut space purge <entry id>    Supprimer définitivement une entrée de la corbeille ; refusé si encore utilisée
                                   par une vidéo ou tâche, références affichées
  cuccut space delete-video <entry id>
                                   Supprimer une vidéo : dossier placé dans la corbeille, restaurable pendant
                                   la durée de conservation ; fichiers originaux des médias liés inchangés
  cuccut space continue <entry id> [--conversation <session id>]
                                   Continuer une session depuis une entrée : une référence (identifiants et métadonnées seuls) accompagne
                                   le message suivant ; sans session, une est choisie selon l’emplacement de l’entrée ou créée`,
  usage: [
    "Utilisation : cuccut space rescan | rebuild | trash <entry id> | restore <entry id> | purge <entry id> | delete-video <entry id>",
    "       cuccut space continue <entry id> [--conversation <session id>]",
  ].join("\n"),
  entryUsage: (action: string) => `Utilisation : cuccut space ${action} <entry id>`,
  continueUsage: "Utilisation : cuccut space continue <entry id> [--conversation <session id>]",
  flagNotAccepted: (action: string, key: string) => `cuccut space ${action} n’accepte pas --${key}`,
  rescanStarted: "Nouvelle analyse démarrée",
  rebuilt: (entries: number, pendingVideos: number) =>
    `Catalogue reconstruit : ${plural(entries, "entrée", "entrées")} ; l’index de contenu relit ${plural(pendingVideos, "vidéo", "vidéos")} en arrière-plan ; les résultats de recherche restent incomplets jusqu’à la fin`,
  purgeBlocked: (id: string) => `${id} est encore utilisé par une vidéo ou une tâche ; non supprimé`,
  movedToTrash: (id: string, name: string) => `Placé dans la corbeille : ${id}  ${name}`,
  restoredFromTrash: (id: string, name: string) => `Restauré depuis la corbeille : ${id}  ${name}`,
  purged: (id: string) => `Supprimé définitivement : ${id}`,
  notPurged: (id: string) => `Non supprimé : ${id} : encore référencé`,
  videoTrashed: (name: string, entryId: string, retentionDays: number | null) =>
    `Vidéo « ${name} » placée dans la corbeille : ${entryId} (restaurez avec cuccut space restore ${entryId}${retentionDays === null ? "" : ` ; suppression définitive après ${plural(retentionDays, "jour", "jours")}`})`,
  relatedKept: (n: number) => `${plural(n, "entrée", "entrées")} exportées ou générées à partir de cette vidéo restent à leur emplacement`,
  continued: (created: boolean, id: string, cwd: string) => `${created ? "Session créée" : "Session utilisée"} ${id}  dossier de travail ${cwd}`,
  referenceNext: (name: string, id: string) =>
    `Une référence à l’entrée « ${name} » accompagnera le prochain message : cuccut chat "…" --conversation ${id}`,
};
