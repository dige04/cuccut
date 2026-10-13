import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const pl: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Długość', what: 'Jak długo trwa gotowy film.' },
    'video.shortSidePx': { label: 'Krótszy bok', what: 'Krótszy bok kadru, w pikselach.' },
    'video.shots': { label: 'Ujęcia', what: 'Klipy wideo i obrazy na głównej ścieżce.' },
    'video.cutsPerMin': { label: 'Cięcia na minutę', what: 'Jak często główna ścieżka przechodzi do następnego klipu.' },
    'video.longestShotSec': { label: 'Najdłuższe ujęcie', what: 'Najdłuższy klip na głównej ścieżce.' },
    'video.longestBlankSec': { label: 'Najdłuższa pusta chwila', what: 'Najdłuższy odcinek, w którym na ekranie nic nie ma.' },
    'captions.on': { label: 'Napisy widoczne', what: 'Czy film w ogóle wyświetla napisy.' },
    'captions.wordsPerSec': { label: 'Słowa napisów na sekundę', what: 'Jak szybko napisy wymagają czytania.' },
    'hook.present': { label: 'Hook', what: 'Zdanie hooka: to, którym przycięto short, albo tekst zaczynający się w pierwszych 2 sekundach.' },
    'hook.words': { label: 'Słowa hooka', what: 'Ile słów ma hook.' },
    'text.offCanvas': { label: 'Tekst za krawędzią', what: 'Czy pole tekstowe wychodzi poza lewą lub prawą krawędź kadru.' },
    'items.placeholders': { label: 'Ramki zastępcze', what: 'Ramki zastępcze, które wciąż czekają na media.' },
    'transitions.count': { label: 'Przejścia', what: 'Przejścia między klipami.' },
    'layers.max': { label: 'Dodatkowe warstwy', what: 'Ścieżki obrazu w użyciu poza pierwszą; 0 oznacza jedną ścieżkę.' },
    'export.durationSec': { label: 'Długość eksportu', what: 'Jak długo trwa wyeksportowany plik.' },
    'export.width': { label: 'Szerokość eksportu', what: 'Szerokość wyeksportowanego obrazu, w pikselach.' },
    'export.height': { label: 'Wysokość eksportu', what: 'Wysokość wyeksportowanego obrazu, w pikselach.' },
    'export.loudnessLufs': { label: 'Głośność', what: 'Głośność eksportu po normalizacji; odczytywana tylko wtedy, gdy była normalizacja.' },
    'export.truePeakDb': { label: 'True peak', what: 'Najwyższy szczyt eksportu po normalizacji; odczytywany tylko wtedy, gdy była normalizacja.' },
  },
};
