import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const ko: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: '게시하기 전에 고정된 내보내기를 승인하세요.',
  exportRequired: '게시하려면 동영상을 렌더링하고 고정하세요.',
  accountsRequired: '계정을 하나 이상 선택하세요.',
  timezoneInvalid: '올바른 시간대를 선택하세요.',
  accountUnavailable: '이 계정은 더 이상 사용할 수 없습니다. 다시 연결하거나 다른 계정을 선택하세요.',
  accountDuplicateRoute: '같은 계정이 두 경로를 통해 선택되었습니다. 경로 하나를 선택하세요.',
  accountNotConnected: '전송하기 전에 게시 설정에서 이 계정을 연결하세요.',
  formatMismatch: '이 형식은 계정의 네트워크와 맞지 않습니다. 다른 형식을 선택하세요.',
  descriptionRequired: '이 계정의 설명을 입력하세요.',
  titleLength: (p: { max: number }) => `YouTube 제목은 1~${p.max}자여야 합니다.`,
  audienceRequired: '이 YouTube 동영상이 어린이용인지 선택하세요.',
  tagsTooLong: (p: { max: number }) => `YouTube 태그는 ${p.max}자 이내로 입력하세요. 그렇지 않으면 YouTube에서 삭제될 수 있습니다.`,
  shortTooLong: 'YouTube Shorts는 최대 3분까지 가능합니다. YouTube 동영상을 선택하거나 내보내기를 줄이세요.',
  shortsClassification: 'YouTube는 3분 이하의 정사각형 또는 세로 동영상을 Shorts로 분류합니다. 이 내보내기에는 YouTube Shorts를 선택하세요.',
  portraitRequired: '이 형식에는 세로 또는 정사각형 내보내기가 필요합니다. 세로 버전을 렌더링하거나 다른 형식을 선택하세요.',
  captionTooLong: (p: { length: number; max: number }) => `설명과 해시태그가 ${p.length}자입니다. 이 네트워크는 ${p.max}자까지 허용합니다. 줄이세요.`,
  timeInPast: '이 시간은 이미 지났습니다. 미래 시간을 선택하거나, 지우고 지금 보내세요.',
  expiresBefore: '이 게시물은 공개되기 전에 만료됩니다. 더 이른 시간을 선택하거나 더 늦은 만료 시점을 설정하세요.',
  deliveryUnsettled:
    '이 계정에 대한 이 동영상의 다른 릴리스가 아직 대기 중이거나 확인되지 않았습니다. 다시 보내기 전에 그 결과를 기록하세요.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: '미등록 공개 범위는 YouTube에서만 사용할 수 있습니다.',
  optionTagsYoutubeOnly: '태그는 YouTube에서만 사용할 수 있습니다. 대신 해시태그를 설명에 넣으세요.',
  optionPhoneYoutubeTags: '휴대폰 경로에서는 YouTube 태그를 설정할 수 없습니다. 태그를 삭제하거나 다른 경로를 선택하세요.',
  optionPostbridgeYoutubeAudience:
    'Postbridge에서는 YouTube 대상이나 공개 범위를 설정할 수 없습니다. Postbridge에 구성된 설정을 수락하거나 다른 경로를 선택하세요.',
  optionPostgunSynthetic: 'Postgun은 YouTube의 합성 미디어 공개 문구를 추가할 수 없습니다. 다른 경로를 선택하세요.',
  optionYoutubeApiInteractions: '이 경로에서는 선택한 YouTube 상호작용 또는 파트너십 옵션을 적용할 수 없습니다.',
  optionInstagramApi: '이 경로에서는 선택한 Instagram 공개 범위, 공개 표시 또는 상호작용 옵션을 적용할 수 없습니다.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: '올바른 날짜와 시간을 입력하세요.',
  timeRequired: '날짜와 시간을 선택하세요.',
  timeGap: (p: { timezone: string }) => `시계가 바뀌어서 ${p.timezone}에는 이 시간이 존재하지 않습니다. 다른 시간을 선택하세요.`,
  timeFold: (p: { timezone: string }) =>
    `시계가 바뀌어서 ${p.timezone}에서는 이 시간이 두 번 나타납니다. UTC 오프셋이 포함된 정확한 타임스탬프를 입력하세요.`,
  timestampInvalid: 'UTC 오프셋이 포함된 타임스탬프를 입력하세요. 예: 2026-10-01T18:00:00-06:00',
  noFreeSlot: '만료 전에 맞는 빈 시간이 없습니다. 계정, 주간 시간, 간격을 확인하세요.',
  destinationMissing: '이 계정은 더 이상 게시물에 포함되지 않습니다. 다시 불러온 후 다시 시도하세요.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: '지원되는 버전에서 내보낸 CucCut 캘린더 파일(JSON)을 선택하세요.',
  archiveDuplicatePublications: '캘린더 파일에 같은 게시물이 두 번 나와 있습니다. 원래 컴퓨터에서 다시 내보내세요.',
  archiveDuplicateAccounts: '캘린더 파일에 같은 계정이 두 번 나와 있습니다. 원래 컴퓨터에서 다시 내보내세요.',
  archiveDuplicateConnections: '캘린더 파일에 같은 연결이 두 번 나와 있습니다. 원래 컴퓨터에서 다시 내보내세요.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `“${p.label}”에서 캘린더 파일의 같은 계정을 두 번 나열하고 있습니다. 원래 컴퓨터에서 다시 내보내세요.`,
  archiveTimezone: (p: { timezone: string }) => `캘린더 파일이 알 수 없는 시간대(${p.timezone})를 사용합니다. 원래 컴퓨터에서 다시 내보내세요.`,
  archiveMissingConnection: (p: { name: string }) => `캘린더 파일에 “${p.name}”의 연결이 없습니다.`,
  archiveLinkedAccount: (p: { name: string }) => `캘린더 파일의 “${p.name}”에 연결된 계정이 올바르지 않습니다.`,
  archiveMissingAccount: (p: { label: string }) => `캘린더 파일에 “${p.label}”이(가) 사용하는 계정이 없습니다.`,
  archiveInvalidDate: (p: { label: string }) => `캘린더 파일의 “${p.label}”에 잘못된 날짜가 있습니다.`,
  importConnectionConflict: (p: { name: string }) => `캘린더 파일의 연결 “${p.name}”이(가) 이 컴퓨터의 연결과 충돌합니다.`,
  importAccountConflict: (p: { name: string }) => `캘린더 파일의 계정 “${p.name}”이(가) 이 컴퓨터의 계정과 충돌합니다.`,
  importedInFlight: '전송 중에 가져왔습니다. 네트워크 앱에서 결과를 확인하고 다시 보내기 전에 기록하세요.',
};
