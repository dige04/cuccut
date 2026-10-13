import type { RcProfileMessages } from './rc-profile.ts';

export const vi: RcProfileMessages = {
  readOnly: 'Hồ sơ được lưu bởi phiên bản CucCut mới hơn, nên chỉ hiển thị ở đây và không thể thay đổi',
  projectNotFound: 'Không tìm thấy dự án',
  projectUnavailable: 'Thư mục dự án bị thiếu hoặc không ghi được, nên không lưu được quy tắc và tùy chọn của dự án',
  projectTextOnly: 'Dự án chỉ có một đoạn tùy chọn, được đặt là “của riêng”. Phần phỏng vấn chỉ tồn tại ở cấp không gian làm việc',
  noAnswers: 'Hãy trả lời ít nhất một câu hỏi, hoặc bỏ qua.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Tên từ phỏng vấn',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `Quy tắc chưa được lưu: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Không tìm thấy quy tắc: ${p.id}`,
  ruleOrder: 'Thứ tự mới phải liệt kê mỗi quy tắc ở cấp này đúng một lần',
  ruleLimit: (p: { limit: number }) => `Một cấp chứa tối đa ${p.limit} quy tắc`,
  templateMissing: (p: { id: string }) => `Mẫu “${p.id}” chưa được cài. Quy tắc đã được lưu; Agent sẽ bỏ qua mẫu này cho đến khi mẫu được cài`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Tên quy tắc',
  fieldWhen: 'Khi',
  fieldInstruction: 'Hướng dẫn',
  fieldTemplate: 'Mẫu',
  fieldNote: 'Ghi chú',
  fieldOrder: 'Thứ tự',
  required: 'bắt buộc',
  tooLong: (p: { limit: number }) => `dài hơn ${p.limit} ký tự`,
  badId: 'dùng chữ thường, chữ số và dấu gạch ngang, bắt đầu bằng chữ cái hoặc chữ số, tối đa 64 ký tự',
  badTemplateId: 'không phải mã mẫu hợp lệ (chữ thường và chữ số, nối bằng một dấu gạch ngang)',
  badOrder: 'phải là một số nguyên',
  needInstructionOrTemplate: 'hãy nhập một hướng dẫn, hoặc chọn một mẫu',

  // A write from the answers (profile-writer)
  writeBusy: 'Tùy chọn đang được viết từ các câu trả lời. Hãy đợi lần viết đó xong',
  writeStopped: 'CucCut đang đóng, nên tùy chọn chưa được viết. Các câu trả lời của bạn đã được lưu',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Phiên này không thuộc dự án nào nên không có cấp dự án. Hãy dùng cấp workspace, hoặc mở phiên trong dự án',
  levelWorkspace: 'cho mọi dự án',
  levelProject: (p: { name: string }) => `cho dự án ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Lưu câu trả lời phỏng vấn: ${p.questions}`,
  toolSkipSummary: 'Bỏ qua phỏng vấn (các câu trả lời được giữ lại)',
  toolWriteSummary: 'Viết tùy chọn của bạn từ các câu trả lời phỏng vấn',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Thêm vào tùy chọn của bạn ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Thay tùy chọn của bạn ${p.where} bằng: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Lưu quy tắc “${p.name}” ${p.where}: khi ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `dùng mẫu ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Xóa quy tắc “${p.name}” ${p.where}`,
};
