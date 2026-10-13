import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const it: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Durata', what: 'Quanto dura il video finito.' },
    'video.shortSidePx': { label: 'Lato corto', what: 'Il lato corto della tela, in pixel.' },
    'video.shots': { label: 'Inquadrature', what: 'Clip video e immagini sulla traccia principale.' },
    'video.cutsPerMin': { label: 'Tagli al minuto', what: 'Con quale frequenza la traccia principale passa alla clip successiva.' },
    'video.longestShotSec': { label: 'Inquadratura più lunga', what: 'La clip più lunga sulla traccia principale.' },
    'video.longestBlankSec': { label: 'Vuoto più lungo', what: 'Il tratto più lungo in cui non c’è nulla sullo schermo.' },
    'captions.on': { label: 'Sottotitoli visibili', what: 'Se il video mostra o meno dei sottotitoli.' },
    'captions.wordsPerSec': { label: 'Parole di sottotitolo al secondo', what: 'Quanto velocemente i sottotitoli chiedono di essere letti.' },
    'hook.present': { label: 'Hook', what: 'Una riga di hook: quella con cui è stato tagliato lo short, o un testo che inizia nei primi 2 secondi.' },
    'hook.words': { label: 'Parole dell’hook', what: 'Quante parole ha l’hook.' },
    'text.offCanvas': { label: 'Testo oltre il bordo', what: 'Se un riquadro di testo esce dal bordo sinistro o destro del fotogramma.' },
    'items.placeholders': { label: 'Riquadri segnaposto', what: 'Riquadri segnaposto che attendono ancora un contenuto.' },
    'transitions.count': { label: 'Transizioni', what: 'Transizioni tra le clip.' },
    'layers.max': { label: 'Livelli extra', what: 'Tracce video in uso oltre la prima; 0 significa una sola traccia.' },
    'export.durationSec': { label: 'Durata esportata', what: 'Quanto dura il file esportato.' },
    'export.width': { label: 'Larghezza esportata', what: 'Larghezza dell’immagine esportata, in pixel.' },
    'export.height': { label: 'Altezza esportata', what: 'Altezza dell’immagine esportata, in pixel.' },
    'export.loudnessLufs': { label: 'Sonorità', what: 'Sonorità dell’esportazione dopo la normalizzazione; letta solo se è stata normalizzata.' },
    'export.truePeakDb': { label: 'True peak', what: 'Il picco più alto dell’esportazione dopo la normalizzazione; letto solo se è stata normalizzata.' },
  },
};
