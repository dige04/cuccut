import type { WorkspaceMessages } from './workspace-copy.ts';

export const ko: WorkspaceMessages = {
  aside: '여기의 모든 설정은 모든 프로젝트에 적용됩니다',
  generalBlurb: 'CucCut의 모양과 언어, 다운로드가 저장되는 위치, 인터넷에서 가져와도 되는 것.',
  shortcutsBlurb: 'CucCut 어디서나 쓸 수 있는 키입니다. 편집기 단축키는 도움말(F1)에 있습니다.',
  shortcutsPanel: 'CucCut 어디서나',
  fontsBlurb: '자막과 제목에 쓰는 글꼴: 어디서 가져오는지, 그리고 이 컴퓨터에 이미 있는 글꼴.',
  privacyBlurb: '이 컴퓨터에 남는 것, 클라우드 제공업체에 보낼 수 있는 것, Agent가 묻지 않고 할 수 있는 것.',
  diagnosticsBlurb: '로컬 Runtime과 로그, 그리고 백그라운드 작업이 이 컴퓨터를 얼마나 쓸 수 있는지.',
  aboutBlurb: '앱, 인터페이스, Runtime의 버전과 CucCut이 업데이트되는 방식.',
  checking: '확인 중…',
  noAgent: '사용할 수 있는 Agent가 없습니다',
  shortcutCount: (n) => `단축키 ${n}개`,
  skillCount: (n) => (n === 0 ? '아직 없음' : `Skill ${n}개`),
  glossaryCount: (n) => (n === 0 ? '아직 없음' : `용어집 ${n}개`),
  grantCount: (n) => (n === 0 ? '유효한 권한 없음' : `유효한 권한 ${n}개`),
  runtimeOn: 'Runtime 연결됨',
  runtimeOff: 'Runtime 연결 안 됨',
  installed: (n) => (n === 0 ? '설치된 모델 없음' : `${n}개 설치됨`),
  noDefault: '기본값 없음',
  version: (version) => `버전 ${version}`,
  desktopOnly: '데스크톱 앱 전용',
  notYet: '아직 사용할 수 없음',
  loadFailed: '불러오지 못함',
  fontsSummary: '자막과 제목용',
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? '환경설정 작성됨'
        : answers === 1
          ? '환경설정 작성됨, 답변 1개'
          : `환경설정 작성됨, 답변 ${answers}개`
      : answers === 0
        ? '아직 환경설정 없음'
        : answers === 1
          ? '답변 1개'
          : `답변 ${answers}개`,
  ruleCount: (n, off) => (n === 0 ? '아직 없음' : `${n === 1 ? '규칙 1개' : `규칙 ${n}개`}${off ? `, 꺼짐 ${off}개` : ''}`),
  packsBlurb:
    '영상을 만드는 방식을 옮겨 갈 수 있는 묶음입니다. 템플릿, 스킬, 라이브러리 항목, 스타일 가이드를 한 폴더에 담습니다. 폴더, GitHub, 웹 주소에서 가져오거나 내 팩을 내보내 보낼 수 있습니다.',
  packCount: (n: number) => (n === 0 ? '설치된 팩 없음' : `팩 ${n}개`),
};
