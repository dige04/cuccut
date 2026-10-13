import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const pl: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Zatwierdź przypięty eksport przed publikacją.',
  exportRequired: 'Wyrenderuj i przypnij wideo, aby je opublikować.',
  accountsRequired: 'Wybierz co najmniej jedno konto.',
  timezoneInvalid: 'Wybierz poprawną strefę czasową.',
  accountUnavailable: 'To konto nie jest już dostępne. Połącz je ponownie lub wybierz inne konto.',
  accountDuplicateRoute: 'To samo konto jest wybrane przez dwie trasy. Wybierz jedną trasę.',
  accountNotConnected: 'Przed wysłaniem połącz to konto w ustawieniach publikacji.',
  formatMismatch: 'Ten format nie pasuje do sieci konta. Wybierz inny format.',
  descriptionRequired: 'Napisz opis dla tego konta.',
  titleLength: (p: { max: number }) => `YouTube wymaga tytułu o długości od 1 do ${p.max} znaków.`,
  audienceRequired: 'Wskaż, czy ten film na YouTube jest przeznaczony dla dzieci.',
  tagsTooLong: (p: { max: number }) => `Ogranicz tagi YouTube do ${p.max} znaków, bo inaczej YouTube może je pominąć.`,
  shortTooLong: 'Shorts na YouTube mogą trwać najwyżej trzy minuty. Wybierz wideo YouTube lub skróć eksport.',
  shortsClassification: 'YouTube traktuje kwadratowe lub pionowe wideo do trzech minut jako Shorts. Wybierz dla tego eksportu YouTube Short.',
  portraitRequired: 'Ten format wymaga eksportu pionowego lub kwadratowego. Wyrenderuj wersję pionową albo wybierz inny format.',
  captionTooLong: (p: { length: number; max: number }) => `Opis i hashtagi mają ${p.length} znaków; ta sieć dopuszcza ${p.max}. Skróć je.`,
  timeInPast: 'Ten czas minął. Wybierz przyszły czas albo go wyczyść, aby wysłać teraz.',
  expiresBefore: 'Ta publikacja wygasa, zanim zostanie opublikowana. Wybierz wcześniejszy czas albo późniejsze wygaśnięcie.',
  deliveryUnsettled:
    'Inna premiera tego wideo na to konto nadal czeka lub nie została potwierdzona. Zapisz jej wynik, zanim wyślesz ponownie.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'Widoczność „niepubliczne” jest dostępna tylko w YouTube.',
  optionTagsYoutubeOnly: 'Tagi są dostępne tylko w YouTube. Wpisz hashtagi w opisie.',
  optionPhoneYoutubeTags: 'Trasa telefoniczna nie może ustawić tagów YouTube. Usuń je albo wybierz inną trasę.',
  optionPostbridgeYoutubeAudience:
    'Postbridge nie może ustawić odbiorców ani widoczności w YouTube. Zaakceptuj ustawienia skonfigurowane w Postbridge albo wybierz inną trasę.',
  optionPostgunSynthetic: 'Postgun nie może dodać oznaczenia treści syntetycznych YouTube. Wybierz inną trasę.',
  optionYoutubeApiInteractions: 'Ta trasa nie może zastosować wybranych opcji interakcji lub partnerstwa YouTube.',
  optionInstagramApi: 'Ta trasa nie może zastosować wybranych opcji widoczności, oznaczenia lub interakcji Instagrama.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Wpisz poprawną datę i godzinę.',
  timeRequired: 'Wybierz datę i godzinę.',
  timeGap: (p: { timezone: string }) => `Ta godzina nie istnieje w strefie ${p.timezone}, ponieważ zegary są przestawiane. Wybierz inną godzinę.`,
  timeFold: (p: { timezone: string }) =>
    `Ta godzina występuje w strefie ${p.timezone} dwa razy, ponieważ zegary są przestawiane. Wpisz dokładny znacznik czasu z przesunięciem UTC.`,
  timestampInvalid: 'Wpisz znacznik czasu z przesunięciem UTC, na przykład 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Przed wygaśnięciem nie mieści się żaden wolny termin. Sprawdź jej konta, cotygodniowe godziny i odstępy.',
  destinationMissing: 'To konto nie jest już częścią publikacji. Wczytaj ją ponownie i spróbuj jeszcze raz.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Wybierz plik kalendarza CucCut (JSON) wyeksportowany przez obsługiwaną wersję.',
  archiveDuplicatePublications: 'Plik kalendarza wymienia jedną publikację dwa razy. Wyeksportuj go ponownie z oryginalnego komputera.',
  archiveDuplicateAccounts: 'Plik kalendarza wymienia jedno konto dwa razy. Wyeksportuj go ponownie z oryginalnego komputera.',
  archiveDuplicateConnections: 'Plik kalendarza wymienia jedno połączenie dwa razy. Wyeksportuj go ponownie z oryginalnego komputera.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `„${p.label}” wymienia to samo konto dwa razy w pliku kalendarza. Wyeksportuj go ponownie z oryginalnego komputera.`,
  archiveTimezone: (p: { timezone: string }) => `Plik kalendarza używa nieznanej strefy czasowej (${p.timezone}). Wyeksportuj go ponownie z oryginalnego komputera.`,
  archiveMissingConnection: (p: { name: string }) => `W pliku kalendarza brakuje połączenia dla „${p.name}”.`,
  archiveLinkedAccount: (p: { name: string }) => `Powiązane konto dla „${p.name}” w pliku kalendarza jest nieprawidłowe.`,
  archiveMissingAccount: (p: { label: string }) => `W pliku kalendarza brakuje konta używanego przez „${p.label}”.`,
  archiveInvalidDate: (p: { label: string }) => `Plik kalendarza zawiera nieprawidłową datę dla „${p.label}”.`,
  importConnectionConflict: (p: { name: string }) =>
    `Połączenie „${p.name}” w pliku kalendarza koliduje z połączeniem na tym komputerze.`,
  importAccountConflict: (p: { name: string }) => `Konto „${p.name}” w pliku kalendarza koliduje z kontem na tym komputerze.`,
  importedInFlight: 'Zaimportowano w trakcie dostarczania. Sprawdź wynik w aplikacji sieci i zapisz go, zanim wyślesz ponownie.',
};
