import type { ProfileMessages } from './profile-copy.ts';

export const vi: ProfileMessages = {
  help: `Cách dùng:
  cuccut profile show [--project <id>]
                                   CucCut biết gì về bạn: phỏng vấn, tùy chọn, quy tắc
                                   và tên cần viết đúng; khi có dự án (--project, hoặc dự án của
                                   thư mục hiện tại), cũng gồm tùy chọn và quy tắc của dự án đó
  cuccut profile answers set <question> <text>
                                   Lưu một câu trả lời phỏng vấn (who, record, platforms, annoys, names);
                                   văn bản rỗng sẽ xóa câu trả lời
  cuccut profile interview skip|reopen|write
                                   Bỏ qua phỏng vấn, mở lại, hoặc viết tùy chọn từ các câu trả lời
                                   bằng Agent mặc định (không có Agent thì câu trả lời giữ nguyên như đã nhập)
  cuccut profile preferences [--project <id>] --file <md>
                                   Thay tùy chọn của bạn, hoặc của dự án, bằng một tệp Markdown
                                   (--file - đọc từ đầu vào chuẩn); phần do phỏng vấn viết được giữ lại
  cuccut profile rules list [--project <id>]
                                   Quy tắc của bạn (hoặc của dự án) theo thứ tự được đọc
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Quy tắc được đọc theo thứ tự; khi hai quy tắc mâu thuẫn, quy tắc sau thắng
Agent đọc hồ sơ khi một phiên bắt đầu; các phiên đang mở giữ những gì chúng đã có.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Không phải câu hỏi phỏng vấn: ${value} (hãy dùng một trong: ${ids})`,
  needFile: 'Hãy cung cấp tùy chọn dưới dạng tệp Markdown: --file <md>, hoặc --file - để đọc từ đầu vào chuẩn',
  badMove: (value: string) => `Hãy chuyển quy tắc lên, xuống hoặc đến một vị trí (1 là đầu tiên): ${value}`,
  ruleMissing: (id: string) => `Không có quy tắc ${id} ở cấp này (xem cuccut profile rules list)`,
  projectMissing: (id: string) => `Không có dự án ${id} (xem cuccut projects list)`,
  stdinPrompt: 'Gõ hoặc dán tùy chọn, rồi nhấn Ctrl-D:',

  // show
  questionWho: 'Bạn làm gì, và làm cho ai?',
  questionRecord: 'Bạn thường quay gì?',
  questionPlatforms: 'Video đăng ở đâu, và nên dài bao lâu?',
  questionAnnoys: 'Điều gì ở video hiện tại khiến bạn khó chịu?',
  questionNames: 'Những tên cần viết đúng',
  interviewLine: (status: string, answered: number, total: number) => `Phỏng vấn: ${status}, đã trả lời ${answered} trên ${total}`,
  statusPending: 'chưa làm',
  statusSkipped: 'đã bỏ qua',
  statusDone: 'đã xong',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Tùy chọn của bạn',
  interviewHeading: 'Phần do phỏng vấn viết',
  projectHeading: (name: string) => `Tùy chọn cho ${name}`,
  noText: '  (không có)',
  rulesHeading: 'Quy tắc',
  projectRulesHeading: (name: string) => `Quy tắc cho ${name}`,
  noRules: '  Chưa có quy tắc nào',
  namesLine: (names: string) => `Tên cần viết đúng: ${names}`,
  readOnly: 'Hồ sơ được lưu bởi phiên bản CucCut mới hơn: có thể xem, nhưng không thể thay đổi',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (tắt)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Khi: ${when}`,
  ruleDo: (instruction: string) => `   Làm: ${instruction}`,
  ruleTemplate: (id: string) => `   Mẫu: ${id}`,
  stageAny: 'chọn và chỉnh sửa',
  stageClip: 'chọn clip',
  stageEdit: 'chỉnh sửa',
  ruleEnabled: (name: string) => `Đã bật: ${name}`,
  ruleDisabled: (name: string) => `Đã tắt: ${name}`,
  ruleRemoved: (name: string, id: string) => `Đã xóa ${name} (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `Đã chuyển ${name} đến vị trí ${position} trên ${total}`,

  // Writes
  answerSaved: (question: string) => `Đã lưu câu trả lời cho “${question}”`,
  answerCleared: (question: string) => `Đã xóa câu trả lời cho “${question}”`,
  interviewSkipped: 'Đã bỏ qua phỏng vấn; các câu trả lời được giữ lại',
  interviewReopened: 'Phỏng vấn đã mở lại, với các câu trả lời trước đó',
  writing: 'Đang viết tùy chọn từ các câu trả lời. Việc này mất một chút thời gian…',
  writtenByAgent: 'Đã viết tùy chọn từ câu trả lời của bạn:',
  keptAsTyped: (reason: string) => `Các câu trả lời được giữ nguyên như đã nhập (${reason}):`,
  reasonNoAgent: 'chưa cài đặt và đăng nhập Agent nào',
  reasonAgentFailed: 'lượt chạy của Agent chưa hoàn tất',
  reasonBadOutput: 'kết quả của Agent không dùng được',
  namesAdded: (names: string) => `Đã thêm tên vào bảng thuật ngữ: ${names}`,
  preferencesSaved: (chars: number) => `Đã lưu tùy chọn của bạn (${chars} ký tự)`,
  projectPreferencesSaved: (name: string, chars: number) => `Đã lưu tùy chọn cho ${name} (${chars} ký tự)`,
  takesEffect: 'Agent đọc mục này khi một phiên bắt đầu; các phiên đang mở giữ những gì chúng đã có',
};
