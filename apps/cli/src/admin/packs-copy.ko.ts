import type { PacksMessages } from './packs-copy.ts';

export const ko: PacksMessages = {
  packsHelp: `사용법:
  cuccut packs inspect <source>    팩을 읽고, 설치하지 않은 채 들어 있는 모든 내용을 보여 줍니다.
                                   <source>: 폴더, GitHub 주소(owner/repo, 저장소 URL 또는
                                   …/tree/<branch>/<folder>), 또는 pack.json을 제공하는 https:// 주소
  cuccut packs install <source>    팩을 읽고 템플릿, 스킬, 라이브러리 항목, 스타일 가이드, 빠른 작업을 설치합니다
    --replace                      같은 ID를 가진 내 템플릿과 스킬을 교체합니다(휴지통으로 이동).
                                   이 옵션이 없으면 그대로 두고 건너뜁니다
  cuccut packs remove <id>         팩을 삭제합니다. 팩과 함께 가져온 템플릿과 스킬은 24시간 동안 휴지통에 보관되며,
                                   라이브러리 항목과 내가 바꾼 내용은 남습니다
  cuccut packs restore <trashId>   24시간 안에 삭제를 되돌립니다
  cuccut packs style <id> [<file>|-]
                                   팩의 스타일 가이드를 출력합니다. 파일(또는 표준 입력인 -)을 지정하면
                                   그 파일을 가이드로 저장합니다(빈 파일이면 가이드가 삭제됩니다)
  cuccut packs export <folder> --name <name>
                                   내 템플릿, 스킬, 라이브러리 항목으로 팩 폴더를 기록합니다. 파일 목록과 함께
                                   그대로 보내거나, GitHub에 푸시하거나, 임의의 정적 호스트에서 제공할 수 있습니다.
                                   폴더는 비어 있거나 이 팩의 이전 내보내기 폴더여야 합니다
    --id <id>                      팩 ID(기본값: 이름에서 생성)
    --version <version>            기본값 1.0.0
    --author <name>, --description <text>
    --template <id>                내가 만든 템플릿(반복 가능)
    --skill <id>                   기본 제공이 아닌 스킬(반복 가능)
    --library <glossaries|brand>:<entryId>
                                   라이브러리 항목(반복 가능). 음성은 그대로 둡니다
    --quick-actions <packId>       설치된 팩의 빠른 작업(반복 가능)
    --style-from <packId>          설치된 팩의 스타일 가이드와 참조 파일`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, 작성자 ${author}` : ''}`,
  notInstalled: '설치되지 않음: 먼저 읽으세요.',
  installedVersion: (version: string) =>
    `버전 ${version}이(가) 설치되어 있습니다. 다시 설치하면 팩이 소유한 항목은 업데이트되고, 내가 바꾼 내용은 유지됩니다.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `템플릿 ${templates}개` : '',
      skills ? `스킬 ${skills}개` : '',
      library ? `라이브러리 항목 ${library}개` : '',
      style ? '스타일 가이드' : '',
      quickActions ? `빠른 작업 ${quickActions}개` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : '자체 구성 요소 없음';
  },
  sectionTemplates: '템플릿',
  sectionSkills: '스킬',
  sectionLibrary: '라이브러리',
  sectionStyle: '스타일 가이드: 에이전트는 선택하고 편집하기 전에 이것을 읽습니다',
  sectionExamples: '참조 파일',
  sectionQuick: '빠른 작업: 한 번의 클릭으로 에이전트에게 보내는 메시지',
  sectionReserved: '규칙과 검토 기준: 팩과 함께 보관됩니다. CucCut은 아직 사용하지 않습니다',
  sectionWarnings: '경고',
  agentReads: '에이전트가 따를 텍스트입니다. 읽어 보세요.',
  stateNew: '새 항목',
  stateUpdate: '이 팩이 설치한 사본을 업데이트합니다',
  stateChanged: '설치 후 바꾸었습니다: --replace를 쓰지 않으면 유지됩니다',
  stateExists: '같은 ID의 항목이 이미 있습니다: --replace를 쓰지 않으면 내 항목이 유지됩니다',
  stateBuiltin: '같은 ID의 기본 항목이 있어 이 항목은 설치되지 않습니다',
  skillFiles: (files: number) => `파일 ${files}개`,
  duplicate: '이미 라이브러리에 있어 다시 추가하지 않습니다',
  bytes: (bytes: number) => `${bytes}바이트`,
  missingSkill: (template: string, skill: string) =>
    `${template}이(가) “${skill}” 스킬을 추천하지만, 그 스킬은 이 컴퓨터에도 없고 팩에도 없습니다`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, ${line}번째 줄: ${why}${text ? ` (“${text}”)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `이 팩은 설치되지 않습니다: ${file}의 ${line}번째 줄이 ${why}${text ? ` (“${text}”)` : ''}`,
  installHint: (source: string) => `다음 명령으로 설치하세요: cuccut packs install ${source}`,
  replaceHint: '같은 ID를 가진 내 항목을 교체하려면 --replace를 추가하세요.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `${name} v${version}을(를) 설치했습니다: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `${kind === 'template' ? '템플릿' : kind === 'skill' ? '스킬' : '라이브러리 항목'} ${id}을(를) 건너뛰었습니다: ${
      reason === 'builtin'
        ? '같은 ID의 기본 항목이 있습니다'
        : reason === 'exists'
          ? '같은 ID의 내 항목이 있습니다 (--replace 추가)'
          : '설치 후 바꾸었습니다 (--replace 추가)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name}을(를) 삭제했습니다: 템플릿 ${templates}개와 스킬 ${skills}개도 함께 삭제됐습니다. 라이브러리 항목은 남습니다.`,
  kept: (count: number, ids: string) => `내가 바꾼 항목 ${count}개는 남습니다: ${ids}`,
  undo: (trashId: string) => `24시간 안에 되돌리기: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `${name} v${version}을(를) 되돌렸습니다`,

  // Style guide
  noStyle: (name: string, id: string) => `${name}에는 스타일 가이드가 없습니다. cuccut packs style ${id} <file>로 저장하세요`,
  styleSaved: (name: string, chars: number, limit: number) => `${name}의 스타일 가이드를 저장했습니다 (${chars} / ${limit}자)`,
  styleRemoved: (name: string) => `${name}의 스타일 가이드를 제거했습니다`,
  takesEffect: '다음 새 에이전트 세션부터 적용됩니다.',
  idFormat: (value: string) => `팩 ID가 아닙니다 (소문자, 숫자, 단일 하이픈만 사용): ${value}`,

  // Export
  exportNeedsName: '--name으로 팩 이름을 지정하세요.',
  exportNoId: (name: string) => `“${name}”으로 ID를 만들 수 없습니다. --id로 지정하세요.`,
  libraryFormat: (value: string) => `라이브러리 항목이 아닙니다 (glossaries:<entryId> 또는 brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `${dir}에 기록했습니다: 파일 ${files}개, ${bytes}바이트. 폴더를 그대로 보내거나, GitHub에 푸시하거나, 정적 호스트에서 제공하세요.`,
  exportedCheck: (dir: string) => `다음 명령으로 다시 읽어 보세요: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `${file}을(를) 읽을 수 없습니다: ${reason}`,
};
