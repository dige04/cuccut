import type { ModelSourceMessages } from './model-source-copy.ts';

export const vi: ModelSourceMessages = {
  label: "Nguồn tải xuống",
  fold: "Tải xuống và lưu trữ",
  custom: "Tùy chỉnh",
  isDefault: "Mặc định",
  msHint: "Thường nhanh hơn ở Trung Quốc đại lục",
  customHint: "Nhập URL gốc của mirror",
  hfDesc: "Tải xuống từ Hugging Face (huggingface.co).",
  msDesc: "Tải xuống từ ModelScope (modelscope.cn), thường nhanh hơn ở Trung Quốc đại lục.",
  customDesc: "Tải xuống từ mirror cung cấp tệp theo cùng đường dẫn với Hugging Face.",
  msNote: "Một vài tệp ModelScope không có (whisper.cpp, GPT-SoVITS) vẫn được tải từ Hugging Face. Mỗi tệp đều được đối chiếu với tổng kiểm tra tích hợp.",
  pending: (current: string) => `Lưu một địa chỉ để chuyển sang dùng nó. Hiện vẫn tải xuống từ ${current}.`,
  envNote: (name: string) => `Nếu đặt biến môi trường ${name}, giá trị đó được dùng thay thế.`,
  webNote: "Trình duyệt không thể đổi nguồn tải xuống. Hãy đặt mục này trong ứng dụng CucCut trên máy tính.",
  fieldLabel: "URL gốc của mirror",
  save: "Lưu",
  changed: (source: string) => `Đã đổi nguồn tải xuống thành ${source}`,
};
