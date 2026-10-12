import type { CommentLabelMessages } from './comment-labels.ts';

export const zhHans: CommentLabelMessages = {
  kinds: {
    token: 'token',
    cgroup: '颜色组',
    tset: '文字样式组',
    style: '文字样式',
    font: '字体',
    knob: '样式设置',
    editor: '样式编辑',
    picker: '取色器',
    prop: '属性',
    props: '属性表',
    cell: '颜色值',
    agroup: '素材组',
    asset: '素材',
    comp: '组件',
    doc: '文档',
    dialog: '对话框',
    lightbox: '素材预览',
    note: '用法说明',
    page: '章节标题',
  },
  specials: {
    cover: '封面',
    'font-files': '字体文件',
  },
  element: '元素',
  quote: (name) => `“${name}”`,
};
