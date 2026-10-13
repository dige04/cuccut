import type { RcPublishingMessages } from './rc-publishing.ts';

export const ko: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: '소유자만 이 컴퓨터의 CucCut 앱에서 이 작업을 할 수 있습니다.',
  desktopOnly: '승인, 전송, 결과 기록 및 연결 관리는 이 컴퓨터의 CucCut 앱에서만 사용할 수 있습니다.',
  settingsOwnerOnly: '게시 일정은 소유자만 변경할 수 있습니다. 소유자에게 게시 설정에서 변경을 요청하세요.',
  transferNotAllowed: '캘린더 가져오기와 내보내기는 CucCut 앱과 명령줄에서 사용할 수 있습니다.',
  authorizationRequired: '에이전트가 전송하려면 소유자가 CucCut에서 이 게시물을 정확히 승인해야 합니다.',
  // Publications.
  publicationArchived: '이 게시물은 보관되었습니다. 변경하기 전에 복원하세요.',
  publicationLocked: '전송된 대상은 공유 콘텐츠를 유지합니다. 실패한 대상을 편집하거나 새 릴리스를 준비하세요.',
  destinationLocked: '이 계정의 전송이 이미 시작되었습니다. 변경하기 전에 철회하거나 결과를 기록하세요.',
  destinationKept: '전송된 대상은 게시물에 그대로 남습니다. 제거하기 전에 철회하거나 결과를 기록하세요.',
  destinationAccountFixed: '다른 계정을 사용하려면 이 대상을 제거하고 대신 그 계정을 추가하세요.',
  destinationNotFound: '이 계정은 더 이상 게시물에 포함되지 않습니다. 다시 불러온 후 다시 시도하세요.',
  duplicateAccount: '각 계정은 한 번만 선택하세요.',
  duplicatePlacement: '각 계정의 시간은 한 번만 선택하세요.',
  afterExpiry: '이 게시물이 만료되기 전의 시간을 선택하세요.',
  invalid: '이 게시물은 아직 준비되지 않았습니다. 나열된 문제를 해결한 후 다시 시도하세요.',
  nothingToSend: '이 게시물의 모든 계정에 이미 전송되었습니다. 다시 보내려면 새 릴리스를 준비하세요.',
  slotTaken: (p: { account: string }) =>
    `이 시간은 ${p.account}의 다른 게시물과 충돌합니다. 다른 시간을 선택하거나 게시 설정에서 게시물 사이 간격을 줄이세요.`,
  slotsHaveDestinationTimes: '이 게시물 중 일부는 계정별 개별 시간이 있습니다. 공통 시간을 예약하기 전에 그 시간을 지우세요.',
  calendarRange: '캘린더 범위는 최대 93일이어야 하며, 시작일이 종료일보다 앞이어야 합니다.',
  archiveInFlight: '이 게시물을 보관하기 전에 대기 중인 전송을 철회하거나 결과를 기록하세요.',
  // Delivery.
  providerUnsupported: '이 버전의 CucCut은 직접 게시만 지원합니다. 이 연결에는 직접 게시를 선택하세요.',
  notWaiting: '사용자를 기다리는 계정만 철회할 수 있습니다.',
  cancelNotAllowed: '전송되지 않은 계정만 취소할 수 있습니다. 철회하거나 먼저 결과를 기록하세요.',
  reconcileFinal: '게시되었거나 취소된 전송은 기록의 일부입니다. 변경하는 대신 새 릴리스를 준비하세요.',
  reconcileSending: '결과를 기록하기 전에 현재 전송이 끝날 때까지 기다리세요.',
  reconcileFutureTime: '이 게시물에 대해 네트워크가 표시하는 미래 시간을 입력하세요.',
  // Pinned exports.
  exportRequired: '먼저 동영상을 렌더링하고 고정하세요.',
  exportChanged: '승인된 내보내기가 변경되었습니다. 게시하기 전에 확인된 내보내기를 고정하세요.',
  exportStale: '고정하기 전에 현재 버전을 내보내거나 “렌더링 후 고정”을 선택하세요.',
  exportNotFinished: '이 내보내기는 아직 완료되지 않았습니다. 기다리거나 다른 내보내기를 선택하세요.',
  exportNotVideo: '동영상 전체의 완료된 MP4 내보내기를 선택하세요.',
  exportOtherVideo: '이 내보내기는 다른 동영상 또는 시퀀스의 것입니다. 이 동영상의 내보내기를 선택하세요.',
  exportFileMissing: '내보낸 파일이 더 이상 이 컴퓨터에 없습니다. 동영상을 다시 렌더링하고 고정하세요.',
  exportFileChanged: '내보낸 파일이 렌더링 후 변경되었습니다. 동영상을 다시 렌더링하고 고정하세요.',
  pinLocked: '전송된 대상은 고정된 내보내기를 유지합니다. 다른 내보내기를 사용하려면 새 릴리스를 준비하세요.',
  renderFailed: '이 게시물의 내보내기가 완료되지 않았습니다. 다시 렌더링하고 고정하세요.',
  renderCancelled: '이 게시물의 내보내기가 취소되었습니다. 준비되면 다시 렌더링하고 고정하세요.',
  videoNotFound: '이 동영상은 이 컴퓨터에 없습니다. 프로젝트를 연 다음 다시 시도하세요.',
  // Settings, connections and accounts.
  accountNotFound: '이 계정은 더 이상 존재하지 않습니다. 게시 설정을 다시 불러온 후 다시 시도하세요.',
  connectionNotFound: '이 연결은 더 이상 존재하지 않습니다. 게시 설정을 다시 불러온 후 다시 시도하세요.',
  defaultAccountMissing: '기본 계정이 더 이상 존재하지 않습니다. 기본 계정을 다시 선택하세요.',
  connectionProviderFixed: '연결은 추가된 경로를 유지합니다. 다른 방식으로 게시하려면 새 연결을 추가하세요.',
  accountIdentityFixed: '계정은 연결과 네트워크를 유지합니다. 대신 새 계정을 추가하세요.',
  accountDuplicate: '이 계정은 이미 이 연결에 추가되어 있습니다.',
  accountInUse: (p: { name: string }) =>
    `${p.name}에 대기, 예약 또는 미확인 상태의 게시물이 있습니다. 계정을 제거하기 전에 그 결과를 기록하세요.`,
  linkInvalid: '연결되어 있지 않은 같은 네트워크의 다른 계정을 선택하세요.',
  linkCanonical: '다른 계정이 이 계정에 연결되어 있습니다. 대신 다른 경로를 이 계정에 연결하세요.',
  // Copy proposals.
  proposalReason: '동영상, 대본 및 작성 가이드를 바탕으로 한 초안입니다. 적용하기 전에 검토하세요.',
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut 게시',
  // Calendar transfer and cleanup.
  backupFailed: '게시 데이터의 백업을 쓸 수 없어 아무것도 가져오지 않았습니다. 디스크를 확인하고 다시 시도하세요.',
};
