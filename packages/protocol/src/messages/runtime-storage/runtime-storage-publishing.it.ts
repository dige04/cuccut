import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const it: RuntimeStoragePublishingMessages = {
  unreadable: "Impossibile leggere i dati di pubblicazione. CucCut ha lasciato il file così com'è e non lo modificherà. Ripristinalo da un backup oppure spostalo altrove per ricominciare da capo.",
  newerVersion: "I dati di pubblicazione sono stati salvati da una versione più recente di CucCut. Aggiorna CucCut per modificarli; fino ad allora puoi solo visualizzarli.",
  conflict: "Questa pubblicazione è stata modificata altrove. Ricarica la versione salvata prima di applicare le tue modifiche.",
  settingsConflict: "Le impostazioni di pubblicazione sono state modificate altrove. Ricaricale prima di salvare.",
  notFound: "Questa pubblicazione non esiste più.",
  invalidRecord: "Questa modifica lascerebbe un record di pubblicazione incompleto, quindi non è stata salvata. Controlla i valori e riprova.",
  writeFailed: "Impossibile salvare i dati di pubblicazione su disco. Verifica che ci sia spazio disponibile e che CucCut possa scrivere nella sua cartella, poi riprova.",
};
