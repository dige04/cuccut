import type { JobsTranslateMessages } from './translate.ts';

export const fr: JobsTranslateMessages = {
  label: "Traduire",
  description:
    "Traduit phrase par phrase une transcription de la vidéo dans une autre langue et écrit un nouveau document de traduction. Un modèle de texte effectue le travail ; aucun Agent ne démarre.",
  stepFreezeSource: "Lire la source",
  stepTranslate: "Traduire",
  stepAssemble: "Assembler la traduction",
  stepWrite: "Écrire dans la vidéo",
  videoNotOpen: "La vidéo n’est pas ouverte",
  noStructuredOutput: (p: { model: string }) => `Le modèle ${p.model} ne prend pas en charge la sortie structurée et ne peut donc pas servir à la traduction`,
  workerMismatch: "La traduction du Speech Worker ne correspond pas à la source figée",
  targetLanguageInvalid: "Le paramètre targetLanguage doit être une étiquette de langue BCP 47",
  flagInvalid: (p: { key: string }) => `Le paramètre ${p.key} doit être true ou false`,
  bilingualNeedsCaptions: "Le paramètre bilingual peut être indiqué seulement si captions est true (ajout d’un calque de sous-titres)",
  noDocument: (p: { documentId: string }) => `La vidéo n’a aucun document ${p.documentId}`,
  notSpeech: (p: { documentId: string; kind: string }) =>
    `Le document ${p.documentId} est ${p.kind} ; seules les transcriptions (speech) peuvent être traduites`,
  noTranscript: "La vidéo n’a aucune transcription. Transcrivez-la avant de traduire.",
  multipleTranscripts: "La vidéo a plusieurs transcriptions. Utilisez documentId pour en choisir une.",
  videoClosed: "La vidéo a été fermée",
  sourceGone: "Le document source n’est plus dans la vidéo",
  noSentences: "La transcription n’a aucune phrase à traduire",
  sameLanguage: (p: { source: string; target: string }) =>
    `La langue de transcription ${p.source} est identique à la langue cible ${p.target} ; aucune traduction nécessaire`,
  workerMissing: "Speech Worker (speech-worker) introuvable. Exécutez d’abord npm run build:engine.",

  documentName: (p: { language: string }) => `La traduction ${p.language}`,
  videoClosedKept: "La vidéo a été fermée. La traduction est conservée dans les résultats.",
  sourceChanged:
    "Le document source a changé pendant la traduction ; rien n’a été écrit dans la vidéo. Réessayer traduit la version actuelle.",

  transactionLabel: (p: { language: string }) => `Traduire en ${p.language}`,
  noDocumentId: "La traduction a été écrite dans la vidéo mais son identifiant de document n’a pas été renvoyé",
  rejected: "La transaction d’écriture dans la vidéo a été refusée. La traduction est conservée dans les résultats.",
  sentencesNeedTranslation: "Le paramètre sentences ne peut être donné qu’avec translationId",
  refreshNoCaptions: "Les paramètres captions, captionStyle et bilingual ne peuvent pas être utilisés avec translationId. Les calques de sous-titres créés à partir de cette traduction sont mis à jour sur place.",
  notTranslation: (p: { documentId: string; kind: string }) => `Le document ${p.documentId} est de type ${p.kind}, pas une traduction`,
  translationNotRefreshable: (p: { documentId: string }) => `La traduction ${p.documentId} n’indique pas sa transcription source ou n’est pas au format de traduction actuel : elle ne peut pas être mise à jour sur place. Traduisez à nouveau la transcription.`,
  translationSourceMismatch: (p: { documentId: string; source: string }) => `La traduction ${p.documentId} a été traduite depuis le document ${p.source}, qui ne correspond pas à documentId`,
  translationLanguageMismatch: (p: { language: string; target: string }) => `La traduction est en ${p.language}, mais targetLanguage vaut ${p.target}`,
  unknownSentence: (p: { sentenceId: string }) => `La transcription n’a pas de phrase ${p.sentenceId}`,
  nothingStale: "Cette traduction n’a aucune phrase obsolète ou non traduite. Utilisez sentences pour choisir les phrases à retraduire.",
  translationGone: "Le document de traduction n’est plus dans la vidéo",
  translationChanged: "La traduction a été modifiée pendant la retraduction : rien n’a été écrit dans la vidéo. Réessayer retraduit à partir de sa version actuelle.",
  refreshLabel: (p: { language: string }) => `Retraduire des phrases en ${p.language}`,
};
