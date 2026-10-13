import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const ko: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: '길이', what: '완성된 영상의 재생 시간입니다.' },
    'video.shortSidePx': { label: '짧은 변', what: '캔버스의 짧은 변 길이(픽셀)입니다.' },
    'video.shots': { label: '컷 수', what: '메인 트랙의 영상과 이미지 클립입니다.' },
    'video.cutsPerMin': { label: '분당 컷 수', what: '메인 트랙이 다음 클립으로 넘어가는 빈도입니다.' },
    'video.longestShotSec': { label: '가장 긴 샷', what: '메인 트랙에서 가장 긴 클립입니다.' },
    'video.longestBlankSec': { label: '가장 긴 빈 구간', what: '화면에 아무것도 없는 가장 긴 구간입니다.' },
    'captions.on': { label: '자막 표시', what: '영상에 자막이 표시되는지 여부입니다.' },
    'captions.wordsPerSec': { label: '초당 자막 단어 수', what: '자막이 요구하는 읽기 속도입니다.' },
    'hook.present': { label: '훅', what: '훅 문장입니다. 숏을 자른 문장이거나, 처음 2초 안에 시작하는 텍스트입니다.' },
    'hook.words': { label: '훅 단어 수', what: '훅의 단어 수입니다.' },
    'text.offCanvas': { label: '가장자리를 넘는 텍스트', what: '텍스트 상자가 프레임의 왼쪽이나 오른쪽 가장자리를 넘는지 여부입니다.' },
    'items.placeholders': { label: '자리표시자 상자', what: '아직 미디어를 기다리는 자리표시자 상자입니다.' },
    'transitions.count': { label: '전환', what: '클립 사이의 전환입니다.' },
    'layers.max': { label: '추가 레이어', what: '첫 번째를 넘어 사용 중인 영상 트랙입니다. 0은 단일 트랙을 뜻합니다.' },
    'export.durationSec': { label: '내보낸 길이', what: '내보낸 파일의 재생 시간입니다.' },
    'export.width': { label: '내보낸 너비', what: '내보낸 영상의 너비(픽셀)입니다.' },
    'export.height': { label: '내보낸 높이', what: '내보낸 영상의 높이(픽셀)입니다.' },
    'export.loudnessLufs': { label: '라우드니스', what: '정규화 후 내보낸 파일의 라우드니스입니다. 정규화된 경우에만 읽습니다.' },
    'export.truePeakDb': { label: '트루 피크', what: '정규화 후 내보낸 파일의 가장 큰 피크입니다. 정규화된 경우에만 읽습니다.' },
  },
};
