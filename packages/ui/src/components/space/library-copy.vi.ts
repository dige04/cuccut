import type { LibraryMessages } from './library-copy.ts';

export const vi: LibraryMessages = {
  blurb: 'Video, tệp đa phương tiện và mọi thứ Agent đã làm, từ tất cả dự án.',
  blurbProject: 'Video, tệp đa phương tiện và kết quả trong dự án này.',
  blurbFavorite: 'Mọi thứ bạn đã đánh dấu yêu thích, từ tất cả dự án.',
  blurbTrash: 'Mục trong Thùng rác nằm ở đây cho đến khi bạn khôi phục hoặc xoá vĩnh viễn.',
  allItems: 'Tất cả mục',
  projects: 'Dự án',
  items: (n: number) => `${n} mục`,
  matching: (n: number, q: string) => `${n} mục khớp với “${q}”`,
  kindFilter: 'Loại mục',
  clearSearch: 'Xóa tìm kiếm',
  noMatchBody: 'Thử tên khác, hoặc chuyển sang loại khác.',
  openHint: 'Mở để xem trước · Video mở trong trình chỉnh sửa',
  inProject: (name: string) => `Trong ${name}`,
  clearProject: 'Hiện mọi dự án',
  backToLibrary: 'Về Thư viện',
};
