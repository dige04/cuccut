import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const ko: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json은 하나의 JSON 객체여야 합니다',
  formatMissing: 'pack.json에 "format": "cuccut.pack"이 없으므로 CucCut 팩이 아닙니다',
  foreignFormat: '이것은 agentcut 팩입니다: pack.json에 "format" 필드가 없습니다. CucCut은 cuccut.pack 폴더만 읽습니다',
  otherFormat: (p: { format: string }) => `pack.json의 형식이 "${p.format}"입니다. "cuccut.pack"이 아닙니다`,
  unsupportedSchema: (p: { schema: string }) => `팩 스키마 ${p.schema}은(는) 지원되지 않습니다. 이 버전의 CucCut은 스키마 1만 읽습니다`,
  unsupportedField: (p: { field: string }) => `"${p.field}"은(는) 지원되지 않습니다: 이 버전의 CucCut에서 팩은 코드를 담지 않습니다`,
  idChars: '팩 ID는 소문자, 숫자, 단일 하이픈으로 이루어지며 글자로 시작합니다',
  idReserved: (p: { id: string }) => `"${p.id}"은(는) 예약된 이름이라 팩 ID로 쓸 수 없습니다`,
  versionChars: '버전은 글자, 숫자, 점, 하이픈, 플러스 기호로 이루어집니다',
  templateIdChars: '템플릿 ID는 소문자, 숫자, 단일 하이픈으로 이루어지며 글자로 시작합니다',
  ruleIdChars: '규칙 ID는 소문자, 숫자, 단일 하이픈으로 이루어집니다',
  duplicateTemplates: '같은 템플릿이 두 번 지정되었습니다',
  duplicateSkills: '같은 스킬이 두 번 지정되었습니다',
  duplicateLibrary: '같은 라이브러리 파일이 두 번 지정되었습니다',
  duplicateExamples: '같은 참조 파일이 두 번 지정되었습니다',
  duplicateQuickActions: '같은 이름표를 가진 빠른 작업이 두 개 있습니다',
  duplicateRules: '같은 규칙이 두 번 지정되었습니다',
  duplicateFiles: 'files에 같은 파일이 두 번 나열되었습니다',
  libraryDir: (p: { dir: string }) => `라이브러리 파일은 ${p.dir}/ 아래에 있어야 합니다`,
  libraryVoice: '음성은 팩에 담을 수 없습니다: 음성에는 소유자의 동의가 필요합니다',
  examplesDir: (p: { dir: string }) => `참조 파일은 ${p.dir}/ 아래에 있어야 합니다`,
  exampleExtension: (p: { kind: string; extensions: string }) => `${p.kind} 참조는 ${p.extensions} 중 하나여야 합니다`,
  stillExtension: (p: { extensions: string }) => `정지 이미지는 이미지여야 합니다: ${p.extensions}`,
  styleFile: '스타일 가이드는 팩 루트에 있는 Markdown 파일(.md)입니다',
  reviewFile: '검토 기준은 팩 루트에 있는 JSON 파일입니다',
  sha256Hex: 'sha256은 64자리의 소문자 16진수입니다',

  // Paths inside a pack
  pathRelative: '경로는 팩 폴더를 기준으로 한 상대 경로여야 합니다',
  pathHidden: '팩 경로는 숨김 파일이나 폴더(점으로 시작)를 가리킬 수 없습니다',
  fileNotNamed: (p: { path: string }) => `${p.path}은(는) pack.json에 지정되어 있지 않습니다`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `${p.length}자입니다. 스타일 가이드는 최대 ${p.limit}자까지 담을 수 있습니다`,
  whyIgnoreInstructions: '에이전트에게 지시를 무시하라고 합니다',
  whyChangeIdentity: '에이전트의 정체성을 바꾸려 합니다',
  whyRevealSecrets: '비밀 정보나 프롬프트를 요구합니다',
  whyCredential: '자격 증명을 포함합니다',
  whyCommand: '실행할 명령을 포함합니다',
  whyDeleteWork: '에이전트에게 작업을 삭제하라고 합니다',
  whySendUrl: '에이전트에게 웹 주소로 무언가를 보내라고 합니다',
  whyPromptBoundary: '프롬프트 경계를 흉내 냅니다',
};
