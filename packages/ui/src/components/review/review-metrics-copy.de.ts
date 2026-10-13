import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const de: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Länge', what: 'Wie lange das fertige Video läuft.' },
    'video.shortSidePx': { label: 'Kurze Seite', what: 'Die kurze Seite der Leinwand, in Pixeln.' },
    'video.shots': { label: 'Einstellungen', what: 'Video- und Bildclips auf der Hauptspur.' },
    'video.cutsPerMin': { label: 'Schnitte pro Minute', what: 'Wie oft die Hauptspur zum nächsten Clip schneidet.' },
    'video.longestShotSec': { label: 'Längste Einstellung', what: 'Der längste Clip auf der Hauptspur.' },
    'video.longestBlankSec': { label: 'Längste Leerstelle', what: 'Der längste Abschnitt, in dem gar nichts auf dem Bildschirm steht.' },
    'captions.on': { label: 'Untertitel angezeigt', what: 'Ob das Video überhaupt Untertitel einblendet.' },
    'captions.wordsPerSec': { label: 'Untertitelwörter pro Sekunde', what: 'Wie schnell die Untertitel gelesen werden wollen.' },
    'hook.present': { label: 'Hook', what: 'Eine Hook-Zeile: die, mit der der Short geschnitten wurde, oder Text, der in den ersten 2 Sekunden beginnt.' },
    'hook.words': { label: 'Hook-Wörter', what: 'Wie viele Wörter der Hook hat.' },
    'text.offCanvas': { label: 'Text über den Rand', what: 'Ob ein Textfeld über den linken oder rechten Bildrand hinausragt.' },
    'items.placeholders': { label: 'Platzhalter-Felder', what: 'Platzhalter-Felder, die noch auf Medien warten.' },
    'transitions.count': { label: 'Übergänge', what: 'Übergänge zwischen Clips.' },
    'layers.max': { label: 'Zusätzliche Ebenen', what: 'Bildspuren über die erste hinaus; 0 heißt eine einzige Spur.' },
    'export.durationSec': { label: 'Exportierte Länge', what: 'Wie lange die exportierte Datei läuft.' },
    'export.width': { label: 'Exportierte Breite', what: 'Breite des exportierten Bildes, in Pixeln.' },
    'export.height': { label: 'Exportierte Höhe', what: 'Höhe des exportierten Bildes, in Pixeln.' },
    'export.loudnessLufs': { label: 'Lautheit', what: 'Lautheit des Exports nach der Normalisierung; wird nur gelesen, wenn normalisiert wurde.' },
    'export.truePeakDb': { label: 'True Peak', what: 'Der lauteste Spitzenwert des Exports nach der Normalisierung; wird nur gelesen, wenn normalisiert wurde.' },
  },
};
