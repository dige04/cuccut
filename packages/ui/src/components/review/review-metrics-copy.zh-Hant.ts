import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const zhHant: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: '長度', what: '完成影片的播放時間。' },
    'video.shortSidePx': { label: '短邊', what: '畫布的短邊，以像素計。' },
    'video.shots': { label: '鏡頭數', what: '主軌上的影片與圖片片段。' },
    'video.cutsPerMin': { label: '每分鐘剪接數', what: '主軌切換到下一個片段的頻率。' },
    'video.longestShotSec': { label: '最長鏡頭', what: '主軌上最長的片段。' },
    'video.longestBlankSec': { label: '最長空白', what: '畫面上完全沒有內容的最長區段。' },
    'captions.on': { label: '顯示字幕', what: '影片是否顯示字幕。' },
    'captions.wordsPerSec': { label: '每秒字幕字數', what: '字幕要求閱讀的速度。' },
    'hook.present': { label: '開場鉤子', what: '開場鉤子句：剪輯短片時所用的句子，或在前 2 秒開始的文字。' },
    'hook.words': { label: '鉤子字數', what: '開場鉤子的字數。' },
    'text.offCanvas': { label: '超出邊緣的文字', what: '文字框是否超出畫面的左側或右側邊緣。' },
    'items.placeholders': { label: '佔位框', what: '仍在等待媒體的佔位框。' },
    'transitions.count': { label: '轉場', what: '片段之間的轉場。' },
    'layers.max': { label: '額外圖層', what: '第一條之外使用中的畫面軌道；0 表示只有一條軌道。' },
    'export.durationSec': { label: '匯出長度', what: '匯出檔案的播放時間。' },
    'export.width': { label: '匯出寬度', what: '匯出畫面的寬度，以像素計。' },
    'export.height': { label: '匯出高度', what: '匯出畫面的高度，以像素計。' },
    'export.loudnessLufs': { label: '響度', what: '標準化後匯出的響度；只有在做過標準化時才會讀取。' },
    'export.truePeakDb': { label: '真實峰值', what: '標準化後匯出的最高峰值；只有在做過標準化時才會讀取。' },
  },
};
