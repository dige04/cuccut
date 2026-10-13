import type { RcProfileMessages } from './rc-profile.ts';

export const ko: RcProfileMessages = {
  readOnly: '이 프로필은 더 최신 버전의 CucCut이 저장한 것이라 여기서는 보기만 할 수 있고 바꿀 수 없습니다',
  projectNotFound: '프로젝트를 찾을 수 없습니다',
  projectUnavailable: '프로젝트 폴더가 없거나 쓸 수 없어서 규칙과 환경설정을 저장할 수 없습니다',
  projectTextOnly: '프로젝트에는 직접 설정한 환경설정 텍스트가 하나만 있습니다. 인터뷰 섹션은 워크스페이스 수준에만 있습니다',
  noAnswers: '질문에 하나 이상 답하거나 건너뛰세요.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: '인터뷰에서 받은 이름',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `규칙이 저장되지 않았습니다: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `규칙을 찾을 수 없습니다: ${p.id}`,
  ruleOrder: '새 순서에는 이 수준의 모든 규칙이 정확히 한 번씩 포함되어야 합니다',
  ruleLimit: (p: { limit: number }) => `한 수준에는 최대 ${p.limit}개의 규칙을 둘 수 있습니다`,
  templateMissing: (p: { id: string }) => `템플릿 “${p.id}”이(가) 설치되어 있지 않습니다. 규칙은 저장되었으며, 설치될 때까지 에이전트는 이 템플릿을 건너뜁니다`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'ID',
  fieldName: '규칙 이름',
  fieldWhen: '조건',
  fieldInstruction: '지침',
  fieldTemplate: '템플릿',
  fieldNote: '메모',
  fieldOrder: '순서',
  required: '필수',
  tooLong: (p: { limit: number }) => `${p.limit}자를 넘습니다`,
  badId: '소문자, 숫자, 하이픈을 사용하고, 문자 또는 숫자로 시작하며, 최대 64자여야 합니다',
  badTemplateId: '올바른 템플릿 ID가 아닙니다(소문자와 숫자를 하이픈 하나로 이어 쓰세요)',
  badOrder: '정수여야 합니다',
  needInstructionOrTemplate: '지침을 입력하거나 템플릿을 고르세요',

  // A write from the answers (profile-writer)
  writeBusy: '답변으로부터 환경설정을 이미 작성하고 있습니다. 그 작업이 끝날 때까지 기다리세요',
  writeStopped: 'CucCut이 종료되는 중이라 환경설정을 작성하지 않았습니다. 답변은 저장되었습니다',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: '이 세션은 프로젝트에 속하지 않아 프로젝트 수준이 없습니다. 수준으로 workspace를 쓰거나 프로젝트 안에서 세션을 여세요',
  levelWorkspace: '모든 프로젝트에',
  levelProject: (p: { name: string }) => `${p.name} 프로젝트에`,
  toolAnswerSummary: (p: { questions: string }) => `인터뷰 답변 저장: ${p.questions}`,
  toolSkipSummary: '인터뷰 건너뛰기(답변은 유지됨)',
  toolWriteSummary: '인터뷰 답변으로 환경설정 작성',
  toolPreferencesAppend: (p: { where: string; text: string }) => `환경설정 ${p.where}에 추가: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `환경설정 ${p.where}을(를) 다음으로 바꾸기: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `규칙 “${p.name}” ${p.where} 저장: ${p.when}일 때, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `템플릿 ${p.id} 사용`,
  toolRuleRemove: (p: { where: string; name: string }) => `규칙 “${p.name}” ${p.where} 삭제`,
};
