import type { HarnessProjectsMessages } from './harness-projects.ts';

export const vi: HarnessProjectsMessages = {
conversationNotFound: (p) => `Không tìm thấy phiên: ${p.id}`, projectNotFound: (p) => `Không tìm thấy dự án: ${p.id}`, folderInaccessible: (p) => `Thư mục không tồn tại hoặc không thể truy cập: ${p.dir}`, markerReadFailed: (p) => `Không đọc được dấu dự án: ${p.error}`, markerNewer: (p) => `Dự án này được tạo bằng phiên bản CucCut mới hơn (phiên bản dấu dự án ${p.version}). Cập nhật CucCut rồi mở lại`, untitledProject: 'Dự án chưa đặt tên', recoveredVideos: 'Video đã khôi phục', createFolderFailed: (p) => `Không tạo được thư mục dự án: ${p.error}`, tooManySameName: 'Quá nhiều thư mục dự án có tên này. Chọn tên khác', markerNotWritable: (p) => `Không thể ghi vào thư mục dự án nên không ghi được dấu dự án .ccut/project.json: ${p.dir}`, markerWriteFailed: (p) => `Không ghi được dấu dự án: ${p.error}`,
sessionVideosOpen: (p) => `Một số video trong phiên này vẫn đang mở: ${p.names}. Đóng chúng rồi thử lại`,
};
