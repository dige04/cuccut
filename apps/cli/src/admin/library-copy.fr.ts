import {  type LibraryName, type VoiceCloneRemoveResult } from '@cuccut/protocol';
import { pluralForm } from '@cuccut/protocol';
import type { LibraryMessages } from './library-copy.ts';

export const fr: LibraryMessages = {
  help: `Utilisation :
  cuccut library import <file>     Importer un fichier d’échange, type détecté par contenu (pas par
                                   extension) : glossaires Markdown, packs de voix .bcvoice, JSON de couleurs
                                   et styles de sous-titres du kit de marque, stickers Lottie, images, vidéos, polices
  cuccut library export <library> <id> <path>
                                   Exporter la version actuelle : glossaires Markdown, voix .bcvoice,
                                   médias de marque dans leur fichier original ; cible existante jamais écrasée
  cuccut library remove <library> <id>
                                   Supprimer une entrée (contenu déjà copié dans les vidéos inchangé)
  cuccut library voice-clone <voice id> --provider <id> [--name <name>]
                                   Envoyer l’enregistrement de référence de la voix au fournisseur pour la cloner
                                   (elevenlabs uniquement pour l’instant) : consentement et autorisation de partage
                                   couvrant « audio » requis (cuccut grants create) ; exécuté comme tâche, Ctrl-C annule
  cuccut library voice-clone-remove <voice id> --provider <id> [--local-only]
                                   Supprimer un clone : demande d’abord sa suppression au fournisseur, puis efface
                                   l’enregistrement si réussie ; --local-only efface uniquement l’enregistrement local
  cuccut library video-selection <video id> [options]
                                   Entrées activées dans la vidéo (stockées dans la vidéo, annulables) : affichées sans options ;
                                   les parties indiquées sont entièrement remplacées, les autres restent inchangées.
                                   Les nouvelles vidéos activent automatiquement les glossaires « activés par défaut »
    --transcribe-glossaries <id,…> Glossaires de transcription (utilisés si aucun glossaire n’est spécifié) ;
                                   une chaîne vide les efface
    --translate-glossaries <id,…>  Glossaires de traduction (utilisés par translate et la traduction de dub) ;
                                   une chaîne vide les efface
    --speaker-voice <transcript id>:<speaker>=<voice>[@<Provider>]
                                   Voix du locuteur (répétable, remplacées en totalité) :
                                   library:<id> ou identifiant de voix d’un fournisseur (avec @Provider)
    --clear-speaker-voices         Effacer les voix des locuteurs`,
  importUsage: "Utilisation : cuccut library import <file>",
  exportUsage: "Utilisation : cuccut library export <glossaries|voices|brand> <id> <path>",
  removeUsage: "Utilisation : cuccut library remove <glossaries|voices|brand> <id>",
  voiceCloneUsage: "Utilisation : cuccut library voice-clone <voice id> --provider <id> [--name <name>]",
  voiceCloneRemoveUsage: "Utilisation : cuccut library voice-clone-remove <voice id> --provider <id> [--local-only]",
  videoSelectionUsage: "Utilisation : cuccut library video-selection <video id> [--translate-glossaries <id,…>] [--speaker-voice …]…",
  imported: (label: string, id: string, name: string) => `Importé dans ${label} : ${id}  ${name}`,
  exported: (id: string, version: string | number, file: string, bytes: number) =>
    `Exporté : ${id} version ${version} vers ${file} (${bytes} ${pluralForm('fr', bytes, { one: "octet", other: "octets" })})`,
  deleted: (id: string) => `Supprimé : ${id}`,
  remoteCloneOutcome: {
    deleted: "supprimé à distance",
    'not-found': "la voix avait déjà été supprimée à distance",
    skipped: "service distant non contacté",
  } satisfies Record<VoiceCloneRemoveResult['remote'], string>,
  voiceCloneRemoved: (id: string, provider: string, remote: string) => `Clone supprimé pour ${id} sur ${provider} (${remote})`,
  libraryLabels: { glossaries: "Glossaire", voices: "Voix", brand: "Kit de marque" } satisfies Record<LibraryName, string>,
  unknownLibrary: (text: string | undefined) => `Bibliothèque inconnue : ${text ?? "(manquant)"}. Disponibles : glossaries, voices, brand`,
  speakerVoiceFormat: (text: string) => `--speaker-voice accepte <transcript id>:<speaker>=<voice>[@<Provider>] ; reçu ${text}`,
  listSep: ", ",
  none: "(aucun)",
  selectionHead: (videoId: string, documentId: string | null, revision: string | number | null) =>
    `Vidéo ${videoId}${documentId ? ` (document library-selection ${documentId} version ${revision})` : " (rien n’est encore activé)"}`,
  transcribeGlossaries: (list: string) => `Glossaires de transcription : ${list}`,
  translateGlossaries: (list: string) => `Glossaires de traduction : ${list}`,
  speakerVoicesNone: "Voix des locuteurs : (aucune)",
  speakerVoice: (documentId: string, speakerId: string, voice: string, providerId: string | null) =>
    `Voix du locuteur : ${documentId}:${speakerId} = ${voice}${providerId ? ` (uniquement sur ${providerId})` : ""}`,
};
