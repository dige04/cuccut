import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const ptBR: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Duração', what: 'Quanto tempo dura o vídeo finalizado.' },
    'video.shortSidePx': { label: 'Lado curto', what: 'O lado curto da tela, em pixels.' },
    'video.shots': { label: 'Planos', what: 'Clipes de vídeo e imagem na trilha principal.' },
    'video.cutsPerMin': { label: 'Cortes por minuto', what: 'Com que frequência a trilha principal passa para o próximo clipe.' },
    'video.longestShotSec': { label: 'Plano mais longo', what: 'O clipe mais longo da trilha principal.' },
    'video.longestBlankSec': { label: 'Trecho vazio mais longo', what: 'O trecho mais longo com nada na tela.' },
    'captions.on': { label: 'Legendas exibidas', what: 'Se o vídeo exibe legendas.' },
    'captions.wordsPerSec': { label: 'Palavras de legenda por segundo', what: 'Quão rápido as legendas pedem para ser lidas.' },
    'hook.present': { label: 'Gancho', what: 'Uma frase de gancho: a que foi usada para cortar o short, ou um texto que começa nos primeiros 2 segundos.' },
    'hook.words': { label: 'Palavras do gancho', what: 'Quantas palavras tem o gancho.' },
    'text.offCanvas': { label: 'Texto além da borda', what: 'Se uma caixa de texto passa da borda esquerda ou direita do quadro.' },
    'items.placeholders': { label: 'Caixas de marcação', what: 'Caixas de marcação que ainda aguardam mídia.' },
    'transitions.count': { label: 'Transições', what: 'Transições entre os clipes.' },
    'layers.max': { label: 'Camadas extras', what: 'Trilhas de imagem em uso além da primeira; 0 é uma trilha só.' },
    'export.durationSec': { label: 'Duração exportada', what: 'Quanto tempo dura o arquivo exportado.' },
    'export.width': { label: 'Largura exportada', what: 'Largura da imagem exportada, em pixels.' },
    'export.height': { label: 'Altura exportada', what: 'Altura da imagem exportada, em pixels.' },
    'export.loudnessLufs': { label: 'Sonoridade', what: 'Sonoridade da exportação após a normalização; lida apenas se houve normalização.' },
    'export.truePeakDb': { label: 'True peak', what: 'O pico mais alto da exportação após a normalização; lido apenas se houve normalização.' },
  },
};
