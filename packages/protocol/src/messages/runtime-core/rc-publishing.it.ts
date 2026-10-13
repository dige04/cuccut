import type { RcPublishingMessages } from './rc-publishing.ts';

export const it: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Solo il proprietario può farlo, nell’app CucCut su questo computer.',
  desktopOnly: 'Autorizzare, inviare, registrare esiti e gestire le connessioni sono disponibili solo nell’app CucCut su questo computer.',
  settingsOwnerOnly: 'Solo il proprietario può cambiare il programma di pubblicazione. Chiedigli di cambiarlo nelle impostazioni di pubblicazione.',
  transferNotAllowed: 'L’importazione e l’esportazione del calendario sono disponibili nell’app CucCut e nella riga di comando.',
  authorizationRequired: 'Il proprietario deve autorizzare questa esatta pubblicazione in CucCut prima che un agente possa inviarla.',
  // Publications.
  publicationArchived: 'Questa pubblicazione è archiviata. Ripristinala prima di modificarla.',
  publicationLocked: 'Le destinazioni inviate mantengono il contenuto condiviso. Modifica una destinazione non riuscita o prepara una nuova uscita.',
  destinationLocked: 'La consegna per questo account è già iniziata. Ritirala o registra il suo esito prima di modificarla.',
  destinationKept: 'Una destinazione inviata resta nella pubblicazione. Ritirala o registra il suo esito prima di rimuoverla.',
  destinationAccountFixed: 'Per usare un altro account, rimuovi questa destinazione e aggiungi invece l’account.',
  destinationNotFound: 'Questo account non fa più parte della pubblicazione. Ricaricala e riprova.',
  duplicateAccount: 'Scegli ogni account una sola volta.',
  duplicatePlacement: 'Scegli l’orario di ogni account una sola volta.',
  afterExpiry: 'Scegli un orario prima che questa pubblicazione scada.',
  invalid: 'Questa pubblicazione non è ancora pronta. Correggi i problemi elencati, poi riprova.',
  nothingToSend: 'Tutti gli account di questa pubblicazione sono già stati inviati. Prepara una nuova uscita per inviarla di nuovo.',
  slotTaken: (p: { account: string }) =>
    `Questo orario è in conflitto con un’altra pubblicazione per ${p.account}. Scegli un altro orario oppure consenti meno tempo tra i post nelle impostazioni di pubblicazione.`,
  slotsHaveDestinationTimes:
    'Alcune di queste pubblicazioni hanno un orario proprio per un account. Rimuovi quegli orari prima di prenotare orari condivisi.',
  calendarRange: 'Scegli un intervallo di calendario di massimo 93 giorni, con l’inizio prima della fine.',
  archiveInFlight: 'Ritira le consegne in attesa o registra il loro esito prima di archiviare questa pubblicazione.',
  // Delivery.
  providerUnsupported: 'Questa versione di CucCut pubblica solo a mano. Scegli A mano per questa connessione.',
  notWaiting: 'Si può ritirare solo un account in attesa di te.',
  cancelNotAllowed: 'Si può annullare solo un account che non è stato inviato. Ritiralo, oppure registra prima il suo esito.',
  reconcileFinal: 'Una consegna pubblicata o annullata fa parte della cronologia. Prepara una nuova uscita invece di modificarla.',
  reconcileSending: 'Attendi che la consegna in corso finisca prima di registrare un esito.',
  reconcileFutureTime: 'Inserisci l’orario futuro che il network mostra per questo post.',
  // Pinned exports.
  exportRequired: 'Esegui prima il rendering e fissa il video.',
  exportChanged: 'L’esportazione approvata è cambiata. Fissa un’esportazione verificata prima di pubblicare.',
  exportStale: 'Esporta la revisione attuale prima di fissarla, oppure scegli Esegui il rendering e fissa.',
  exportNotFinished: 'Questa esportazione non è ancora terminata. Attendi oppure scegli un’altra esportazione.',
  exportNotVideo: 'Scegli un’esportazione MP4 completata dell’intero video.',
  exportOtherVideo: 'Questa esportazione appartiene a un altro video o sequenza. Scegli un’esportazione di questo video.',
  exportFileMissing: 'Il file esportato non è più su questo computer. Esegui di nuovo il rendering e fissa il video.',
  exportFileChanged: 'Il file esportato è cambiato dopo il rendering. Esegui di nuovo il rendering e fissa il video.',
  pinLocked: 'Le destinazioni inviate mantengono la loro esportazione fissata. Prepara una nuova uscita per usare un’altra esportazione.',
  renderFailed: 'L’esportazione di questa pubblicazione non è terminata. Esegui di nuovo il rendering e fissala.',
  renderCancelled: 'L’esportazione di questa pubblicazione è stata annullata. Esegui di nuovo il rendering e fissala quando sei pronto.',
  videoNotFound: 'Questo video non è su questo computer. Apri il suo progetto e riprova.',
  // Settings, connections and accounts.
  accountNotFound: 'Questo account non esiste più. Ricarica le impostazioni di pubblicazione e riprova.',
  connectionNotFound: 'Questa connessione non esiste più. Ricarica le impostazioni di pubblicazione e riprova.',
  defaultAccountMissing: 'Un account predefinito non esiste più. Scegli di nuovo gli account predefiniti.',
  connectionProviderFixed: 'Una connessione mantiene il percorso con cui è stata aggiunta. Aggiungi una nuova connessione per pubblicare in un altro modo.',
  accountIdentityFixed: 'Un account mantiene la sua connessione e il suo network. Aggiungi invece un nuovo account.',
  accountDuplicate: 'Questo account è già aggiunto a questa connessione.',
  accountInUse: (p: { name: string }) =>
    `${p.name} ha un post in attesa, programmato o non confermato. Registra il suo esito prima di rimuovere l’account.`,
  linkInvalid: 'Scegli un altro account dello stesso network che non sia a sua volta collegato.',
  linkCanonical: 'Altri account sono collegati a questo. Collega invece l’altro percorso a questo account.',
  // Copy proposals.
  proposalReason: 'Bozza basata sul video, sulla sua trascrizione e sulle tue linee guida di scrittura. Rivedila prima di applicarla.',
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'Pubblicazione CucCut',
  // Calendar transfer and cleanup.
  backupFailed: 'Non è stato possibile scrivere un backup dei dati di pubblicazione, quindi non è stato importato nulla. Controlla il disco e riprova.',
};
