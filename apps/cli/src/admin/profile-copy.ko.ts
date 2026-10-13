import type { ProfileMessages } from './profile-copy.ts';

export const ko: ProfileMessages = {
  help: `사용법:
  cuccut profile show [--project <id>]
                                   CucCut이 당신에 대해 알고 있는 것: 인터뷰, 환경설정, 규칙,
                                   그리고 정확히 써야 하는 이름. 프로젝트(--project 또는 현재 폴더의 프로젝트)를
                                   지정하면 그 프로젝트의 환경설정과 규칙도 표시
  cuccut profile answers set <question> <text>
                                   인터뷰 답변 하나를 저장(who, record, platforms, annoys, names).
                                   빈 텍스트를 넣으면 답변이 지워짐
  cuccut profile interview skip|reopen|write
                                   인터뷰를 건너뛰거나, 다시 열거나, 답변으로 기본 에이전트를 통해 환경설정을 작성
                                   (에이전트가 없으면 답변은 입력한 그대로 유지됨)
  cuccut profile preferences [--project <id>] --file <md>
                                   당신의 환경설정 또는 프로젝트의 환경설정을 Markdown 파일로 바꿈
                                   (--file - 은 표준 입력을 읽음). 인터뷰가 작성한 섹션은 그대로 남음
  cuccut profile rules list [--project <id>]
                                   당신의 규칙(또는 프로젝트의 규칙)을 읽히는 순서대로 표시
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   규칙은 순서대로 읽힙니다. 두 규칙이 충돌하면 뒤에 있는 규칙이 우선
에이전트는 세션이 시작될 때 프로필을 읽습니다. 이미 열린 세션은 기존 내용을 유지합니다.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `인터뷰 질문이 아닙니다: ${value} (다음 중 하나를 사용: ${ids})`,
  needFile: '환경설정은 Markdown 파일로 지정하세요: --file <md>, 표준 입력은 --file -',
  badMove: (value: string) => `규칙을 위, 아래, 또는 위치(1이 첫 번째)로 이동하세요: ${value}`,
  ruleMissing: (id: string) => `이 수준에 규칙 ${id}이(가) 없습니다(cuccut profile rules list 참고)`,
  projectMissing: (id: string) => `프로젝트 ${id}이(가) 없습니다(cuccut projects list 참고)`,
  stdinPrompt: '환경설정을 입력하거나 붙여 넣은 뒤 Ctrl-D를 누르세요:',

  // show
  questionWho: '무엇을 만들고, 누구를 위한 것인가요?',
  questionRecord: '보통 무엇을 녹화하나요?',
  questionPlatforms: '어디에 올리고, 길이는 어느 정도여야 하나요?',
  questionAnnoys: '요즘 영상에서 거슬리는 점은 무엇인가요?',
  questionNames: '정확히 써야 하는 이름',
  interviewLine: (status: string, answered: number, total: number) => `인터뷰: ${status}, ${total}개 중 ${answered}개 답변`,
  statusPending: '아직 진행하지 않음',
  statusSkipped: '건너뜀',
  statusDone: '완료',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: '내 환경설정',
  interviewHeading: '인터뷰가 작성한 내용',
  projectHeading: (name: string) => `${name}의 환경설정`,
  noText: '  (없음)',
  rulesHeading: '규칙',
  projectRulesHeading: (name: string) => `${name}의 규칙`,
  noRules: '  아직 규칙이 없습니다',
  namesLine: (names: string) => `정확히 써야 할 이름: ${names}`,
  readOnly: '이 프로필은 더 최신 버전의 CucCut이 저장한 것이라 표시만 되며, 변경은 거부됩니다',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (꺼짐)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   조건: ${when}`,
  ruleDo: (instruction: string) => `   지침: ${instruction}`,
  ruleTemplate: (id: string) => `   템플릿: ${id}`,
  stageAny: '선택과 편집',
  stageClip: '클립 선택',
  stageEdit: '편집',
  ruleEnabled: (name: string) => `켜짐: ${name}`,
  ruleDisabled: (name: string) => `꺼짐: ${name}`,
  ruleRemoved: (name: string, id: string) => `${name} 삭제됨 (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `${name}을(를) ${total}개 중 ${position}번째로 이동함`,

  // Writes
  answerSaved: (question: string) => `“${question}”에 대한 답변을 저장함`,
  answerCleared: (question: string) => `“${question}”에 대한 답변을 지움`,
  interviewSkipped: '인터뷰를 건너뜀; 답변은 유지됨',
  interviewReopened: '이전 답변과 함께 인터뷰를 다시 열었음',
  writing: '답변으로 환경설정을 작성하는 중입니다. 잠시 걸립니다…',
  writtenByAgent: '답변으로 작성한 환경설정:',
  keptAsTyped: (reason: string) => `답변을 입력한 그대로 유지함(${reason}):`,
  reasonNoAgent: '설치되어 로그인된 에이전트가 없습니다',
  reasonAgentFailed: '에이전트 실행이 끝나지 않았습니다',
  reasonBadOutput: '에이전트의 출력을 사용할 수 없었습니다',
  namesAdded: (names: string) => `용어집에 이름을 추가함: ${names}`,
  preferencesSaved: (chars: number) => `환경설정을 저장함(${chars}자)`,
  projectPreferencesSaved: (name: string, chars: number) => `${name}의 환경설정을 저장함(${chars}자)`,
  takesEffect: '에이전트는 세션이 시작될 때 이것을 읽습니다. 이미 열린 세션은 기존 내용을 유지합니다',
};
