import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const pl: RuntimeStoragePublishingMessages = {
  unreadable: "Nie udało się odczytać danych publikacji. CucCut pozostawił plik bez zmian i go nie zmieni. Przywróć go z kopii zapasowej albo przenieś go, aby zacząć od nowa.",
  newerVersion: "Dane publikacji zostały zapisane przez nowszą wersję CucCut. Zaktualizuj CucCut, aby je zmienić; do tego czasu możesz je tylko przeglądać.",
  conflict: "Ta publikacja została zmieniona w innym miejscu. Wczytaj zapisaną wersję, zanim zastosujesz swoje zmiany.",
  settingsConflict: "Ustawienia publikacji zostały zmienione w innym miejscu. Wczytaj je ponownie przed zapisaniem.",
  notFound: "Ta publikacja już nie istnieje.",
  invalidRecord: "Ta zmiana pozostawiłaby rekord publikacji niekompletny, dlatego nie została zapisana. Sprawdź wartości i spróbuj ponownie.",
  writeFailed: "Nie udało się zapisać danych publikacji na dysku. Sprawdź, czy na dysku jest miejsce i czy CucCut może zapisywać w swoim folderze, a następnie spróbuj ponownie.",
};
