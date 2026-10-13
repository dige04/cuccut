import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const vi: ReviewMetricsMessages = {
  metrics: {
    'video.durationSec': { label: 'Độ dài', what: 'Video hoàn chỉnh kéo dài bao lâu.' },
    'video.shortSidePx': { label: 'Cạnh ngắn', what: 'Cạnh ngắn của khung làm việc, tính bằng pixel.' },
    'video.shots': { label: 'Cảnh quay', what: 'Các clip video và ảnh trên track chính.' },
    'video.cutsPerMin': { label: 'Số lần cắt mỗi phút', what: 'Track chính chuyển sang clip tiếp theo thường xuyên đến mức nào.' },
    'video.longestShotSec': { label: 'Cảnh quay dài nhất', what: 'Clip dài nhất trên track chính.' },
    'video.longestBlankSec': { label: 'Khoảng trống dài nhất', what: 'Quãng dài nhất mà trên màn hình không có gì cả.' },
    'captions.on': { label: 'Có phụ đề', what: 'Video có hiển thị phụ đề hay không.' },
    'captions.wordsPerSec': { label: 'Số từ phụ đề mỗi giây', what: 'Phụ đề đòi người xem đọc nhanh đến mức nào.' },
    'hook.present': { label: 'Câu mở đầu', what: 'Một câu mở đầu: câu mà short được cắt theo, hoặc chữ bắt đầu trong 2 giây đầu.' },
    'hook.words': { label: 'Số từ câu mở đầu', what: 'Câu mở đầu có bao nhiêu từ.' },
    'text.offCanvas': { label: 'Chữ tràn ra ngoài mép', what: 'Một khung chữ có chạy quá mép trái hoặc mép phải của khung hình hay không.' },
    'items.placeholders': { label: 'Khung giữ chỗ', what: 'Các khung giữ chỗ vẫn đang chờ phương tiện.' },
    'transitions.count': { label: 'Chuyển cảnh', what: 'Số chuyển cảnh giữa các clip.' },
    'layers.max': { label: 'Lớp thêm', what: 'Số track hình đang dùng ngoài track đầu tiên; 0 là chỉ một track.' },
    'export.durationSec': { label: 'Độ dài khi xuất', what: 'Tệp đã xuất kéo dài bao lâu.' },
    'export.width': { label: 'Chiều rộng khi xuất', what: 'Chiều rộng của hình ảnh đã xuất, tính bằng pixel.' },
    'export.height': { label: 'Chiều cao khi xuất', what: 'Chiều cao của hình ảnh đã xuất, tính bằng pixel.' },
    'export.loudnessLufs': { label: 'Độ to', what: 'Độ to của bản xuất sau khi chuẩn hóa; chỉ đọc khi đã chuẩn hóa.' },
    'export.truePeakDb': { label: 'Đỉnh thực', what: 'Đỉnh âm lớn nhất của bản xuất sau khi chuẩn hóa; chỉ đọc khi đã chuẩn hóa.' },
  },
};
