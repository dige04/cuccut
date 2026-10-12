import type { ModelSourceMessages } from './model-source-copy.ts';

export const ko: ModelSourceMessages = {
  label: "다운로드 소스",
  fold: "다운로드 및 저장",
  custom: "사용자 지정",
  isDefault: "기본값",
  msHint: "중국 본토에서 보통 더 빠름",
  customHint: "미러의 기본 URL 입력",
  hfDesc: "Hugging Face(huggingface.co)에서 다운로드합니다.",
  msDesc: "ModelScope(modelscope.cn)에서 다운로드합니다. 중국 본토에서는 보통 더 빠릅니다.",
  customDesc: "Hugging Face와 같은 경로로 파일을 제공하는 미러에서 다운로드합니다.",
  msNote: "ModelScope에 없는 일부 파일(whisper.cpp, GPT-SoVITS)은 계속 Hugging Face에서 다운로드합니다. 모든 파일은 내장된 체크섬으로 확인합니다.",
  pending: (current: string) => `주소를 입력하고 저장하면 전환됩니다. 지금은 계속 ${current}에서 다운로드합니다.`,
  envNote: (name: string) => `${name} 환경 변수가 설정되어 있으면 그 값을 사용합니다.`,
  webNote: "브라우저에서는 다운로드 소스를 변경할 수 없습니다. CucCut 데스크톱 앱에서 설정하세요.",
  fieldLabel: "미러 기본 URL",
  save: "저장",
  changed: (source: string) => `다운로드 소스를 ${source}(으)로 변경했습니다`,
};
