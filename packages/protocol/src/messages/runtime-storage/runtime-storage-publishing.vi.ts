import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const vi: RuntimeStoragePublishingMessages = {
  unreadable: "Không đọc được dữ liệu phát hành. CucCut giữ nguyên tệp và sẽ không thay đổi nó. Hãy khôi phục từ bản sao lưu, hoặc chuyển tệp sang chỗ khác để bắt đầu lại.",
  newerVersion: "Dữ liệu phát hành được lưu bởi phiên bản CucCut mới hơn. Hãy cập nhật CucCut để thay đổi; cho đến lúc đó bạn chỉ có thể xem.",
  conflict: "Bài phát hành này đã bị thay đổi ở nơi khác. Hãy tải lại phiên bản đã lưu trước khi áp dụng thay đổi của bạn.",
  settingsConflict: "Cài đặt phát hành đã bị thay đổi ở nơi khác. Hãy tải lại trước khi lưu.",
  notFound: "Bài phát hành này không còn tồn tại.",
  invalidRecord: "Thay đổi này sẽ khiến một bản ghi phát hành không đầy đủ nên chưa được lưu. Hãy kiểm tra các giá trị và thử lại.",
  writeFailed: "Không thể lưu dữ liệu phát hành xuống đĩa. Hãy kiểm tra đĩa còn dung lượng và CucCut có quyền ghi vào thư mục của nó, rồi thử lại.",
};
