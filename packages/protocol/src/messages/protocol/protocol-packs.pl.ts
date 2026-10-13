import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const pl: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json musi zawierać jeden obiekt JSON',
  formatMissing: 'pack.json nie ma "format": "cuccut.pack", więc to nie jest pakiet CucCut',
  foreignFormat: 'To pakiet agentcut: jego pack.json nie ma pola "format". CucCut czyta tylko foldery cuccut.pack',
  otherFormat: (p: { format: string }) => `pack.json podaje format "${p.format}", a nie "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Schemat pakietu ${p.schema} nie jest obsługiwany; ta wersja CucCut czyta schemat 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" nie jest obsługiwane: pakiety w tej wersji CucCut nie zawierają kodu`,
  idChars: 'Id pakietu składa się z małych liter, cyfr i pojedynczych myślników i zaczyna się od litery',
  idReserved: (p: { id: string }) => `„${p.id}” jest zarezerwowaną nazwą i nie może być id pakietu`,
  versionChars: 'Wersja składa się z liter, cyfr, kropek, myślników i znaków plus',
  templateIdChars: 'Id szablonu składa się z małych liter, cyfr i pojedynczych myślników i zaczyna się od litery',
  ruleIdChars: 'Id reguły składa się z małych liter, cyfr i pojedynczych myślników',
  duplicateTemplates: 'Ten sam szablon jest nazwany dwa razy',
  duplicateSkills: 'Ta sama umiejętność jest nazwana dwa razy',
  duplicateLibrary: 'Ten sam plik biblioteki jest nazwany dwa razy',
  duplicateExamples: 'Ten sam plik referencyjny jest nazwany dwa razy',
  duplicateQuickActions: 'Dwie szybkie akcje mają tę samą etykietę',
  duplicateRules: 'Ta sama reguła jest nazwana dwa razy',
  duplicateFiles: 'Ten sam plik jest dwa razy wymieniony w files',
  libraryDir: (p: { dir: string }) => `Pliki biblioteki znajdują się w ${p.dir}/`,
  libraryVoice: 'Głosy nie mogą podróżować w pakiecie: głos wymaga zgody właściciela',
  examplesDir: (p: { dir: string }) => `Pliki referencyjne znajdują się w ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Referencja typu ${p.kind} to jeden z formatów: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Kadr to obraz: ${p.extensions}`,
  styleFile: 'Przewodnik stylu to plik Markdown (.md) w katalogu głównym pakietu',
  reviewFile: 'Standard recenzji to plik JSON w katalogu głównym pakietu',
  sha256Hex: 'sha256 to 64 małe cyfry szesnastkowe',

  // Paths inside a pack
  pathRelative: 'Ścieżka musi być względna wobec folderu pakietu',
  pathHidden: 'Ścieżki w pakiecie nie mogą wskazywać ukrytych plików ani folderów (zaczynających się od kropki)',
  fileNotNamed: (p: { path: string }) => `${p.path} nie jest nazwany w pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Ma ${p.length} znaków; przewodnik stylu może mieć najwyżej ${p.limit}`,
  whyIgnoreInstructions: 'każe agentowi ignorować jego instrukcje',
  whyChangeIdentity: 'próbuje zmienić to, kim jest agent',
  whyRevealSecrets: 'prosi o sekrety albo prompt',
  whyCredential: 'zawiera poświadczenie',
  whyCommand: 'zawiera polecenie do uruchomienia',
  whyDeleteWork: 'prosi agenta o usunięcie pracy',
  whySendUrl: 'prosi agenta o wysłanie czegoś na adres internetowy',
  whyPromptBoundary: 'naśladuje granicę promptu',
};
