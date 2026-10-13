import type { RailMessages } from './rail-copy.ts';

export const vi: RailMessages = {
  running: (n: number) => `${n} đang chạy`,
  finished: (n: number) => `${n} đã xong`,
  nothingYet: 'Chưa có gì',
  tasksBlurb: 'Chép lời, dịch, xuất video và việc của các agent đều nằm trong một danh sách. Mở một tác vụ để xem các bước và kết quả.',
  toolCount: (n: number) => `${n} công cụ`,
  moreFinished: (n: number) => `Còn ${n} tác vụ nữa trong Tất cả tác vụ`,
};
