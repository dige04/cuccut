import type { RcPublishingMessages } from './rc-publishing.ts';

export const pl: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Tylko właściciel może to zrobić, w aplikacji CucCut na tym komputerze.',
  desktopOnly: 'Autoryzowanie, wysyłanie, zapisywanie wyników i zarządzanie połączeniami są dostępne tylko w aplikacji CucCut na tym komputerze.',
  settingsOwnerOnly: 'Tylko właściciel może zmienić harmonogram publikacji. Poproś go, aby zmienił go w ustawieniach publikacji.',
  transferNotAllowed: 'Import i eksport kalendarza są dostępne w aplikacji CucCut oraz w wierszu poleceń.',
  authorizationRequired: 'Właściciel musi autoryzować tę dokładną publikację w CucCut, zanim agent będzie mógł ją wysłać.',
  // Publications.
  publicationArchived: 'Ta publikacja jest zarchiwizowana. Przywróć ją, zanim ją zmienisz.',
  publicationLocked: 'Wysłane miejsca docelowe zachowują wspólną treść. Edytuj nieudane miejsce docelowe albo przygotuj nową premierę.',
  destinationLocked: 'Dostarczanie dla tego konta już się rozpoczęło. Wycofaj je albo zapisz jego wynik, zanim je zmienisz.',
  destinationKept: 'Wysłane miejsce docelowe pozostaje w publikacji. Wycofaj je albo zapisz jego wynik, zanim je usuniesz.',
  destinationAccountFixed: 'Aby użyć innego konta, usuń to miejsce docelowe i zamiast tego dodaj konto.',
  destinationNotFound: 'To konto nie jest już częścią publikacji. Wczytaj ją ponownie i spróbuj jeszcze raz.',
  duplicateAccount: 'Każde konto wybierz tylko raz.',
  duplicatePlacement: 'Godzinę każdego konta wybierz tylko raz.',
  afterExpiry: 'Wybierz godzinę przed wygaśnięciem tej publikacji.',
  invalid: 'Ta publikacja nie jest jeszcze gotowa. Popraw wymienione problemy i spróbuj ponownie.',
  nothingToSend: 'Wszystkie konta w tej publikacji zostały już wysłane. Przygotuj nową premierę, aby wysłać ją ponownie.',
  slotTaken: (p: { account: string }) =>
    `Ta godzina koliduje z inną publikacją dla konta ${p.account}. Wybierz inną godzinę albo w ustawieniach publikacji dopuść mniejszy odstęp między postami.`,
  slotsHaveDestinationTimes:
    'Niektóre z tych publikacji mają własną godzinę dla jednego konta. Usuń te godziny przed rezerwowaniem wspólnych godzin.',
  calendarRange: 'Wybierz zakres kalendarza do 93 dni, z początkiem przed końcem.',
  archiveInFlight: 'Przed zarchiwizowaniem tej publikacji wycofaj oczekujące dostarczenia albo zapisz ich wyniki.',
  // Delivery.
  providerUnsupported: 'Ta wersja CucCut publikuje wyłącznie ręcznie. Wybierz Ręcznie dla tego połączenia.',
  notWaiting: 'Wycofać można tylko konto, które czeka na Ciebie.',
  cancelNotAllowed: 'Anulować można tylko konto, które nie zostało wysłane. Wycofaj je albo najpierw zapisz jego wynik.',
  reconcileFinal: 'Opublikowane lub anulowane dostarczenie jest częścią historii. Zamiast je zmieniać, przygotuj nową premierę.',
  reconcileSending: 'Zanim zapiszesz wynik, poczekaj, aż bieżące dostarczenie się zakończy.',
  reconcileFutureTime: 'Wpisz przyszłą godzinę, którą sieć pokazuje dla tego posta.',
  // Pinned exports.
  exportRequired: 'Najpierw wyrenderuj i przypnij wideo.',
  exportChanged: 'Zatwierdzony eksport się zmienił. Przed publikacją przypnij zweryfikowany eksport.',
  exportStale: 'Przed przypięciem wyeksportuj bieżącą wersję albo wybierz Renderuj i przypnij.',
  exportNotFinished: 'Ten eksport jeszcze się nie zakończył. Poczekaj na niego albo wybierz inny eksport.',
  exportNotVideo: 'Wybierz gotowy eksport MP4 całego wideo.',
  exportOtherVideo: 'Ten eksport należy do innego wideo lub sekwencji. Wybierz eksport tego wideo.',
  exportFileMissing: 'Wyeksportowanego pliku nie ma już na tym komputerze. Wyrenderuj i przypnij wideo ponownie.',
  exportFileChanged: 'Wyeksportowany plik zmienił się po wyrenderowaniu. Wyrenderuj i przypnij wideo ponownie.',
  pinLocked: 'Wysłane miejsca docelowe zachowują swój przypięty eksport. Przygotuj nową premierę, aby użyć innego eksportu.',
  renderFailed: 'Eksport dla tej publikacji się nie zakończył. Wyrenderuj i przypnij go ponownie.',
  renderCancelled: 'Eksport dla tej publikacji został anulowany. Wyrenderuj i przypnij go ponownie, gdy będziesz gotowy.',
  videoNotFound: 'Tego wideo nie ma na tym komputerze. Otwórz jego projekt i spróbuj ponownie.',
  // Settings, connections and accounts.
  accountNotFound: 'To konto już nie istnieje. Wczytaj ustawienia publikacji i spróbuj ponownie.',
  connectionNotFound: 'To połączenie już nie istnieje. Wczytaj ustawienia publikacji i spróbuj ponownie.',
  defaultAccountMissing: 'Domyślne konto już nie istnieje. Wybierz domyślne konta ponownie.',
  connectionProviderFixed: 'Połączenie zachowuje trasę, z którą zostało dodane. Dodaj nowe połączenie, aby publikować w inny sposób.',
  accountIdentityFixed: 'Konto zachowuje swoje połączenie i sieć. Zamiast tego dodaj nowe konto.',
  accountDuplicate: 'To konto jest już dodane do tego połączenia.',
  accountInUse: (p: { name: string }) =>
    `${p.name} ma post, który czeka, jest zaplanowany albo niepotwierdzony. Zapisz jego wynik, zanim usuniesz konto.`,
  linkInvalid: 'Wybierz inne konto w tej samej sieci, które samo nie jest powiązane.',
  linkCanonical: 'Inne konta są powiązane z tym kontem. Zamiast tego powiąż drugą trasę z tym kontem.',
  // Copy proposals.
  proposalReason: 'Szkic oparty na wideo, jego transkrypcji i Twoich wytycznych pisania. Sprawdź go przed zastosowaniem.',
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'Publikacja CucCut',
  // Calendar transfer and cleanup.
  backupFailed: 'Nie udało się zapisać kopii zapasowej danych publikacji, więc nic nie zostało zaimportowane. Sprawdź dysk i spróbuj ponownie.',
};
