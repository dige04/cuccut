import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const nl: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Lengte', what: 'Hoe lang de afgeronde video duurt.' },
    'video.shortSidePx': { label: 'Korte zijde', what: 'De korte zijde van het canvas, in pixels.' },
    'video.shots': { label: 'Shots', what: 'Video- en beeldclips op de hoofdtrack.' },
    'video.cutsPerMin': { label: 'Knippen per minuut', what: 'Hoe vaak de hoofdtrack naar de volgende clip knipt.' },
    'video.longestShotSec': { label: 'Langste shot', what: 'De langste clip op de hoofdtrack.' },
    'video.longestBlankSec': { label: 'Langste lege moment', what: 'Het langste stuk waarin helemaal niets in beeld is.' },
    'captions.on': { label: 'Ondertitels getoond', what: 'Of de video ondertitels toont.' },
    'captions.wordsPerSec': { label: 'Ondertitelwoorden per seconde', what: 'Hoe snel de ondertitels gelezen willen worden.' },
    'hook.present': { label: 'Hook', what: 'Een hookzin: die waarmee de short is geknipt, of tekst die in de eerste 2 seconden begint.' },
    'hook.words': { label: 'Hookwoorden', what: 'Hoeveel woorden de hook heeft.' },
    'text.offCanvas': { label: 'Tekst over de rand', what: 'Of een tekstvak over de linker- of rechterrand van het beeld loopt.' },
    'items.placeholders': { label: 'Tijdelijke vakken', what: 'Tijdelijke vakken die nog op media wachten.' },
    'transitions.count': { label: 'Overgangen', what: 'Overgangen tussen clips.' },
    'layers.max': { label: 'Extra lagen', what: 'Beeldsporen in gebruik naast de eerste; 0 is één spoor.' },
    'export.durationSec': { label: 'Geëxporteerde lengte', what: 'Hoe lang het geëxporteerde bestand duurt.' },
    'export.width': { label: 'Geëxporteerde breedte', what: 'Breedte van het geëxporteerde beeld, in pixels.' },
    'export.height': { label: 'Geëxporteerde hoogte', what: 'Hoogte van het geëxporteerde beeld, in pixels.' },
    'export.loudnessLufs': { label: 'Luidheid', what: 'Luidheid van de export na normaliseren; alleen gelezen als er genormaliseerd is.' },
    'export.truePeakDb': { label: 'True peak', what: 'De hardste piek van de export na normaliseren; alleen gelezen als er genormaliseerd is.' },
  },
};
