import type { RcPublishingMessages } from './rc-publishing.ts';

export const de: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Nur der Eigentümer kann das tun, in der CucCut-App auf diesem Computer.',
  desktopOnly: 'Autorisieren, Senden, Ergebnisse festhalten und Verbindungen verwalten sind nur in der CucCut-App auf diesem Computer verfügbar.',
  settingsOwnerOnly: 'Nur der Eigentümer kann den Veröffentlichungszeitplan ändern. Bitte ihn, dies in den Veröffentlichungseinstellungen zu tun.',
  transferNotAllowed: 'Kalenderimport und -export sind in der CucCut-App und in der Kommandozeile verfügbar.',
  authorizationRequired: 'Der Eigentümer muss diese genaue Veröffentlichung in CucCut autorisieren, bevor ein Agent sie senden kann.',
  // Publications.
  publicationArchived: 'Diese Veröffentlichung ist archiviert. Stelle sie wieder her, bevor du sie änderst.',
  publicationLocked: 'Gesendete Ziele behalten ihren gemeinsamen Inhalt. Bearbeite ein fehlgeschlagenes Ziel oder bereite eine neue Veröffentlichung vor.',
  destinationLocked: 'Die Zustellung für dieses Konto hat bereits begonnen. Zieh sie zurück oder halte ihr Ergebnis fest, bevor du sie änderst.',
  destinationKept: 'Ein gesendetes Ziel bleibt in der Veröffentlichung. Zieh es zurück oder halte sein Ergebnis fest, bevor du es entfernst.',
  destinationAccountFixed: 'Um ein anderes Konto zu verwenden, entferne dieses Ziel und füge stattdessen das Konto hinzu.',
  destinationNotFound: 'Dieses Konto ist nicht mehr Teil der Veröffentlichung. Lade sie neu und versuche es erneut.',
  duplicateAccount: 'Wähle jedes Konto nur einmal.',
  duplicatePlacement: 'Wähle die Zeit jedes Kontos nur einmal.',
  afterExpiry: 'Wähle eine Zeit, bevor diese Veröffentlichung abläuft.',
  invalid: 'Diese Veröffentlichung ist noch nicht bereit. Behebe die aufgelisteten Probleme und versuche es erneut.',
  nothingToSend: 'Alle Konten dieser Veröffentlichung wurden bereits gesendet. Bereite eine neue Veröffentlichung vor, um sie erneut zu senden.',
  slotTaken: (p: { account: string }) =>
    `Diese Zeit kollidiert mit einer anderen Veröffentlichung für ${p.account}. Wähle eine andere Zeit oder erlaube in den Veröffentlichungseinstellungen weniger Abstand zwischen Beiträgen.`,
  calendarRange: 'Wähle einen Kalenderzeitraum von höchstens 93 Tagen, wobei der Beginn vor dem Ende liegt.',
  archiveInFlight: 'Zieh wartende Zustellungen zurück oder halte ihre Ergebnisse fest, bevor du diese Veröffentlichung archivierst.',
  // Delivery.
  providerUnsupported: 'Diese Version von CucCut veröffentlicht nur manuell. Wähle für diese Verbindung Manuell.',
  notWaiting: 'Nur ein Konto, das auf dich wartet, kann zurückgezogen werden.',
  cancelNotAllowed: 'Nur ein Konto, das nicht gesendet wurde, kann abgebrochen werden. Zieh es zurück oder halte zuerst sein Ergebnis fest.',
  reconcileFinal: 'Eine veröffentlichte oder abgebrochene Zustellung ist Teil des Verlaufs. Bereite stattdessen eine neue Veröffentlichung vor.',
  reconcileSending: 'Warte, bis die aktuelle Zustellung abgeschlossen ist, bevor du ein Ergebnis festhältst.',
  reconcileFutureTime: 'Gib die zukünftige Zeit ein, die das Netzwerk für diesen Beitrag anzeigt.',
  // Pinned exports.
  exportRequired: 'Rendere und hefte zuerst das Video an.',
  exportChanged: 'Der freigegebene Export hat sich geändert. Hefte vor dem Veröffentlichen einen geprüften Export an.',
  exportStale: 'Exportiere die aktuelle Revision, bevor du sie anheftest, oder wähle Rendern und anheften.',
  exportNotFinished: 'Dieser Export ist noch nicht fertig. Warte darauf oder wähle einen anderen Export.',
  exportNotVideo: 'Wähle einen fertigen MP4-Export des gesamten Videos.',
  exportOtherVideo: 'Dieser Export gehört zu einem anderen Video oder einer anderen Sequenz. Wähle einen Export dieses Videos.',
  exportFileMissing: 'Die exportierte Datei ist nicht mehr auf diesem Computer. Rendere und hefte das Video erneut an.',
  exportFileChanged: 'Die exportierte Datei hat sich nach dem Rendern verändert. Rendere und hefte das Video erneut an.',
  pinLocked: 'Gesendete Ziele behalten ihren angehefteten Export. Bereite eine neue Veröffentlichung vor, um einen anderen Export zu verwenden.',
  renderFailed: 'Der Export für diese Veröffentlichung wurde nicht abgeschlossen. Rendere und hefte ihn erneut an.',
  renderCancelled: 'Der Export für diese Veröffentlichung wurde abgebrochen. Rendere und hefte ihn erneut an, wenn du bereit bist.',
  videoNotFound: 'Dieses Video befindet sich nicht auf diesem Computer. Öffne sein Projekt und versuche es dann erneut.',
  sequenceNotFound: "This video has no such sequence. Leave the sequence out to publish the video's main sequence.",
  sequenceOneVideo: 'Choose a sequence only when preparing one video.',
  // Settings, connections and accounts.
  accountNotFound: 'Dieses Konto existiert nicht mehr. Lade die Veröffentlichungseinstellungen neu und versuche es erneut.',
  connectionNotFound: 'Diese Verbindung existiert nicht mehr. Lade die Veröffentlichungseinstellungen neu und versuche es erneut.',
  defaultAccountMissing: 'Ein Standardkonto existiert nicht mehr. Wähle die Standardkonten erneut aus.',
  connectionProviderFixed: 'Eine Verbindung behält den Weg, mit dem sie hinzugefügt wurde. Füge eine neue Verbindung hinzu, um auf andere Weise zu veröffentlichen.',
  accountIdentityFixed: 'Ein Konto behält seine Verbindung und sein Netzwerk. Füge stattdessen ein neues Konto hinzu.',
  accountDuplicate: 'Dieses Konto ist bereits zu dieser Verbindung hinzugefügt.',
  accountInUse: (p: { name: string }) =>
    `${p.name} hat einen Beitrag, der wartet, geplant oder nicht bestätigt ist. Halte sein Ergebnis fest, bevor du das Konto entfernst.`,
  linkInvalid: 'Wähle ein anderes Konto im selben Netzwerk, das selbst nicht verknüpft ist.',
  linkCanonical: 'Andere Konten sind mit diesem verknüpft. Verknüpfe stattdessen den anderen Weg mit diesem Konto.',
  // Copy proposals.
  proposalReason: 'Entwurf auf Grundlage des Videos, seines Transkripts und deiner Schreibrichtlinien. Prüfe ihn, bevor du ihn übernimmst.',
  proposalUnreadable: "The text model's answer couldn't be read. Try Propose text again, or write the text yourself.",
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut-Veröffentlichung',
  // Calendar transfer and cleanup.
  backupFailed: 'Eine Sicherung der Veröffentlichungsdaten konnte nicht geschrieben werden, daher wurde nichts importiert. Prüfe den Datenträger und versuche es erneut.',
};
