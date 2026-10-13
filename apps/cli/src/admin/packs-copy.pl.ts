import type { PacksMessages } from './packs-copy.ts';

export const pl: PacksMessages = {
  packsHelp: `Użycie:
  cuccut packs inspect <source>    Odczytuje pakiet i pokazuje wszystko, co zawiera, bez instalowania go.
                                   <source>: folder, adres GitHub (owner/repo, adres URL repozytorium albo
                                   …/tree/<branch>/<folder>) lub adres https:// udostępniający pack.json
  cuccut packs install <source>    Odczytuje pakiet i instaluje jego szablony, umiejętności, elementy biblioteki,
                                   przewodnik stylu i szybkie akcje
    --replace                      Zastępuje Twoje szablony i umiejętności o tych samych id (trafiają do kosza);
                                   bez tej opcji są zachowywane i pomijane
  cuccut packs remove <id>         Usuwa pakiet: on sam oraz szablony i umiejętności, które przyniósł, trafiają do kosza
                                   na 24 godziny; elementy biblioteki i Twoje zmiany zostają
  cuccut packs restore <trashId>   Cofa usunięcie w ciągu 24 godzin
  cuccut packs style <id> [<file>|-]
                                   Wypisuje przewodnik stylu pakietu; z plikiem (albo - dla wejścia standardowego)
                                   zapisuje plik jako przewodnik (pusty plik go usuwa)
  cuccut packs export <folder> --name <name>
                                   Zapisuje folder pakietu z Twoich szablonów, umiejętności i elementów biblioteki,
                                   wraz z indeksem plików, do wysłania w takiej postaci, wypchnięcia na GitHub albo
                                   udostępnienia z dowolnego hostingu statycznego. Folder musi być pusty albo być
                                   wcześniejszym eksportem tego pakietu
    --id <id>                      Id pakietu (domyślnie: utworzone z nazwy)
    --version <version>            Domyślnie 1.0.0
    --author <name>, --description <text>
    --template <id>                Szablon własny (można powtarzać)
    --skill <id>                   Umiejętność niewbudowana (można powtarzać)
    --library <glossaries|brand>:<entryId>
                                   Element biblioteki (można powtarzać); głosy zostają
    --quick-actions <packId>       Szybkie akcje zainstalowanego pakietu (można powtarzać)
    --style-from <packId>          Przewodnik stylu i pliki referencyjne zainstalowanego pakietu`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, autor: ${author}` : ''}`,
  notInstalled: 'Niezainstalowany: najpierw odczytaj.',
  installedVersion: (version: string) =>
    `Wersja ${version} jest zainstalowana. Ponowna instalacja zaktualizuje to, co należy do pakietu, i zachowa Twoje zmiany.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? (templates === 1 ? '1 szablon' : `${templates} szablonów`) : '',
      skills ? (skills === 1 ? '1 umiejętność' : `${skills} umiejętności`) : '',
      library ? (library === 1 ? '1 element biblioteki' : `${library} elementów biblioteki`) : '',
      style ? 'przewodnik stylu' : '',
      quickActions ? (quickActions === 1 ? '1 szybka akcja' : `${quickActions} szybkich akcji`) : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Nic własnego';
  },
  sectionTemplates: 'Szablony',
  sectionSkills: 'Umiejętności',
  sectionLibrary: 'Biblioteka',
  sectionStyle: 'Przewodnik stylu: agenci czytają go przed wyborem i edycją',
  sectionExamples: 'Pliki referencyjne',
  sectionQuick: 'Szybkie akcje: wiadomości wysyłane do agenta jednym kliknięciem',
  sectionReserved: 'Reguły i standard recenzji: przechowywane razem z pakietem; CucCut jeszcze ich nie używa',
  sectionWarnings: 'Ostrzeżenia',
  agentReads: 'Tekst, którego będzie przestrzegał agent. Przeczytaj go.',
  stateNew: 'nowy',
  stateUpdate: 'aktualizuje kopię zainstalowaną przez ten pakiet',
  stateChanged: 'zmieniono go od instalacji: zachowany, chyba że użyto --replace',
  stateExists: 'masz już taki o tym id: Twój zostaje, chyba że użyto --replace',
  stateBuiltin: 'wbudowany element ma to id, więc ten nie zostanie zainstalowany',
  skillFiles: (files: number) => (files === 1 ? '1 plik' : `${files} plików`),
  duplicate: 'już jest w Twojej bibliotece; nie dodano ponownie',
  bytes: (bytes: number) => `${bytes} bajtów`,
  missingSkill: (template: string, skill: string) =>
    `${template} poleca umiejętność „${skill}”, która nie znajduje się ani na tym komputerze, ani w pakiecie`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, wiersz ${line}: ${why}${text ? ` („${text}”)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Ten pakiet nie zostanie zainstalowany: wiersz ${line} pliku ${file} ${why}${text ? ` („${text}”)` : ''}`,
  installHint: (source: string) => `Zainstaluj poleceniem: cuccut packs install ${source}`,
  replaceHint: 'Dodaj --replace, aby zastąpić własne elementy o tych samych id.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `Zainstalowano ${name} v${version}: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `Pominięto ${kind === 'template' ? 'szablon' : kind === 'skill' ? 'umiejętność' : 'element biblioteki'} ${id}: ${
      reason === 'builtin'
        ? 'wbudowany element ma to id'
        : reason === 'exists'
          ? 'masz własny z tym id (dodaj --replace)'
          : 'zmieniono go od instalacji (dodaj --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `Usunięto ${name}: razem z nim odeszło ${templates === 1 ? '1 szablon' : `${templates} szablonów`} i ${skills === 1 ? '1 umiejętność' : `${skills} umiejętności`}. Elementy biblioteki zostają.`,
  kept: (count: number, ids: string) => `${count === 1 ? '1 zmieniony przez Ciebie element zostaje' : `${count} zmienionych przez Ciebie elementów zostaje`}: ${ids}`,
  undo: (trashId: string) => `Cofnij w ciągu 24 godzin: cuccut packs restore ${trashId}`,
  replacedUndo: (ids: string, trashId: string) => `Replaced your own ${ids}. Undo within 24 hours: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `Przywrócono ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} nie ma przewodnika stylu. Zapisz go poleceniem cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Zapisano przewodnik stylu ${name} (${chars} / ${limit} znaków)`,
  styleRemoved: (name: string) => `Usunięto przewodnik stylu ${name}`,
  takesEffect: 'Obowiązuje od następnej nowej sesji agenta.',
  idFormat: (value: string) => `To nie jest id pakietu (małe litery, cyfry i pojedyncze myślniki): ${value}`,

  // Export
  exportNeedsName: 'Nadaj pakietowi nazwę opcją --name.',
  exportNoId: (name: string) => `Nie można utworzyć id z „${name}”; podaj je opcją --id.`,
  libraryFormat: (value: string) => `To nie jest element biblioteki (glossaries:<entryId> albo brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `Zapisano ${dir}: ${files} ${files === 1 ? 'plik' : 'plików'}, ${bytes} bajtów. Wyślij folder w takiej postaci, wypchnij go na GitHub albo udostępnij z dowolnego hostingu statycznego.`,
  exportedCheck: (dir: string) => `Odczytaj go poleceniem: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Nie można odczytać ${file}: ${reason}`,
};
