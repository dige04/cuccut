import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const vi: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Video này chưa đạt tiêu chuẩn của bạn: ${p.count} ${s(p.count, 'phát hiện', 'phát hiện')} sẽ chặn việc xuất này`,
  blockedRemedy: 'Sửa các mục được liệt kê rồi xuất lại, hoặc mở phần kiểm duyệt và chấp nhận một phát hiện kèm lý do.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} là ${p.value}, còn tiêu chuẩn yêu cầu ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `ít nhất ${p.min}`,
  limitAtMost: (p: { max: number }) => `tối đa ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `từ ${p.min} đến ${p.max}`,
  limitYes: 'có',
  limitNo: 'không',
  limitAny: 'bất kỳ',
  valueYes: 'có',
  valueNo: 'không',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Hãy nêu lý do: chấp nhận giữ nguyên một phát hiện hoặc hạ mức độ của nó cần có lý do',
  reasonTooLong: (p: { limit: number }) => `Giữ lý do dưới ${p.limit} ký tự`,
  unknownFinding: (p: { id: string }) => `Tiêu chuẩn của video này không có mục kiểm hay câu hỏi nào tên “${p.id}”`,
  criteriaInvalid: 'Tiêu chuẩn còn lỗi cần sửa trước khi có thể lưu',
  criteriaConflict: 'Tiêu chuẩn đã được thay đổi ở nơi khác; hãy đọc lại và thử lại',
  answersInvalid: 'Các câu trả lời không đúng định dạng: mỗi câu hỏi một mục, gồm kết quả và bằng chứng',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Quyết định kiểm duyệt',
  waiveLabel: (p: { id: string }) => `Chấp nhận giữ nguyên “${p.id}”`,
  unwaiveLabel: (p: { id: string }) => `Kiểm lại “${p.id}” theo tiêu chuẩn`,
  severityLabel: (p: { id: string }) => `Đổi mức độ của “${p.id}”`,
  severityCritical: 'nghiêm trọng',
  severitySuggestion: 'gợi ý',
  severityNitpick: 'lỗi nhỏ',
  planProtected: 'Quyết định kiểm duyệt chỉ thay đổi qua phần kiểm duyệt: chấp nhận, giữ lại hoặc đổi mức độ của một phát hiện ở đó',

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Bạn chưa đặt tiêu chuẩn, nên đây là các mục kiểm có sẵn.',
  reasonUser: 'Được kiểm theo tiêu chuẩn của bạn (Cài đặt › Kiểm duyệt).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'Phần kiểm duyệt chưa đến được câu hỏi này.',
  evidenceMissing: 'Trả lời “đạt” nhưng không có gì để xem.',
  evidenceInvalid: (p: { kind: string }) => {
    switch (p.kind) {
      case 'timestamp':
        return 'Trả lời “đạt”, nhưng bằng chứng không phải một thời điểm trong video.';
      case 'frame':
        return 'Trả lời “đạt”, nhưng bằng chứng không phải một khung hình lấy từ video này.';
      case 'field':
        return 'Trả lời “đạt”, nhưng bằng chứng không nêu tên thứ gì trong video này.';
      case 'quote':
        return 'Trả lời “đạt”, nhưng trích dẫn không có trong lời thoại hoặc phụ đề của video này.';
      default:
        return 'Trả lời “đạt”, nhưng không thể kiểm tra bằng chứng.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Điền đầy hoặc xóa các khung giữ chỗ trước khi giao.',
  builtinFixBlank: 'Che hoặc lấp khoảng trống nơi không có gì trên màn hình.',
  builtinFixTextEdge: 'Dời hoặc thu hẹp chữ để nó nằm trong khung hình.',
};
