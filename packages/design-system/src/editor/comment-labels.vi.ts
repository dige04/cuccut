import type { CommentLabelMessages } from './comment-labels.ts';

export const vi: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Nhóm màu',
    tset: 'Bộ kiểu chữ',
    style: 'Kiểu chữ',
    font: 'Phông chữ',
    knob: 'Thiết lập kiểu',
    editor: 'Trình sửa kiểu',
    picker: 'Bộ chọn màu',
    prop: 'Thuộc tính',
    props: 'Danh sách thuộc tính',
    cell: 'Giá trị màu',
    agroup: 'Nhóm tài nguyên',
    asset: 'Tài nguyên',
    comp: 'Thành phần',
    doc: 'Tài liệu',
    dialog: 'Hộp thoại',
    lightbox: 'Xem trước tài nguyên',
    note: 'Ghi chú sử dụng',
    page: 'Tiêu đề mục',
  },
  specials: {
    cover: 'Bìa',
    'font-files': 'Tệp phông chữ',
  },
  element: 'Phần tử',
  quote: (name) => `“${name}”`,
};
