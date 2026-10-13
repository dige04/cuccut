import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const zhHans: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: '时长', what: '成片播放多长时间。' },
    'video.shortSidePx': { label: '短边', what: '画布的短边，以像素计。' },
    'video.shots': { label: '镜头', what: '主轨道上的视频和图片片段。' },
    'video.cutsPerMin': { label: '每分钟切换次数', what: '主轨道切换到下一个片段的频率。' },
    'video.longestShotSec': { label: '最长镜头', what: '主轨道上最长的片段。' },
    'video.longestBlankSec': { label: '最长空白', what: '画面上完全没有内容的最长一段。' },
    'captions.on': { label: '显示字幕', what: '视频是否显示字幕。' },
    'captions.wordsPerSec': { label: '字幕每秒字数', what: '字幕要求观众以多快的速度阅读。' },
    'hook.present': { label: '开场钩子', what: '开场的一句钩子：短视频剪辑所依据的那句，或前 2 秒内开始出现的文字。' },
    'hook.words': { label: '钩子字数', what: '钩子包含多少个字。' },
    'text.offCanvas': { label: '文字超出边缘', what: '文字框是否超出画面的左边缘或右边缘。' },
    'items.placeholders': { label: '占位框', what: '仍在等待素材的占位框。' },
    'transitions.count': { label: '转场', what: '片段之间的转场数量。' },
    'layers.max': { label: '额外图层', what: '除第一条之外正在使用的画面轨道；0 表示只有一条轨道。' },
    'export.durationSec': { label: '导出时长', what: '导出文件播放多长时间。' },
    'export.width': { label: '导出宽度', what: '导出画面的宽度，以像素计。' },
    'export.height': { label: '导出高度', what: '导出画面的高度，以像素计。' },
    'export.loudnessLufs': { label: '响度', what: '归一化后导出内容的响度；仅在做过归一化时读取。' },
    'export.truePeakDb': { label: '真峰值', what: '归一化后导出内容的最大峰值；仅在做过归一化时读取。' },
  },
};
