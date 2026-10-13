import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const nl: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json moet één JSON-object bevatten',
  formatMissing: 'pack.json heeft geen "format": "cuccut.pack", dus het is geen CucCut-pack',
  foreignFormat: 'Dit is een agentcut-pack: de pack.json heeft geen veld "format". CucCut leest alleen cuccut.pack-mappen',
  otherFormat: (p: { format: string }) => `pack.json zegt dat het formaat "${p.format}" is, niet "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Packschema ${p.schema} wordt niet ondersteund; deze versie van CucCut leest schema 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" wordt niet ondersteund: packs bevatten in deze versie van CucCut geen code`,
  idChars: 'Een pack-id bestaat uit kleine letters, cijfers en enkele streepjes, en begint met een letter',
  idReserved: (p: { id: string }) => `"${p.id}" is een gereserveerde naam en kan geen pack-id zijn`,
  versionChars: 'Een versie bestaat uit letters, cijfers, punten, streepjes en plustekens',
  templateIdChars: 'Een sjabloon-id bestaat uit kleine letters, cijfers en enkele streepjes, en begint met een letter',
  ruleIdChars: 'Een regel-id bestaat uit kleine letters, cijfers en enkele streepjes',
  duplicateTemplates: 'Hetzelfde sjabloon is twee keer genoemd',
  duplicateSkills: 'Dezelfde vaardigheid is twee keer genoemd',
  duplicateLibrary: 'Hetzelfde bibliotheekbestand is twee keer genoemd',
  duplicateExamples: 'Hetzelfde referentiebestand is twee keer genoemd',
  duplicateQuickActions: 'Twee snelle acties hebben hetzelfde label',
  duplicateRules: 'Dezelfde regel is twee keer genoemd',
  duplicateFiles: 'Hetzelfde bestand staat twee keer in files',
  libraryDir: (p: { dir: string }) => `Bibliotheekbestanden staan onder ${p.dir}/`,
  libraryVoice: 'Stemmen kunnen niet in een pack meereizen: een stem heeft de toestemming van de eigenaar nodig',
  examplesDir: (p: { dir: string }) => `Referentiebestanden staan onder ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Een ${p.kind}-referentie is een van: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Een stilstaand beeld is een afbeelding: ${p.extensions}`,
  styleFile: 'De stijlgids is een Markdown-bestand (.md) in de hoofdmap van het pack',
  reviewFile: 'De beoordelingsstandaard is een JSON-bestand in de hoofdmap van het pack',
  sha256Hex: 'sha256 bestaat uit 64 kleine hexadecimale cijfers',

  // Paths inside a pack
  pathRelative: 'Het pad moet relatief zijn ten opzichte van de packmap',
  pathHidden: 'Paden in een pack mogen geen verborgen bestanden of mappen noemen (die met een punt beginnen)',
  fileNotNamed: (p: { path: string }) => `${p.path} wordt niet genoemd in pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Het is ${p.length} tekens lang; een stijlgids bevat maximaal ${p.limit}`,
  whyIgnoreInstructions: 'vertelt de agent zijn instructies te negeren',
  whyChangeIdentity: 'probeert te veranderen wie de agent is',
  whyRevealSecrets: 'vraagt om geheimen of de prompt',
  whyCredential: 'bevat een inloggegeven',
  whyCommand: 'bevat een opdracht om uit te voeren',
  whyDeleteWork: 'vraagt de agent werk te verwijderen',
  whySendUrl: 'vraagt de agent iets naar een webadres te sturen',
  whyPromptBoundary: 'imiteert een promptgrens',
};
