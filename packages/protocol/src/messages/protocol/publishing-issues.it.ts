import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const it: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Approva l’esportazione fissata prima di pubblicare.',
  exportRequired: 'Esegui il rendering e fissa il video per pubblicarlo.',
  accountsRequired: 'Scegli almeno un account.',
  timezoneInvalid: 'Scegli un fuso orario valido.',
  accountUnavailable: 'Questo account non è più disponibile. Ricollegalo o scegline un altro.',
  accountDuplicateRoute: 'Lo stesso account è selezionato tramite due percorsi. Scegline uno.',
  accountNotConnected: 'Collega questo account nelle impostazioni di pubblicazione prima di inviare.',
  formatMismatch: 'Questo formato non corrisponde al network dell’account. Scegli un altro formato.',
  descriptionRequired: 'Scrivi una descrizione per questo account.',
  titleLength: (p: { max: number }) => `YouTube richiede un titolo da 1 a ${p.max} caratteri.`,
  audienceRequired: 'Indica se questo video YouTube è destinato ai bambini.',
  tagsTooLong: (p: { max: number }) => `Mantieni i tag YouTube entro ${p.max} caratteri, altrimenti YouTube potrebbe eliminarli.`,
  shortTooLong: 'Gli Short di YouTube possono durare al massimo tre minuti. Scegli Video YouTube o accorcia l’esportazione.',
  shortsClassification: 'YouTube tratta come Short i video quadrati o verticali fino a tre minuti. Scegli YouTube Short per questa esportazione.',
  portraitRequired: 'Questo formato richiede un’esportazione verticale o quadrata. Esegui il rendering di una versione verticale o scegli un altro formato.',
  captionTooLong: (p: { length: number; max: number }) => `La descrizione e gli hashtag contano ${p.length} caratteri; questo network ne consente ${p.max}. Accorciali.`,
  timeInPast: 'Questo orario è già passato. Scegli un orario futuro oppure cancellalo per inviare subito.',
  expiresBefore: 'Questa pubblicazione scade prima di andare online. Scegli un orario precedente o una scadenza successiva.',
  deliveryUnsettled:
    'Un’altra uscita di questo video verso questo account è ancora in attesa o non confermata. Registra il suo esito prima di inviare di nuovo.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'La visibilità non in elenco è disponibile solo su YouTube.',
  optionTagsYoutubeOnly: 'I tag sono disponibili solo su YouTube. Inserisci gli hashtag nella descrizione.',
  optionPhoneYoutubeTags: 'Il percorso telefono non può impostare i tag YouTube. Rimuovili o scegli un altro percorso.',
  optionPostbridgeYoutubeAudience:
    'Postbridge non può impostare pubblico o visibilità di YouTube. Accetta le impostazioni configurate in Postbridge o scegli un altro percorso.',
  optionPostgunSynthetic: 'Postgun non può aggiungere la dichiarazione di media sintetici di YouTube. Scegli un altro percorso.',
  optionYoutubeApiInteractions: 'Questo percorso non può applicare le opzioni di interazione o partnership di YouTube selezionate.',
  optionInstagramApi: 'Questo percorso non può applicare le opzioni di visibilità, dichiarazione o interazione di Instagram selezionate.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Inserisci una data e un orario validi.',
  timeRequired: 'Scegli una data e un orario.',
  timeGap: (p: { timezone: string }) => `Questo orario non esiste a ${p.timezone} perché gli orologi cambiano. Scegli un altro orario.`,
  timeFold: (p: { timezone: string }) =>
    `Questo orario si ripete due volte a ${p.timezone} perché gli orologi cambiano. Inserisci un timestamp esatto con il suo offset UTC.`,
  timestampInvalid: 'Inserisci un timestamp con il suo offset UTC, per esempio 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Nessun orario libero rientra prima della scadenza. Controlla i suoi account, gli orari settimanali e la spaziatura.',
  destinationMissing: 'Questo account non fa più parte della pubblicazione. Ricaricala e riprova.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Scegli un file di calendario CucCut (JSON) esportato da una versione supportata.',
  archiveDuplicatePublications: 'Il file di calendario elenca due volte una pubblicazione. Esportalo di nuovo dal computer originale.',
  archiveDuplicateAccounts: 'Il file di calendario elenca due volte un account. Esportalo di nuovo dal computer originale.',
  archiveDuplicateConnections: 'Il file di calendario elenca due volte una connessione. Esportalo di nuovo dal computer originale.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `«${p.label}» elenca due volte lo stesso account nel file di calendario. Esportalo di nuovo dal computer originale.`,
  archiveTimezone: (p: { timezone: string }) => `Il file di calendario usa un fuso orario sconosciuto (${p.timezone}). Esportalo di nuovo dal computer originale.`,
  archiveMissingConnection: (p: { name: string }) => `Nel file di calendario manca la connessione per «${p.name}».`,
  archiveLinkedAccount: (p: { name: string }) => `L’account collegato per «${p.name}» nel file di calendario non è valido.`,
  archiveMissingAccount: (p: { label: string }) => `Nel file di calendario manca un account usato da «${p.label}».`,
  archiveInvalidDate: (p: { label: string }) => `Il file di calendario contiene una data non valida per «${p.label}».`,
  importConnectionConflict: (p: { name: string }) =>
    `La connessione «${p.name}» nel file di calendario è in conflitto con una connessione di questo computer.`,
  importAccountConflict: (p: { name: string }) => `L’account «${p.name}» nel file di calendario è in conflitto con un account di questo computer.`,
  importedInFlight: 'Importato durante un invio. Controlla il risultato nell’app del network e registralo prima di inviare di nuovo.',
};
