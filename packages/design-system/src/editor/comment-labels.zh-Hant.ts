import type { CommentLabelMessages } from './comment-labels.ts';

export const zhHant: CommentLabelMessages = {
  kinds: {
    token: 'token',
    cgroup: '顏色組',
    tset: '文字樣式組',
    style: '文字樣式',
    font: '字體',
    knob: '樣式設定',
    editor: '樣式編輯',
    picker: '取色器',
    prop: '屬性',
    props: '屬性表',
    cell: '顏色值',
    agroup: '素材組',
    asset: '素材',
    comp: '元件',
    doc: '文件',
    dialog: '對話框',
    lightbox: '素材預覽',
    note: '用法說明',
    page: '章節標題',
  },
  specials: {
    cover: '封面',
    'font-files': '字體檔案',
  },
  element: '元素',
  quote: (name) => `「${name}」`,
};
