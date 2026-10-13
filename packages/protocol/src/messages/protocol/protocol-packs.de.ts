import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const de: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json muss genau ein JSON-Objekt enthalten',
  formatMissing: 'pack.json hat kein "format": "cuccut.pack", daher ist es kein CucCut-Pack',
  foreignFormat: 'Das ist ein agentcut-Pack: Seine pack.json hat kein Feld "format". CucCut liest nur cuccut.pack-Ordner',
  otherFormat: (p: { format: string }) => `pack.json gibt das Format als "${p.format}" an, nicht als "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Pack-Schema ${p.schema} wird nicht unterstützt; diese Version von CucCut liest Schema 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" wird nicht unterstützt: Packs enthalten in dieser Version von CucCut keinen Code`,
  idChars: 'Eine Pack-ID besteht aus Kleinbuchstaben, Ziffern und einzelnen Bindestrichen und beginnt mit einem Buchstaben',
  idReserved: (p: { id: string }) => `„${p.id}“ ist ein reservierter Name und kann nicht als Pack-ID verwendet werden`,
  versionChars: 'Eine Version besteht aus Buchstaben, Ziffern, Punkten, Bindestrichen und Pluszeichen',
  templateIdChars: 'Eine Vorlagen-ID besteht aus Kleinbuchstaben, Ziffern und einzelnen Bindestrichen und beginnt mit einem Buchstaben',
  ruleIdChars: 'Eine Regel-ID besteht aus Kleinbuchstaben, Ziffern und einzelnen Bindestrichen',
  duplicateTemplates: 'Dieselbe Vorlage wird zweimal genannt',
  duplicateSkills: 'Derselbe Skill wird zweimal genannt',
  duplicateLibrary: 'Dieselbe Bibliotheksdatei wird zweimal genannt',
  duplicateExamples: 'Dieselbe Referenzdatei wird zweimal genannt',
  duplicateQuickActions: 'Zwei Schnellaktionen haben dieselbe Bezeichnung',
  duplicateRules: 'Dieselbe Regel wird zweimal genannt',
  duplicateFiles: 'Dieselbe Datei ist zweimal in files aufgeführt',
  libraryDir: (p: { dir: string }) => `Bibliotheksdateien liegen unter ${p.dir}/`,
  libraryVoice: 'Stimmen können nicht in einem Pack mitreisen: Eine Stimme braucht die Zustimmung ihres Eigentümers',
  examplesDir: (p: { dir: string }) => `Referenzdateien liegen unter ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Eine ${p.kind}-Referenz ist eines von: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Ein Standbild ist ein Bild: ${p.extensions}`,
  styleFile: 'Der Stilleitfaden ist eine Markdown-Datei (.md) im Wurzelverzeichnis des Packs',
  reviewFile: 'Der Prüfstandard ist eine JSON-Datei im Wurzelverzeichnis des Packs',
  sha256Hex: 'sha256 besteht aus 64 Kleinbuchstaben-Hexadezimalziffern',

  // Paths inside a pack
  pathRelative: 'Der Pfad muss relativ zum Packordner sein',
  pathHidden: 'Pack-Pfade dürfen keine versteckten Dateien oder Ordner (mit Punkt am Anfang) benennen',
  fileNotNamed: (p: { path: string }) => `${p.path} wird nicht in pack.json genannt`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Er ist ${p.length} Zeichen lang; ein Stilleitfaden fasst höchstens ${p.limit}`,
  whyIgnoreInstructions: 'fordert den Agenten auf, seine Anweisungen zu ignorieren',
  whyChangeIdentity: 'versucht, die Identität des Agenten zu ändern',
  whyRevealSecrets: 'verlangt Geheimnisse oder den Prompt',
  whyCredential: 'enthält ein Zugangsdatum',
  whyCommand: 'enthält einen auszuführenden Befehl',
  whyDeleteWork: 'fordert den Agenten auf, Arbeit zu löschen',
  whySendUrl: 'fordert den Agenten auf, etwas an eine Webadresse zu senden',
  whyPromptBoundary: 'imitiert eine Prompt-Grenze',
};
