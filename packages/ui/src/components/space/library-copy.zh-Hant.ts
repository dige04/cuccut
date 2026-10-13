import type { LibraryMessages } from './library-copy.ts';

export const zhHant: LibraryMessages = {
  blurb: '所有專案裡的影片、素材和智慧代理做出的成果都在這裡。',
  blurbProject: '這個專案裡的影片、素材和成果。',
  blurbFavorite: '你在各個專案裡加入最愛的項目。',
  blurbTrash: '丟到垃圾桶的項目會留在這裡，直到你回復或永久刪除。',
  allItems: '全部內容',
  projects: '專案',
  items: (n: number) => `${n} 項`,
  matching: (n: number, q: string) => `${n} 項符合「${q}」`,
  kindFilter: '內容類型',
  clearSearch: '清除搜尋',
  noMatchBody: '換個名稱試試，或切換到別的類型。',
  openHint: '打開即可預覽 · 影片在編輯器中打開',
  inProject: (name: string) => `在「${name}」中`,
  clearProject: '顯示所有專案',
  backToLibrary: '返回資料庫',
};
