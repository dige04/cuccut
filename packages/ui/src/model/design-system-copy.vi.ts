import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('vi', { type: 'conjunction' }).format(labels);

export const vi: DesignSystemMessages = {
  paneLabel: (name) => `Hệ thống thiết kế “${name}”`,
  frameTitle: (name) => `Trình chỉnh sửa hệ thống thiết kế: ${name}`,
  opening: 'Đang mở hệ thống thiết kế…',
  unavailableTitle: 'Không dùng được trình chỉnh sửa hệ thống thiết kế',
  unavailableBody: 'Bản CucCut này không kèm trình chỉnh sửa hệ thống thiết kế. Các tệp của hệ thống thiết kế vẫn nằm trong thư mục của chúng.',
  hostBlockedTitle: 'Không mở được trình chỉnh sửa hệ thống thiết kế ở địa chỉ này',
  hostBlockedBody: 'Hãy mở CucCut Web bằng 127.0.0.1 hoặc localhost để chỉnh sửa hệ thống thiết kế. Các tệp của hệ thống thiết kế vẫn nằm trong thư mục của chúng.',
  openFailed: (reason) => `Không mở được hệ thống thiết kế: ${reason}`,
  open: 'Mở hệ thống thiết kế',
  openInEditor: 'Mở bằng trình chỉnh sửa hệ thống thiết kế',
  annotate: 'Chú thích',
  noteLabel: 'Chú thích',
  notePlaceholder: 'Cần sửa gì?',
  addToChat: 'Thêm vào cuộc trò chuyện',
  cancel: 'Hủy',
  where: (name, label) => `Hệ thống thiết kế “${name}” › ${label}`,
  token: (n) => `Chú thích hệ thống thiết kế · ${n}`,
  added: (token) => `Đã thêm vào cuộc trò chuyện · ${token}`,
  removeAll: 'Gỡ mọi chú thích hệ thống thiết kế',
  removeOne: (n) => `Gỡ chú thích ${n}`,
  item: (n, label, text) => `Chú thích ${n}, ${label}: ${text}`,
  empty: 'Hãy viết chú thích trước rồi thêm vào cuộc trò chuyện',
  tooLong: (max) => `Mỗi chú thích dài tối đa ${max} ký tự`,
  tooMany: (max) => `Mỗi tin nhắn mang tối đa ${max} chú thích hệ thống thiết kế. Hãy gửi những chú thích này trước.`,
  noConversation: 'Thẻ này chưa thuộc phiên nào. Gửi một tin nhắn để bắt đầu phiên, rồi thêm chú thích.',
  message: 'Hãy sửa hệ thống thiết kế theo những chú thích này.',
  flushFailed: (names) =>
    `Thay đổi trên hệ thống thiết kế ${list(names.map((n) => `“${n}”`))} chưa lưu xong nên tin nhắn chưa được gửi. Hãy thử lại hoặc gỡ chú thích hệ thống thiết kế trước.`,
};
