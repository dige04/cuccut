import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const es: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Duración', what: 'Cuánto dura el vídeo terminado.' },
    'video.shortSidePx': { label: 'Lado corto', what: 'El lado corto del lienzo, en píxeles.' },
    'video.shots': { label: 'Planos', what: 'Clips de vídeo e imagen en la pista principal.' },
    'video.cutsPerMin': { label: 'Cortes por minuto', what: 'Con qué frecuencia la pista principal pasa al siguiente clip.' },
    'video.longestShotSec': { label: 'Plano más largo', what: 'El clip más largo de la pista principal.' },
    'video.longestBlankSec': { label: 'Hueco más largo', what: 'El tramo más largo sin nada en pantalla.' },
    'captions.on': { label: 'Subtítulos visibles', what: 'Si el vídeo muestra subtítulos o no.' },
    'captions.wordsPerSec': { label: 'Palabras de subtítulo por segundo', what: 'Lo rápido que piden los subtítulos ser leídos.' },
    'hook.present': { label: 'Gancho', what: 'Una línea de gancho: la que se usó para cortar el short, o texto que empieza en los primeros 2 segundos.' },
    'hook.words': { label: 'Palabras del gancho', what: 'Cuántas palabras tiene el gancho.' },
    'text.offCanvas': { label: 'Texto fuera del borde', what: 'Si un cuadro de texto sale por el borde izquierdo o derecho del encuadre.' },
    'items.placeholders': { label: 'Recuadros de marcador', what: 'Recuadros de marcador que todavía esperan material.' },
    'transitions.count': { label: 'Transiciones', what: 'Transiciones entre clips.' },
    'layers.max': { label: 'Capas extra', what: 'Pistas de imagen en uso además de la primera; 0 significa una sola pista.' },
    'export.durationSec': { label: 'Duración exportada', what: 'Cuánto dura el archivo exportado.' },
    'export.width': { label: 'Ancho exportado', what: 'Ancho de la imagen exportada, en píxeles.' },
    'export.height': { label: 'Alto exportado', what: 'Alto de la imagen exportada, en píxeles.' },
    'export.loudnessLufs': { label: 'Sonoridad', what: 'Sonoridad de la exportación tras normalizar; solo se lee si se normalizó.' },
    'export.truePeakDb': { label: 'Pico real', what: 'El pico más alto de la exportación tras normalizar; solo se lee si se normalizó.' },
  },
};
