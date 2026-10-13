import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const nl: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Keur de vastgezette export goed voordat je publiceert.',
  exportRequired: 'Render en zet de video vast om hem te publiceren.',
  accountsRequired: 'Kies minstens één account.',
  timezoneInvalid: 'Kies een geldige tijdzone.',
  accountUnavailable: 'Dit account is niet meer beschikbaar. Verbind het opnieuw of kies een ander account.',
  accountDuplicateRoute: 'Hetzelfde account is via twee routes geselecteerd. Kies één route.',
  accountNotConnected: 'Verbind dit account in de publicatie-instellingen voordat je verzendt.',
  formatMismatch: 'Dit formaat past niet bij het netwerk van het account. Kies een ander formaat.',
  descriptionRequired: 'Schrijf een beschrijving voor dit account.',
  titleLength: (p: { max: number }) => `YouTube vereist een titel van 1 tot ${p.max} tekens.`,
  audienceRequired: 'Kies of deze YouTube-video voor kinderen is gemaakt.',
  tagsTooLong: (p: { max: number }) => `Houd YouTube-tags binnen ${p.max} tekens, anders kan YouTube ze laten vallen.`,
  shortTooLong: 'YouTube Shorts mogen maximaal drie minuten duren. Kies YouTube-video of verkort de export.',
  shortsClassification: 'YouTube behandelt vierkante of verticale video’s tot drie minuten als Shorts. Kies voor deze export YouTube Short.',
  portraitRequired: 'Dit formaat vereist een staande of vierkante export. Render een verticale versie of kies een ander formaat.',
  captionTooLong: (p: { length: number; max: number }) => `De beschrijving en hashtags zijn ${p.length} tekens; dit netwerk staat ${p.max} toe. Maak ze korter.`,
  timeInPast: 'Dit tijdstip is voorbij. Kies een tijdstip in de toekomst of wis het om nu te verzenden.',
  expiresBefore: 'Deze publicatie verloopt voordat ze live gaat. Kies een eerder tijdstip of een latere vervaldatum.',
  deliveryUnsettled:
    'Een andere release van deze video naar dit account wacht nog of is niet bevestigd. Leg het resultaat vast voordat je opnieuw verzendt.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'Niet-vermelde zichtbaarheid is alleen beschikbaar op YouTube.',
  optionTagsYoutubeOnly: 'Tags zijn alleen beschikbaar op YouTube. Zet hashtags in plaats daarvan in de beschrijving.',
  optionPhoneYoutubeTags: 'De telefoonroute kan geen YouTube-tags instellen. Verwijder ze of kies een andere route.',
  optionPostbridgeYoutubeAudience:
    'Postbridge kan het YouTube-publiek of de zichtbaarheid niet instellen. Accepteer de instellingen die in Postbridge zijn geconfigureerd of kies een andere route.',
  optionPostgunSynthetic: 'Postgun kan de YouTube-vermelding voor synthetische media niet toevoegen. Kies een andere route.',
  optionYoutubeApiInteractions: 'Deze route kan de geselecteerde YouTube-interactie- of partnerschapsopties niet toepassen.',
  optionInstagramApi: 'Deze route kan de geselecteerde Instagram-opties voor zichtbaarheid, vermelding of interactie niet toepassen.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Voer een geldige datum en tijd in.',
  timeRequired: 'Kies een datum en tijd.',
  timeGap: (p: { timezone: string }) => `Deze tijd bestaat niet in ${p.timezone} omdat de klokken veranderen. Kies een andere tijd.`,
  timeFold: (p: { timezone: string }) =>
    `Deze tijd komt in ${p.timezone} twee keer voor omdat de klokken veranderen. Voer een exact tijdstempel in met de UTC-offset.`,
  timestampInvalid: 'Voer een tijdstempel in met de UTC-offset, zoals 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Er past geen vrije tijd voor het verloopt. Controleer de accounts, de wekelijkse tijden en de tussentijd.',
  destinationMissing: 'Dit account maakt niet langer deel uit van de publicatie. Laad haar opnieuw en probeer het nog eens.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Kies een CucCut-kalenderbestand (JSON) dat is geëxporteerd door een ondersteunde versie.',
  archiveDuplicatePublications: 'Het kalenderbestand vermeldt een publicatie twee keer. Exporteer het opnieuw vanaf de oorspronkelijke computer.',
  archiveDuplicateAccounts: 'Het kalenderbestand vermeldt een account twee keer. Exporteer het opnieuw vanaf de oorspronkelijke computer.',
  archiveDuplicateConnections: 'Het kalenderbestand vermeldt een verbinding twee keer. Exporteer het opnieuw vanaf de oorspronkelijke computer.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `„${p.label}” vermeldt hetzelfde account twee keer in het kalenderbestand. Exporteer het opnieuw vanaf de oorspronkelijke computer.`,
  archiveTimezone: (p: { timezone: string }) => `Het kalenderbestand gebruikt een onbekende tijdzone (${p.timezone}). Exporteer het opnieuw vanaf de oorspronkelijke computer.`,
  archiveMissingConnection: (p: { name: string }) => `Het kalenderbestand mist de verbinding voor „${p.name}”.`,
  archiveLinkedAccount: (p: { name: string }) => `Het gekoppelde account voor „${p.name}” in het kalenderbestand is ongeldig.`,
  archiveMissingAccount: (p: { label: string }) => `Het kalenderbestand mist een account dat door „${p.label}” wordt gebruikt.`,
  archiveInvalidDate: (p: { label: string }) => `Het kalenderbestand heeft een ongeldige datum voor „${p.label}”.`,
  importConnectionConflict: (p: { name: string }) =>
    `De verbinding „${p.name}” in het kalenderbestand conflicteert met een verbinding op deze computer.`,
  importAccountConflict: (p: { name: string }) => `Het account „${p.name}” in het kalenderbestand conflicteert met een account op deze computer.`,
  importedInFlight: 'Geïmporteerd tijdens een verzending. Controleer het resultaat in de app van het netwerk en leg het vast voordat je opnieuw verzendt.',
};
