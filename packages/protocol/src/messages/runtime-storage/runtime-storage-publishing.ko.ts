import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const ko: RuntimeStoragePublishingMessages = {
  unreadable: "게시 데이터를 읽을 수 없습니다. CucCut은 파일을 그대로 두며 변경하지 않습니다. 백업에서 복원하거나 파일을 옮겨 처음부터 다시 시작하세요.",
  newerVersion: "게시 데이터는 더 새로운 버전의 CucCut에서 저장되었습니다. 변경하려면 CucCut을 업데이트하세요. 그때까지는 보기만 가능합니다.",
  conflict: "이 게시물은 다른 곳에서 변경되었습니다. 변경 사항을 적용하기 전에 저장된 버전을 다시 불러오세요.",
  settingsConflict: "게시 설정이 다른 곳에서 변경되었습니다. 저장하기 전에 다시 불러오세요.",
  notFound: "이 게시물은 더 이상 존재하지 않습니다.",
  invalidRecord: "이 변경으로 게시 기록이 불완전해지므로 저장되지 않았습니다. 값을 확인하고 다시 시도하세요.",
  writeFailed: "게시 데이터를 디스크에 저장할 수 없습니다. 디스크에 여유 공간이 있고 CucCut이 해당 폴더에 쓸 수 있는지 확인한 후 다시 시도하세요.",
};
