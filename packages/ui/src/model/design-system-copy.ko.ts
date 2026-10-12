import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('ko', { type: 'conjunction' }).format(labels);

export const ko: DesignSystemMessages = {
  paneLabel: (name) => `디자인 시스템 “${name}”`,
  frameTitle: (name) => `디자인 시스템 편집기: ${name}`,
  opening: '디자인 시스템 여는 중…',
  unavailableTitle: '디자인 시스템 편집기를 사용할 수 없음',
  unavailableBody: '이 CucCut 빌드에는 디자인 시스템 편집기가 포함되어 있지 않습니다. 디자인 시스템 파일은 폴더에 그대로 있습니다.',
  hostBlockedTitle: '이 주소에서는 디자인 시스템 편집기를 열 수 없음',
  hostBlockedBody: '디자인 시스템을 편집하려면 CucCut Web을 127.0.0.1 또는 localhost로 여세요. 디자인 시스템 파일은 폴더에 그대로 있습니다.',
  openFailed: (reason) => `디자인 시스템을 열 수 없습니다: ${reason}`,
  open: '디자인 시스템 열기',
  openInEditor: '디자인 시스템 편집기로 열기',
  annotate: '주석',
  noteLabel: '의견',
  notePlaceholder: '어떻게 고칠까요?',
  addToChat: '대화에 추가',
  cancel: '취소',
  where: (name, label) => `디자인 시스템 “${name}” › ${label}`,
  token: (n) => `디자인 시스템 주석 · ${n}개`,
  added: (token) => `대화에 추가함 · ${token}`,
  removeAll: '디자인 시스템 주석 모두 제거',
  removeOne: (n) => `주석 ${n} 제거`,
  item: (n, label, text) => `주석 ${n}, ${label}: ${text}`,
  empty: '의견을 먼저 쓴 다음 대화에 추가하세요',
  tooLong: (max) => `의견은 최대 ${max}자까지 쓸 수 있습니다`,
  tooMany: (max) => `메시지 하나에 디자인 시스템 주석은 최대 ${max}개까지 붙일 수 있습니다. 먼저 이것들을 보내세요.`,
  noConversation: '이 탭은 아직 세션에 속해 있지 않습니다. 메시지를 보내 세션을 시작한 뒤 주석을 추가하세요.',
  message: '이 디자인 시스템 주석대로 수정해 주세요.',
  flushFailed: (names) =>
    `디자인 시스템 ${list(names.map((n) => `“${n}”`))}의 변경 사항이 아직 저장되지 않아 메시지를 보내지 않았습니다. 다시 보내거나 디자인 시스템 주석을 먼저 제거하세요.`,
};
