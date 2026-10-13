import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const fr: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Durée', what: 'Durée de la vidéo terminée.' },
    'video.shortSidePx': { label: 'Petit côté', what: 'Le petit côté du cadre, en pixels.' },
    'video.shots': { label: 'Plans', what: 'Clips vidéo et images sur la piste principale.' },
    'video.cutsPerMin': { label: 'Coupes par minute', what: 'Fréquence à laquelle la piste principale passe au clip suivant.' },
    'video.longestShotSec': { label: 'Plan le plus long', what: 'Le clip le plus long de la piste principale.' },
    'video.longestBlankSec': { label: 'Blanc le plus long', what: 'La plus longue durée sans rien à l’écran.' },
    'captions.on': { label: 'Sous-titres affichés', what: 'Indique si la vidéo affiche des sous-titres.' },
    'captions.wordsPerSec': { label: 'Mots de sous-titres par seconde', what: 'La vitesse de lecture demandée par les sous-titres.' },
    'hook.present': { label: 'Accroche', what: 'Une phrase d’accroche : celle avec laquelle le short a été coupé, ou un texte qui commence dans les 2 premières secondes.' },
    'hook.words': { label: 'Mots de l’accroche', what: 'Le nombre de mots de l’accroche.' },
    'text.offCanvas': { label: 'Texte hors du cadre', what: 'Indique si un bloc de texte dépasse le bord gauche ou droit du cadre.' },
    'items.placeholders': { label: 'Cadres de remplacement', what: 'Cadres de remplacement qui attendent encore un média.' },
    'transitions.count': { label: 'Transitions', what: 'Transitions entre les clips.' },
    'layers.max': { label: 'Calques supplémentaires', what: 'Pistes image utilisées au-delà de la première ; 0 signifie une seule piste.' },
    'export.durationSec': { label: 'Durée exportée', what: 'Durée du fichier exporté.' },
    'export.width': { label: 'Largeur exportée', what: 'Largeur de l’image exportée, en pixels.' },
    'export.height': { label: 'Hauteur exportée', what: 'Hauteur de l’image exportée, en pixels.' },
    'export.loudnessLufs': { label: 'Sonie', what: 'Sonie de l’export après normalisation ; lue seulement si une normalisation a été faite.' },
    'export.truePeakDb': { label: 'Crête vraie', what: 'Le pic le plus fort de l’export après normalisation ; lu seulement si une normalisation a été faite.' },
  },
};
