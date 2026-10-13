import type { RcPacksMessages } from './rc-packs.ts';

/** Vietnamese. */
export const vi: RcPacksMessages = {
  // One per error code
  packNotFound: (p: { id: string }) => `Không có gì được cài tên là "${p.id}"`,
  sourceNotFound: (p: { source: string }) => `Không có gì để đọc tại ${p.source}`,
  urlInvalid: (p: { issue: string }) => `Đây không phải địa chỉ mà gói có thể được đọc từ đó: ${p.issue}`,
  invalid: (p: { issue: string }) => `Đây không phải gói có thể cài đặt: ${p.issue}`,
  unsupportedSchema: (p: { issue: string }) => `Gói này được viết cho phiên bản CucCut mới hơn: ${p.issue}`,
  foreignFormat: (p: { issue: string }) => `Không thể đọc gói này ở đây: ${p.issue}`,
  unsupportedField: (p: { issue: string }) => `Không thể cài gói này: ${p.issue}`,
  tooLarge: (p: { files: number; bytes: number; maxFiles: number; maxBytes: number }) =>
    `Gói này có ${p.files} tệp, tổng ${p.bytes} byte; một gói chứa tối đa ${p.maxFiles} tệp và ${p.maxBytes} byte`,
  idReserved: (p: { issue: string }) => `Không thể cài gói này: ${p.issue}`,
  blocked: (p: { file: string; line: number; why: string; text: string }) =>
    `Gói này sẽ không được cài: dòng ${p.line} của ${p.file} ${p.why} ("${p.text}")`,
  styleTooLong: (p: { length: number; limit: number }) => `Hướng dẫn phong cách dài ${p.length} ký tự; nó chứa tối đa ${p.limit}`,
  previewExpired: 'Bản xem trước này đã hơn 30 phút tuổi. Hãy đọc lại',
  restoreConflict: (p: { id: string }) => `"${p.id}" đã được cài lại trong lúc đó, nên bản đã xóa không thể trở lại`,
  restoreReplacedConflict: (p: { id: string }) => `"${p.id}" đã thay đổi sau khi cài, nên bản trước của bạn không thể quay lại đè lên nó`,
  trashExpired: 'Gói đã xóa không còn được giữ lại nên không thể trở lại',
  exportTargetNotEmpty: 'Thư mục đó có tệp khác. Hãy chọn một thư mục trống',
  styleChanged: 'Hướng dẫn phong cách đã thay đổi kể từ khi bạn mở nó. Hãy mở lại và làm lại thay đổi của bạn',
  offlineStrict: 'Gói không được đọc từ mạng ở chế độ ngoại tuyến nghiêm ngặt',
  network: (p: { issue: string }) => `Không đọc được gói: ${p.issue}`,

  // Where a pack is read from (pack-source)
  sourceEmpty: 'Hãy nhập một thư mục, một địa chỉ GitHub hoặc một địa chỉ https://',
  sourceRelative: 'Hãy nhập đường dẫn đầy đủ của thư mục',
  urlNotHttps: 'Địa chỉ web phải bắt đầu bằng https://',
  urlCredentials: 'Địa chỉ web không thể chứa tên người dùng hoặc mật khẩu',
  urlBadForm: 'Không đọc được địa chỉ web đó',
  folderNotFound: (p: { path: string }) => `Không tìm thấy thư mục: ${p.path}`,
  noManifest: (p: { source: string }) => `${p.source} không có pack.json, nên đây không phải gói`,
  folderOverlapsPacks: 'Thư mục này nằm trong (hoặc chứa) thư mục packs của CucCut, nên không thể đọc như một gói',
  noSymlinks: (p: { path: string }) => `Không cho phép liên kết tượng trưng: ${p.path}`,
  notRegularFile: (p: { path: string }) => `Không phải tệp thông thường: ${p.path}`,
  pathTooLong: (p: { path: string }) => `Đường dẫn quá dài: ${p.path}…`,
  cannotRead: (p: { path: string; code: string }) => `Không đọc được ${p.path} (${p.code})`,
  manifestTooLarge: (p: { limit: number }) => `pack.json lớn hơn ${p.limit} byte`,
  manifestNotUtf8: 'pack.json không phải UTF-8 hợp lệ',
  manifestNotJson: 'pack.json không phải JSON hợp lệ',
  manifestIssue: (p: { path: string; message: string }) => `${p.path}: ${p.message}`,
  filesIndexRequired: 'Gói được phục vụ từ địa chỉ web phải liệt kê mọi tệp trong pack.json ("files"); lệnh xuất sẽ ghi danh sách đó',
  fileUnnamed: (p: { path: string }) => `${p.path} không được pack.json đặt tên; hãy xóa nó hoặc đặt tên trong đó`,
  fileMissing: (p: { path: string }) => `${p.path} được pack.json đặt tên nhưng không có trong gói`,
  fileMismatch: (p: { path: string }) => `${p.path} không khớp với danh sách files trong pack.json (kích thước hoặc sha256 khác)`,
  fileUnlisted: (p: { path: string }) => `${p.path} không có trong danh sách files của pack.json`,
  itemDirMissing: (p: { path: string }) => `${p.path}/ được pack.json đặt tên nhưng không có trong gói`,

  // Downloads (https:// and GitHub)
  whatManifest: 'pack.json',
  httpUnreachable: (p: { url: string }) => `Không kết nối được tới ${p.url}`,
  httpTimeout: (p: { url: string }) => `Hết thời gian chờ khi đọc ${p.url}`,
  httpStatus: (p: { url: string; status: number }) => `${p.url} trả về HTTP ${p.status}`,
  httpNotFound: (p: { url: string }) => `${p.url} không tồn tại (HTTP 404)`,
  httpRedirectedAway: (p: { url: string }) => `${p.url} chuyển hướng tới một địa chỉ không phải https://`,
  httpConnectionLost: (p: { url: string }) => `Kết nối bị ngắt khi đọc ${p.url}`,
  httpTooLarge: (p: { url: string; limit: number }) => `${p.url} lớn hơn ${p.limit} byte`,
  githubNotPack: (p: { issue: string }) => `Thư mục GitHub này không phải gói có thể cài đặt: ${p.issue}`,
  githubTooLarge: (p: { files: number; bytes: number; maxFiles: number; maxBytes: number }) =>
    `Thư mục GitHub này có ${p.files} tệp, tổng ${p.bytes} byte; một gói chứa tối đa ${p.maxFiles} tệp và ${p.maxBytes} byte`,
  githubTruncated: (p: { limit: number }) => `Thư mục này có quá nhiều mục để GitHub liệt kê đầy đủ; một gói chứa tối đa ${p.limit} tệp`,
  githubDownloadTooLarge: (p: { what: string; limit: number }) =>
    `${p.what} lớn hơn ${p.limit} byte (lớn hơn mức GitHub đã liệt kê, hoặc gói vượt giới hạn kích thước)`,

  // Inspect (pack-inspect)
  itemInvalid: (p: { path: string; issue: string }) => `${p.path}: ${p.issue}`,
  skillIdMismatch: (p: { id: string; normalized: string }) => `Thư mục kỹ năng "${p.id}" sẽ được đọc là "${p.normalized}"; hãy đặt tên theo id của nó`,
  skillTooLarge: (p: { bytes: number; limit: number }) => `Kỹ năng có ${p.bytes} byte; một kỹ năng chứa tối đa ${p.limit}`,
  libraryUnreadable: (p: { path: string; issue: string }) => `${p.path} không thể đưa vào thư viện: ${p.issue}`,
  libraryVoice: (p: { path: string }) => `${p.path} là một giọng nói; giọng nói cần sự đồng ý của chủ sở hữu, và không thể mang theo trong gói`,
  styleNotText: (p: { file: string }) => `${p.file} không phải văn bản UTF-8`,

  // Installed packs (pack-registry)
  recordUnreadable: 'Thư mục gói này không đọc được nên không được liệt kê',
  recordMissing: (p: { file: string }) => `Thiếu ${p.file}`,
  recordNotJson: (p: { file: string }) => `${p.file} không đọc được như JSON`,
  recordIdMismatch: (p: { id: string; dir: string }) => `Bản ghi ghi tên gói là "${p.id}", nhưng thư mục của nó tên là "${p.dir}"`,

  // Style guides (pack-style)
  chooseStyleSummary: (p: { pack: string }) => `Dùng hướng dẫn phong cách của gói "${p.pack}" trong dự án này`,
  chooseStyleNone: 'Không dùng hướng dẫn phong cách nào trong dự án này',
  chooseStyleAuto: 'Để CucCut quyết định dự án này dùng hướng dẫn phong cách nào',

  // Export (pack-export)
  exportBuiltinTemplate: (p: { id: string }) => `"${p.id}" là một mẫu có sẵn; mẫu có sẵn đã có trên mọi máy tính`,
  exportBuiltinSkill: (p: { id: string }) => `"${p.id}" là một kỹ năng có sẵn; kỹ năng có sẵn đã có trên mọi máy tính`,
  exportTargetInHome: 'Thư mục đó nằm trong thư mục mẫu, kỹ năng hoặc packs của CucCut. Hãy chọn một thư mục nằm ngoài đó',

  // Reference files (pack-examples)
  exampleNotFound: (p: { file: string; pack: string }) => `Gói "${p.pack}" không có tệp tham chiếu ${p.file}`,
  exampleUnsupported: (p: { file: string; extensions: string }) => `${p.file} không phải hình ảnh hoặc video mà gói có thể mang theo (${p.extensions})`,
  exampleLimit: (p: { limit: number }) => `Một gói chứa tối đa ${p.limit} tệp tham chiếu; hãy xóa một tệp trước`,
  exampleTooLarge: (p: { bytes: number; limit: number }) => `Với tệp này, gói sẽ chứa ${p.bytes} byte; một gói chứa tối đa ${p.limit}`,
  exampleNameTaken: (p: { file: string }) => `${p.file} đã được thêm lại trong lúc đó, nên bản đã xóa không thể trở lại`,
};
