import type { RailMessages } from './rail-copy.ts';

export const ko: RailMessages = {
  running: (n: number) => `${n}개 진행 중`,
  finished: (n: number) => `${n}개 완료`,
  nothingYet: '아직 없음',
  tasksBlurb: '전사, 번역, 내보내기, 에이전트 작업을 한 목록에 모았습니다. 작업을 열면 단계와 결과를 볼 수 있습니다.',
  toolCount: (n: number) => `도구 ${n}개`,
  moreFinished: (n: number) => `나머지 ${n}개는 모든 작업에`,
};
