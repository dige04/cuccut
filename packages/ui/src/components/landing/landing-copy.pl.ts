import type { LandingMessages } from './landing-copy.ts';

const plural = (count: number, one: string, few: string, many: string) => {
  if (count === 1) return `${count} ${one}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
};

export const pl: LandingMessages = {
  tabs: 'Zacznij wideo',
  create: 'Utwórz wideo',
  clip: 'Potnij długie wideo',
  heading: 'Jakie wideo zrobisz?',
  lede: 'Opisz swoje wideo, dołącz materiał lub zacznij od szablonu.',
  composerLabel: 'Opisz swoje wideo',
  blank: {
    toggle: 'Puste płótno',
    hint: 'Wybierz format, aby otworzyć puste wideo w edytorze',
    group: 'Formaty pustego płótna',
    shapes: { wide: 'Panoramiczny', vertical: 'Pionowy', portrait: 'Portretowy', square: 'Kwadrat' },
    create: (shape, ratio) => `Nowe puste wideo: ${shape} ${ratio}`,
  },
  quickStartBlurb: 'Wypełnia polecenie dla typowego zadania. Nic nie zostanie wysłane, dopóki nie klikniesz Wyślij.',
  templatesBlurb: 'Wybierz styl, którym ma się kierować agent, albo użyj ponownie polecenia z gotowego przykładu.',
  clips: {
    title: 'Zamień długie wideo w klipy',
    dropTitle: 'Upuść tutaj swoje wideo',
    body: 'Wklej link do wideo lub ścieżkę na tym komputerze albo wybierz plik. Agent znajdzie najlepsze momenty i pokaże propozycje, zanim cokolwiek przytnie.',
    field: 'Link do wideo lub ścieżka lokalna',
    placeholder: 'https://youtube.com/watch?v=… lub ścieżka pliku',
    add: 'Dodaj wideo',
    or: 'lub',
    choose: 'Wybierz z tego komputera',
    note: 'Linki są pobierane narzędziem do pobierania. Pliki lokalne zostają na miejscu; nic nie jest wysyłane.',
    starting: 'Rozpoczynanie sesji…',
    empty: 'Wklej link do wideo lub ścieżkę lokalną albo wybierz plik z tego komputera.',
    notVideo: 'Wybierz plik wideo, w którym szukać klipów.',
    needsAgent: 'Do szukania klipów potrzebny jest agent. Najpierw go skonfiguruj.',
    prompt:
      'Znajdź najlepsze krótkie klipy w tym długim wideo. Wypisz propozycje ze znacznikami czasu i tym, co sprawia, że każda działa, i zaczekaj na moją zgodę, zanim cokolwiek przytniesz.',
  },
  recent: {
    title: 'Ostatnie',
    blurb: 'Kontynuuj tam, gdzie skończyłeś.',
    search: 'Szukaj sesji i projektów',
    noMatch: (query) => `Nic nie pasuje do „${query}”.`,
    clear: 'Wyczyść wyszukiwanie',
    found: (count) => plural(count, 'wynik', 'wyniki', 'wyników'),
    emptyTitle: 'Twoje pierwsze wideo zaczyna się powyżej',
    emptyBody: 'Opisz pomysł lub dodaj materiał. Twoje sesje i projekty pojawią się tutaj.',
    list: 'Ostatnie sesje i projekty',
    sessions: (count) => plural(count, 'sesja', 'sesje', 'sesji'),
    project: 'Projekt',
    more: (count) => `Pokaż jeszcze ${count}`,
    less: 'Pokaż mniej',
    pinned: 'Przypięte',
    archiveProject: 'Archiwizuj projekt',
  },
};
