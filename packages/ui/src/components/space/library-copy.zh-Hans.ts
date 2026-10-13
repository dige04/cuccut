import type { LibraryMessages } from './library-copy.ts';

export const zhHans: LibraryMessages = {
  blurb: '所有项目里的视频、素材和智能体做出的成果都在这里。',
  blurbProject: '这个项目里的视频、素材和成果。',
  blurbFavorite: '你在各个项目里收藏的条目。',
  blurbTrash: '移入回收站的条目会留在这里，直到你恢复或彻底删除。',
  allItems: '全部内容',
  projects: '项目',
  items: (n: number) => `${n} 项`,
  matching: (n: number, q: string) => `${n} 项匹配“${q}”`,
  kindFilter: '内容类型',
  clearSearch: '清除搜索',
  noMatchBody: '换个名字试试，或切换到别的类型。',
  openHint: '打开即可预览 · 视频在编辑器中打开',
  inProject: (name: string) => `在“${name}”中`,
  clearProject: '显示所有项目',
  backToLibrary: '返回资料库',
};
