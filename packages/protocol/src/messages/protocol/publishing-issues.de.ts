import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const de: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Gib den angehefteten Export frei, bevor du veröffentlichst.',
  exportRequired: 'Rendere und hefte das Video an, um es zu veröffentlichen.',
  accountsRequired: 'Wähle mindestens ein Konto.',
  timezoneInvalid: 'Wähle eine gültige Zeitzone.',
  accountUnavailable: 'Dieses Konto ist nicht mehr verfügbar. Verbinde es neu oder wähle ein anderes Konto.',
  accountDuplicateRoute: 'Dasselbe Konto ist über zwei Wege ausgewählt. Wähle einen Weg.',
  accountNotConnected: 'Verbinde dieses Konto in den Veröffentlichungseinstellungen, bevor du sendest.',
  formatMismatch: 'Dieses Format passt nicht zum Netzwerk des Kontos. Wähle ein anderes Format.',
  descriptionRequired: 'Schreibe eine Beschreibung für dieses Konto.',
  titleLength: (p: { max: number }) => `YouTube benötigt einen Titel mit 1 bis ${p.max} Zeichen.`,
  audienceRequired: 'Wähle, ob dieses YouTube-Video für Kinder bestimmt ist.',
  tagsTooLong: (p: { max: number }) => `Halte YouTube-Tags innerhalb von ${p.max} Zeichen, sonst könnte YouTube sie entfernen.`,
  shortTooLong: 'YouTube Shorts dürfen höchstens drei Minuten lang sein. Wähle YouTube-Video oder kürze den Export.',
  shortsClassification: 'YouTube behandelt quadratische oder vertikale Videos bis zu drei Minuten als Shorts. Wähle für diesen Export YouTube Short.',
  portraitRequired: 'Dieses Format benötigt einen Hoch- oder quadratischen Export. Rendere eine vertikale Version oder wähle ein anderes Format.',
  captionTooLong: (p: { length: number; max: number }) => `Beschreibung und Hashtags haben ${p.length} Zeichen; dieses Netzwerk erlaubt ${p.max}. Kürze sie.`,
  timeInPast: 'Diese Zeit ist vorbei. Wähle eine Zeit in der Zukunft oder entferne sie, um jetzt zu senden.',
  expiresBefore: 'Diese Veröffentlichung läuft ab, bevor sie live geht. Wähle eine frühere Zeit oder ein späteres Ablaufdatum.',
  deliveryUnsettled:
    'Eine andere Veröffentlichung dieses Videos an dieses Konto wartet noch oder ist nicht bestätigt. Halte ihr Ergebnis fest, bevor du erneut sendest.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'Die Sichtbarkeit „Nicht gelistet“ ist nur auf YouTube verfügbar.',
  optionTagsYoutubeOnly: 'Tags sind nur auf YouTube verfügbar. Setze stattdessen Hashtags in die Beschreibung.',
  optionPhoneYoutubeTags: 'Der Telefon-Weg kann keine YouTube-Tags setzen. Entferne sie oder wähle einen anderen Weg.',
  optionPostbridgeYoutubeAudience:
    'Postbridge kann Zielgruppe oder Sichtbarkeit von YouTube nicht setzen. Akzeptiere die in Postbridge konfigurierten Einstellungen oder wähle einen anderen Weg.',
  optionPostgunSynthetic: 'Postgun kann den YouTube-Hinweis auf synthetische Medien nicht hinzufügen. Wähle einen anderen Weg.',
  optionYoutubeApiInteractions: 'Dieser Weg kann die gewählten YouTube-Interaktions- oder Partneroptionen nicht anwenden.',
  optionInstagramApi: 'Dieser Weg kann die gewählten Instagram-Sichtbarkeits-, Kennzeichnungs- oder Interaktionsoptionen nicht anwenden.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Gib ein gültiges Datum und eine gültige Uhrzeit ein.',
  timeRequired: 'Wähle ein Datum und eine Uhrzeit.',
  timeGap: (p: { timezone: string }) => `Diese Zeit existiert in ${p.timezone} nicht, weil die Uhren umgestellt werden. Wähle eine andere Zeit.`,
  timeFold: (p: { timezone: string }) =>
    `Diese Zeit tritt in ${p.timezone} zweimal auf, weil die Uhren umgestellt werden. Gib einen genauen Zeitstempel mit seinem UTC-Versatz ein.`,
  timestampInvalid: 'Gib einen Zeitstempel mit seinem UTC-Versatz ein, z. B. 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Vor dem Ablauf passt keine freie Zeit. Prüfe seine Konten, die wöchentlichen Zeiten und den Abstand.',
  destinationMissing: 'Dieses Konto ist nicht mehr Teil der Veröffentlichung. Lade sie neu und versuche es erneut.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Wähle eine von einer unterstützten Version exportierte CucCut-Kalenderdatei (JSON).',
  archiveDuplicatePublications: 'Die Kalenderdatei führt eine Veröffentlichung zweimal auf. Exportiere sie vom ursprünglichen Computer erneut.',
  archiveDuplicateAccounts: 'Die Kalenderdatei führt ein Konto zweimal auf. Exportiere sie vom ursprünglichen Computer erneut.',
  archiveDuplicateConnections: 'Die Kalenderdatei führt eine Verbindung zweimal auf. Exportiere sie vom ursprünglichen Computer erneut.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `„${p.label}“ führt in der Kalenderdatei dasselbe Konto zweimal auf. Exportiere sie vom ursprünglichen Computer erneut.`,
  archiveTimezone: (p: { timezone: string }) => `Die Kalenderdatei verwendet eine unbekannte Zeitzone (${p.timezone}). Exportiere sie vom ursprünglichen Computer erneut.`,
  archiveMissingConnection: (p: { name: string }) => `In der Kalenderdatei fehlt die Verbindung für „${p.name}“.`,
  archiveLinkedAccount: (p: { name: string }) => `Das verknüpfte Konto für „${p.name}“ in der Kalenderdatei ist ungültig.`,
  archiveMissingAccount: (p: { label: string }) => `In der Kalenderdatei fehlt ein Konto, das „${p.label}“ verwendet.`,
  archiveInvalidDate: (p: { label: string }) => `Die Kalenderdatei enthält ein ungültiges Datum für „${p.label}“.`,
  importConnectionConflict: (p: { name: string }) =>
    `Die Verbindung „${p.name}“ in der Kalenderdatei steht im Konflikt mit einer Verbindung auf diesem Computer.`,
  importAccountConflict: (p: { name: string }) => `Das Konto „${p.name}“ in der Kalenderdatei steht im Konflikt mit einem Konto auf diesem Computer.`,
  importedInFlight: 'Beim Import lief eine Zustellung. Prüfe das Ergebnis in der App des Netzwerks und halte es fest, bevor du erneut sendest.',
};
