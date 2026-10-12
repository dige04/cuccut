import type { CommentLabelMessages } from './comment-labels.ts';

export const ko: CommentLabelMessages = {
  kinds: {
    token: '토큰',
    cgroup: '색상 그룹',
    tset: '텍스트 스타일 세트',
    style: '텍스트 스타일',
    font: '글꼴',
    knob: '스타일 설정',
    editor: '스타일 편집',
    picker: '색상 선택기',
    prop: '속성',
    props: '속성 목록',
    cell: '색상 값',
    agroup: '소재 그룹',
    asset: '소재',
    comp: '컴포넌트',
    doc: '문서',
    dialog: '대화상자',
    lightbox: '소재 미리보기',
    note: '사용 안내',
    page: '섹션 제목',
  },
  specials: {
    cover: '표지',
    'font-files': '글꼴 파일',
  },
  element: '요소',
  quote: (name) => `“${name}”`,
};
