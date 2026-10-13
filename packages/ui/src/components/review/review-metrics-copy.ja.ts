import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const ja: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: '長さ', what: '完成した動画の再生時間です。' },
    'video.shortSidePx': { label: '短辺', what: 'キャンバスの短辺（ピクセル）です。' },
    'video.shots': { label: 'カット数', what: 'メイントラックにある動画と画像のクリップです。' },
    'video.cutsPerMin': { label: '1分あたりのカット数', what: 'メイントラックが次のクリップに切り替わる頻度です。' },
    'video.longestShotSec': { label: '最長のショット', what: 'メイントラックで最も長いクリップです。' },
    'video.longestBlankSec': { label: '最長の空白', what: '画面に何もない最も長い区間です。' },
    'captions.on': { label: '字幕の表示', what: '動画に字幕が表示されるかどうかです。' },
    'captions.wordsPerSec': { label: '字幕の1秒あたりの語数', what: '字幕が求める読みの速さです。' },
    'hook.present': { label: 'フック', what: 'フックの一行です。ショートを切り出した一行、または最初の2秒以内に始まるテキストです。' },
    'hook.words': { label: 'フックの語数', what: 'フックの語数です。' },
    'text.offCanvas': { label: '端からはみ出したテキスト', what: 'テキストボックスがフレームの左右の端からはみ出しているかどうかです。' },
    'items.placeholders': { label: 'プレースホルダー', what: 'まだメディアを待っているプレースホルダーの枠です。' },
    'transitions.count': { label: 'トランジション', what: 'クリップ間のトランジションです。' },
    'layers.max': { label: '追加のレイヤー', what: '最初の1つを超えて使われている映像トラックです。0は単一トラックを意味します。' },
    'export.durationSec': { label: '書き出しの長さ', what: '書き出されたファイルの再生時間です。' },
    'export.width': { label: '書き出しの幅', what: '書き出された映像の幅（ピクセル）です。' },
    'export.height': { label: '書き出しの高さ', what: '書き出された映像の高さ（ピクセル）です。' },
    'export.loudnessLufs': { label: 'ラウドネス', what: 'ノーマライズ後の書き出しのラウドネスです。ノーマライズされた場合にのみ読み取ります。' },
    'export.truePeakDb': { label: 'トゥルーピーク', what: 'ノーマライズ後の書き出しの最大ピークです。ノーマライズされた場合にのみ読み取ります。' },
  },
};
