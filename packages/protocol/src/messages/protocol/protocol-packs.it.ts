import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const it: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json deve contenere un solo oggetto JSON',
  formatMissing: 'pack.json non ha "format": "cuccut.pack", quindi non è un pack di CucCut',
  foreignFormat: 'Questo è un pack agentcut: il suo pack.json non ha il campo "format". CucCut legge solo cartelle cuccut.pack',
  otherFormat: (p: { format: string }) => `pack.json dichiara il formato "${p.format}", non "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Lo schema del pack ${p.schema} non è supportato; questa versione di CucCut legge lo schema 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" non è supportato: in questa versione di CucCut i pack non contengono codice`,
  idChars: 'Un id di pack è composto da lettere minuscole, cifre e trattini singoli, e inizia con una lettera',
  idReserved: (p: { id: string }) => `"${p.id}" è un nome riservato e non può essere un id di pack`,
  versionChars: 'Una versione è composta da lettere, cifre, punti, trattini e segni più',
  templateIdChars: 'Un id di modello è composto da lettere minuscole, cifre e trattini singoli, e inizia con una lettera',
  ruleIdChars: 'Un id di regola è composto da lettere minuscole, cifre e trattini singoli',
  duplicateTemplates: 'Lo stesso modello è nominato due volte',
  duplicateSkills: 'La stessa competenza è nominata due volte',
  duplicateLibrary: 'Lo stesso file della libreria è nominato due volte',
  duplicateExamples: 'Lo stesso file di riferimento è nominato due volte',
  duplicateQuickActions: 'Due azioni rapide hanno la stessa etichetta',
  duplicateRules: 'La stessa regola è nominata due volte',
  duplicateFiles: 'Lo stesso file è elencato due volte in files',
  libraryDir: (p: { dir: string }) => `I file della libreria si trovano in ${p.dir}/`,
  libraryVoice: 'Le voci non possono viaggiare in un pack: una voce richiede il consenso del proprietario',
  examplesDir: (p: { dir: string }) => `I file di riferimento si trovano in ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Un riferimento ${p.kind} è uno tra: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Un fotogramma fisso è un’immagine: ${p.extensions}`,
  styleFile: 'La guida di stile è un file Markdown (.md) nella radice del pack',
  reviewFile: 'Lo standard di revisione è un file JSON nella radice del pack',
  sha256Hex: 'sha256 sono 64 cifre esadecimali minuscole',

  // Paths inside a pack
  pathRelative: 'Il percorso deve essere relativo alla cartella del pack',
  pathHidden: 'I percorsi di un pack non possono indicare file o cartelle nascosti (che iniziano con un punto)',
  fileNotNamed: (p: { path: string }) => `${p.path} non è indicato in pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `È lungo ${p.length} caratteri; una guida di stile ne contiene al massimo ${p.limit}`,
  whyIgnoreInstructions: 'dice all’agente di ignorare le sue istruzioni',
  whyChangeIdentity: 'cerca di cambiare chi è l’agente',
  whyRevealSecrets: 'chiede segreti o il prompt',
  whyCredential: 'contiene una credenziale',
  whyCommand: 'contiene un comando da eseguire',
  whyDeleteWork: 'chiede all’agente di eliminare del lavoro',
  whySendUrl: 'chiede all’agente di inviare qualcosa a un indirizzo web',
  whyPromptBoundary: 'imita un confine del prompt',
};
