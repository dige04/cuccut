import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const vi: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json phải chứa một đối tượng JSON',
  formatMissing: 'pack.json không có "format": "cuccut.pack", nên đây không phải gói CucCut',
  foreignFormat: 'Đây là gói agentcut: pack.json của nó không có trường "format". CucCut chỉ đọc các thư mục cuccut.pack',
  otherFormat: (p: { format: string }) => `pack.json ghi định dạng là "${p.format}", không phải "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Lược đồ gói ${p.schema} không được hỗ trợ; phiên bản CucCut này chỉ đọc lược đồ 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" không được hỗ trợ: gói trong phiên bản CucCut này không mang theo mã`,
  idChars: 'Id gói gồm chữ thường, chữ số và dấu gạch ngang đơn, và bắt đầu bằng một chữ cái',
  idReserved: (p: { id: string }) => `"${p.id}" là tên dành riêng và không thể dùng làm id gói`,
  versionChars: 'Phiên bản gồm chữ cái, chữ số, dấu chấm, dấu gạch ngang và dấu cộng',
  templateIdChars: 'Id mẫu gồm chữ thường, chữ số và dấu gạch ngang đơn, và bắt đầu bằng một chữ cái',
  ruleIdChars: 'Id quy tắc gồm chữ thường, chữ số và dấu gạch ngang đơn',
  duplicateTemplates: 'Cùng một mẫu được ghi tên hai lần',
  duplicateSkills: 'Cùng một kỹ năng được ghi tên hai lần',
  duplicateLibrary: 'Cùng một tệp thư viện được ghi tên hai lần',
  duplicateExamples: 'Cùng một tệp tham chiếu được ghi tên hai lần',
  duplicateQuickActions: 'Hai thao tác nhanh có cùng nhãn',
  duplicateRules: 'Cùng một quy tắc được ghi tên hai lần',
  duplicateFiles: 'Cùng một tệp được liệt kê hai lần trong files',
  libraryDir: (p: { dir: string }) => `Các tệp thư viện nằm trong ${p.dir}/`,
  libraryVoice: 'Giọng nói không thể được mang theo trong gói: giọng nói cần sự đồng ý của chủ sở hữu',
  examplesDir: (p: { dir: string }) => `Các tệp tham chiếu nằm trong ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Một tham chiếu ${p.kind} phải là một trong các định dạng ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Ảnh tĩnh phải là hình ảnh: ${p.extensions}`,
  styleFile: 'Hướng dẫn phong cách là tệp Markdown (.md) ở thư mục gốc của gói',
  reviewFile: 'Tiêu chuẩn đánh giá là tệp JSON ở thư mục gốc của gói',
  sha256Hex: 'sha256 gồm 64 chữ số thập lục phân viết thường',

  // Paths inside a pack
  pathRelative: 'Đường dẫn phải tương đối so với thư mục gói',
  pathHidden: 'Đường dẫn trong gói không thể trỏ tới tệp hoặc thư mục ẩn (bắt đầu bằng dấu chấm)',
  fileNotNamed: (p: { path: string }) => `${p.path} không được pack.json ghi tên`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Dài ${p.length} ký tự; hướng dẫn phong cách chỉ chứa tối đa ${p.limit}`,
  whyIgnoreInstructions: 'bảo agent bỏ qua chỉ dẫn của nó',
  whyChangeIdentity: 'cố thay đổi agent là ai',
  whyRevealSecrets: 'yêu cầu bí mật hoặc prompt',
  whyCredential: 'chứa thông tin xác thực',
  whyCommand: 'chứa lệnh cần chạy',
  whyDeleteWork: 'yêu cầu agent xóa công việc',
  whySendUrl: 'yêu cầu agent gửi thứ gì đó tới một địa chỉ web',
  whyPromptBoundary: 'bắt chước ranh giới của prompt',
};
