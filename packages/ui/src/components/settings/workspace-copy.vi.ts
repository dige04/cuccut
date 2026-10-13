import type { WorkspaceMessages } from './workspace-copy.ts';

export const vi: WorkspaceMessages = {
  aside: 'Mọi thứ ở đây áp dụng cho tất cả dự án',
  generalBlurb: 'Giao diện và ngôn ngữ của CucCut, nơi lưu tệp tải về và những gì nó được phép tải từ internet.',
  shortcutsBlurb: 'Các phím tắt dùng được ở mọi nơi trong CucCut. Phím tắt của trình biên tập nằm trong Trợ giúp (F1).',
  shortcutsPanel: 'Ở mọi nơi trong CucCut',
  fontsBlurb: 'Phông chữ cho phụ đề và tiêu đề: lấy từ đâu, và những phông đã có trên máy tính này.',
  privacyBlurb: 'Những gì ở lại trên máy tính này, những gì có thể gửi tới nhà cung cấp đám mây, và những gì Agent được làm mà không cần hỏi.',
  diagnosticsBlurb: 'Runtime cục bộ, nhật ký của nó, và lượng tài nguyên máy mà các tác vụ nền được dùng.',
  aboutBlurb: 'Phiên bản của ứng dụng, giao diện và Runtime, cùng cách CucCut cập nhật.',
  checking: 'Đang kiểm tra…',
  noAgent: 'Chưa có Agent sẵn sàng',
  shortcutCount: (n) => `${n} phím tắt`,
  skillCount: (n) => (n === 0 ? 'Chưa có' : `${n} skill`),
  glossaryCount: (n) => (n === 0 ? 'Chưa có' : `${n} bảng thuật ngữ`),
  grantCount: (n) => (n === 0 ? 'Không có quyền nào đang hiệu lực' : `${n} quyền đang hiệu lực`),
  runtimeOn: 'Đã kết nối Runtime',
  runtimeOff: 'Chưa kết nối Runtime',
  installed: (n) => (n === 0 ? 'Chưa cài mô hình nào' : `Đã cài ${n}`),
  noDefault: 'Chưa có mặc định',
  version: (version) => `Phiên bản ${version}`,
  desktopOnly: 'Chỉ có trên ứng dụng máy tính',
  notYet: 'Chưa hỗ trợ',
  loadFailed: 'Không tải được',
  fontsSummary: 'Dành cho phụ đề và tiêu đề',
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? 'Đã viết tùy chọn'
        : answers === 1
          ? 'Đã viết tùy chọn, 1 câu trả lời'
          : `Đã viết tùy chọn, ${answers} câu trả lời`
      : answers === 0
        ? 'Chưa có tùy chọn'
        : answers === 1
          ? '1 câu trả lời'
          : `${answers} câu trả lời`,
  ruleCount: (n, off) => (n === 0 ? 'Chưa có' : `${n === 1 ? '1 quy tắc' : `${n} quy tắc`}${off ? `, ${off} đang tắt` : ''}`),
};
