import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('vi', { type: 'conjunction' }).format(labels);

export const vi: SlidesMessages = {
  pages: (n) => `${n} trang`,
  paneLabel: (name) => `Trang chiếu “${name}”`,
  frameTitle: (name) => `Trình chỉnh sửa trang chiếu: ${name}`,
  opening: 'Đang mở trang chiếu…',
  unavailableTitle: 'Không dùng được trình chỉnh sửa trang chiếu',
  unavailableBody: 'Bản CucCut này không kèm trình chỉnh sửa trang chiếu. Các tệp trang chiếu vẫn nằm trong thư mục của chúng.',
  openFailed: (reason) => `Không mở được trang chiếu: ${reason}`,
  open: 'Mở trang chiếu',
  openCard: (name) => `Mở trang chiếu “${name}”`,
  openInEditor: 'Mở bằng trình chỉnh sửa trang chiếu',
  annotate: 'Chú thích',
  noteLabel: 'Chú thích',
  notePlaceholder: 'Cần sửa gì?',
  addToChat: 'Thêm vào cuộc trò chuyện',
  cancel: 'Hủy',
  token: (n) => `Chú thích trang chiếu · ${n}`,
  added: (token) => `Đã thêm vào cuộc trò chuyện · ${token}`,
  removeAll: 'Gỡ mọi chú thích trang chiếu',
  removeOne: (n) => `Gỡ chú thích ${n}`,
  item: (n, label, text) => `Chú thích ${n}, ${label}: ${text}`,
  empty: 'Hãy viết chú thích trước rồi thêm vào cuộc trò chuyện',
  tooLong: (max) => `Mỗi chú thích dài tối đa ${max} ký tự`,
  tooMany: (max) => `Mỗi tin nhắn mang tối đa ${max} chú thích trang chiếu. Hãy gửi những chú thích này trước.`,
  noConversation: 'Thẻ này chưa thuộc phiên nào. Gửi một tin nhắn để bắt đầu phiên, rồi thêm chú thích.',
  message: 'Hãy sửa các trang chiếu theo những chú thích này.',
  flushFailed: (names) =>
    `Thay đổi trên trang chiếu ${list(names.map((n) => `“${n}”`))} chưa lưu xong nên tin nhắn chưa được gửi. Hãy thử lại hoặc gỡ chú thích trang chiếu trước.`,
};
