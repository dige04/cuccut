import type { LibraryMessages } from './library-copy.ts';

export const ko: LibraryMessages = {
  blurb: '모든 프로젝트의 동영상, 미디어, 에이전트가 만든 결과물이 여기에 있습니다.',
  blurbProject: '이 프로젝트의 동영상, 미디어, 결과물입니다.',
  blurbFavorite: '모든 프로젝트에서 즐겨찾기에 추가한 항목입니다.',
  blurbTrash: '휴지통으로 이동한 항목은 복원하거나 영구 삭제할 때까지 여기에 남습니다.',
  allItems: '모든 항목',
  projects: '프로젝트',
  items: (n: number) => `${n}개 항목`,
  matching: (n: number, q: string) => `“${q}”와 일치하는 항목 ${n}개`,
  kindFilter: '항목 종류',
  clearSearch: '검색 지우기',
  noMatchBody: '다른 이름으로 찾거나 다른 종류로 바꿔 보세요.',
  openHint: '열어서 미리 보기 · 동영상은 편집기에서 열립니다',
  inProject: (name: string) => `${name} 안`,
  clearProject: '모든 프로젝트 보기',
  backToLibrary: '라이브러리로 돌아가기',
};
