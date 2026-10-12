import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('ko', { type: 'conjunction' }).format(labels);

export const ko: SlidesMessages = {
  pages: (n) => `슬라이드 ${n}장`,
  paneLabel: (name) => `슬라이드 “${name}”`,
  frameTitle: (name) => `슬라이드 편집기: ${name}`,
  opening: '슬라이드 여는 중…',
  unavailableTitle: '슬라이드 편집기를 사용할 수 없음',
  unavailableBody: '이 CucCut 빌드에는 슬라이드 편집기가 포함되어 있지 않습니다. 슬라이드 파일은 폴더에 그대로 있습니다.',
  openFailed: (reason) => `슬라이드를 열 수 없습니다: ${reason}`,
  open: '슬라이드 열기',
  openCard: (name) => `슬라이드 “${name}” 열기`,
  openInEditor: '슬라이드 편집기로 열기',
  annotate: '주석',
  noteLabel: '의견',
  notePlaceholder: '어떻게 고칠까요?',
  addToChat: '대화에 추가',
  cancel: '취소',
  token: (n) => `슬라이드 주석 · ${n}개`,
  added: (token) => `대화에 추가함 · ${token}`,
  removeAll: '슬라이드 주석 모두 제거',
  removeOne: (n) => `주석 ${n} 제거`,
  item: (n, label, text) => `주석 ${n}, ${label}: ${text}`,
  empty: '의견을 먼저 쓴 다음 대화에 추가하세요',
  tooLong: (max) => `의견은 최대 ${max}자까지 쓸 수 있습니다`,
  tooMany: (max) => `메시지 하나에 슬라이드 주석은 최대 ${max}개까지 붙일 수 있습니다. 먼저 이것들을 보내세요.`,
  noConversation: '이 탭은 아직 세션에 속해 있지 않습니다. 메시지를 보내 세션을 시작한 뒤 주석을 추가하세요.',
  message: '이 슬라이드 주석대로 수정해 주세요.',
  flushFailed: (names) =>
    `슬라이드 ${list(names.map((n) => `“${n}”`))}의 변경 사항이 아직 저장되지 않아 메시지를 보내지 않았습니다. 다시 보내거나 슬라이드 주석을 먼저 제거하세요.`,
};
