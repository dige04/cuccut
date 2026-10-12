import type { JobsTranslateMessages } from './translate.ts';

export const de: JobsTranslateMessages = {
  label: "Übersetzen",
  description:
    "Übersetzt ein Transkript im Video Satz für Satz in eine andere Sprache und schreibt das Ergebnis als neues Übersetzungsdokument. Ein Textmodell übernimmt die Arbeit; es wird kein Agent gestartet.",
  stepFreezeSource: "Quelle lesen",
  stepTranslate: "Übersetzen",
  stepAssemble: "Übersetzung zusammenstellen",
  stepWrite: "Ins Video schreiben",
  videoNotOpen: "Das Video ist nicht geöffnet",
  noStructuredOutput: (p: { model: string }) => `Modell ${p.model} unterstützt keine strukturierte Ausgabe und kann daher nicht zum Übersetzen verwendet werden`,
  workerMismatch: "Die Übersetzung des Speech Worker stimmt nicht mit der eingefrorenen Quelle überein",
  targetLanguageInvalid: "Parameter targetLanguage muss ein BCP 47-Sprachtag sein",
  flagInvalid: (p: { key: string }) => `Parameter ${p.key} muss true oder false sein`,
  bilingualNeedsCaptions: "Parameter bilingual darf nur angegeben werden, wenn captions true ist (Hinzufügen einer Untertitel-Ebene)",
  noDocument: (p: { documentId: string }) => `Das Video hat kein Dokument ${p.documentId}`,
  notSpeech: (p: { documentId: string; kind: string }) =>
    `Dokument ${p.documentId} ist ${p.kind}; nur Transkripte (speech) können übersetzt werden`,
  noTranscript: "Das Video hat kein Transkript. Vor dem Übersetzen transkribieren.",
  multipleTranscripts: "Das Video hat mehr als ein Transkript. Mit documentId das zu übersetzende auswählen.",
  videoClosed: "Das Video wurde geschlossen",
  sourceGone: "Das Quelldokument ist nicht mehr im Video vorhanden",
  noSentences: "Das Transkript enthält keine zu übersetzenden Sätze",
  sameLanguage: (p: { source: string; target: string }) =>
    `Die Transkriptsprache ${p.source} ist dieselbe wie die Zielsprache ${p.target}; es ist daher keine Übersetzung nötig`,
  workerMissing: "Speech Worker (speech-worker) nicht gefunden. Zuerst npm run build:engine ausführen.",

  documentName: (p: { language: string }) => `Übersetzung ${p.language}`,
  videoClosedKept: "Das Video wurde geschlossen. Die Übersetzung bleibt in den Ergebnissen erhalten.",
  sourceChanged:
    "Das Quelldokument wurde während der Übersetzung geändert; nichts wurde ins Video geschrieben. Ein erneuter Versuch übersetzt die aktuelle Version des Quelldokuments.",

  transactionLabel: (p: { language: string }) => `Übersetzen nach ${p.language}`,
  noDocumentId: "Die Übersetzung wurde ins Video geschrieben, aber ihre Dokument-ID wurde nicht zurückgegeben",
  rejected: "Die Transaktion zum Schreiben ins Video wurde abgelehnt. Die Übersetzung bleibt in den Ergebnissen erhalten.",
  sentencesNeedTranslation: "Der Parameter sentences kann nur zusammen mit translationId angegeben werden",
  refreshNoCaptions: "Die Parameter captions, captionStyle und bilingual können nicht mit translationId verwendet werden. Untertitelebenen aus dieser Übersetzung werden direkt aktualisiert.",
  notTranslation: (p: { documentId: string; kind: string }) => `Dokument ${p.documentId} ist ${p.kind}, keine Übersetzung`,
  translationNotRefreshable: (p: { documentId: string }) => `Übersetzung ${p.documentId} verweist auf kein Quelltranskript oder liegt nicht im aktuellen Übersetzungsformat vor und kann daher nicht direkt aktualisiert werden. Übersetze das Transkript stattdessen neu.`,
  translationSourceMismatch: (p: { documentId: string; source: string }) => `Übersetzung ${p.documentId} wurde aus Dokument ${p.source} übersetzt, das nicht zu documentId passt`,
  translationLanguageMismatch: (p: { language: string; target: string }) => `Die Übersetzung ist in ${p.language}, aber targetLanguage ist ${p.target}`,
  unknownSentence: (p: { sentenceId: string }) => `Das Transkript hat keinen Satz ${p.sentenceId}`,
  nothingStale: "Diese Übersetzung hat keine veralteten oder unübersetzten Sätze. Wähle mit sentences, welche Sätze neu übersetzt werden sollen.",
  translationGone: "Das Übersetzungsdokument ist nicht mehr im Video",
  translationChanged: "Die Übersetzung wurde während der Neuübersetzung bearbeitet, daher wurde nichts ins Video geschrieben. Ein erneuter Versuch übersetzt auf Basis der aktuellen Version neu.",
  refreshLabel: (p: { language: string }) => `Sätze in ${p.language} neu übersetzen`,
};
