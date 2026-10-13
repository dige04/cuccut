import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const de: RuntimeStoragePublishingMessages = {
  unreadable: "Die Veröffentlichungsdaten konnten nicht gelesen werden. CucCut hat die Datei unverändert gelassen und ändert sie nicht. Stelle sie aus einer Sicherung wieder her oder verschiebe sie, um neu zu beginnen.",
  newerVersion: "Die Veröffentlichungsdaten wurden von einer neueren Version von CucCut gespeichert. Aktualisiere CucCut, um sie zu ändern; bis dahin kannst du sie nur ansehen.",
  conflict: "Diese Veröffentlichung wurde an anderer Stelle geändert. Lade die gespeicherte Version neu, bevor du deine Änderungen übernimmst.",
  settingsConflict: "Die Veröffentlichungseinstellungen wurden an anderer Stelle geändert. Lade sie vor dem Speichern neu.",
  notFound: "Diese Veröffentlichung existiert nicht mehr.",
  invalidRecord: "Diese Änderung würde einen Veröffentlichungseintrag unvollständig machen, deshalb wurde sie nicht gespeichert. Prüfe die Werte und versuche es erneut.",
  writeFailed: "Die Veröffentlichungsdaten konnten nicht auf der Festplatte gespeichert werden. Prüfe, ob genügend Speicherplatz frei ist und CucCut in seinen Ordner schreiben kann, und versuche es dann erneut.",
};
