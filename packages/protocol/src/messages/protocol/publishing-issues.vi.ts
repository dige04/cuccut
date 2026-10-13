import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const vi: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Hãy duyệt bản xuất đã ghim trước khi đăng.',
  exportRequired: 'Hãy kết xuất và ghim video để đăng.',
  accountsRequired: 'Hãy chọn ít nhất một tài khoản.',
  timezoneInvalid: 'Hãy chọn một múi giờ hợp lệ.',
  accountUnavailable: 'Tài khoản này không còn khả dụng. Hãy kết nối lại hoặc chọn tài khoản khác.',
  accountDuplicateRoute: 'Cùng một tài khoản đang được chọn qua hai tuyến. Hãy chọn một tuyến.',
  accountNotConnected: 'Hãy kết nối tài khoản này trong Cài đặt đăng bài trước khi gửi.',
  formatMismatch: 'Định dạng này không khớp với mạng của tài khoản. Hãy chọn định dạng khác.',
  descriptionRequired: 'Hãy viết mô tả cho tài khoản này.',
  titleLength: (p: { max: number }) => `YouTube yêu cầu tiêu đề từ 1 đến ${p.max} ký tự.`,
  audienceRequired: 'Hãy chọn video YouTube này có dành cho trẻ em hay không.',
  tagsTooLong: (p: { max: number }) => `Giữ thẻ YouTube trong ${p.max} ký tự, nếu không YouTube có thể bỏ qua chúng.`,
  shortTooLong: 'YouTube Shorts tối đa ba phút. Hãy chọn Video YouTube hoặc rút ngắn bản xuất.',
  shortsClassification: 'YouTube coi video vuông hoặc dọc tối đa ba phút là Shorts. Hãy chọn YouTube Short cho bản xuất này.',
  portraitRequired: 'Định dạng này cần bản xuất dọc hoặc vuông. Hãy kết xuất phiên bản dọc hoặc chọn định dạng khác.',
  captionTooLong: (p: { length: number; max: number }) => `Mô tả và hashtag dài ${p.length} ký tự; mạng này cho phép ${p.max}. Hãy rút ngắn.`,
  timeInPast: 'Thời điểm này đã qua. Hãy chọn thời điểm trong tương lai, hoặc xóa để gửi ngay.',
  expiresBefore: 'Bài đăng này hết hạn trước khi lên sóng. Hãy chọn giờ sớm hơn hoặc hạn dùng muộn hơn.',
  deliveryUnsettled:
    'Một phát hành khác của video này tới tài khoản này vẫn đang chờ hoặc chưa được xác nhận. Hãy ghi lại kết quả trước khi gửi lại.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'Quyền hiển thị không liệt kê chỉ có trên YouTube.',
  optionTagsYoutubeOnly: 'Thẻ chỉ có trên YouTube. Hãy đặt hashtag vào mô tả thay thế.',
  optionPhoneYoutubeTags: 'Tuyến điện thoại không thể đặt thẻ YouTube. Hãy xóa chúng hoặc chọn tuyến khác.',
  optionPostbridgeYoutubeAudience:
    'Postbridge không thể đặt đối tượng hoặc quyền hiển thị của YouTube. Hãy chấp nhận cài đặt đã cấu hình trong Postbridge, hoặc chọn tuyến khác.',
  optionPostgunSynthetic: 'Postgun không thể thêm thông báo nội dung media tổng hợp của YouTube. Hãy chọn tuyến khác.',
  optionYoutubeApiInteractions: 'Tuyến này không thể áp dụng các tùy chọn tương tác hoặc hợp tác YouTube đã chọn.',
  optionInstagramApi: 'Tuyến này không thể áp dụng các tùy chọn hiển thị, công bố hoặc tương tác Instagram đã chọn.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Hãy nhập ngày và giờ hợp lệ.',
  timeRequired: 'Hãy chọn ngày và giờ.',
  timeGap: (p: { timezone: string }) => `Thời điểm này không tồn tại ở ${p.timezone} vì đồng hồ được chỉnh. Hãy chọn thời điểm khác.`,
  timeFold: (p: { timezone: string }) =>
    `Thời điểm này xuất hiện hai lần ở ${p.timezone} vì đồng hồ được chỉnh. Hãy nhập mốc thời gian chính xác kèm độ lệch UTC.`,
  timestampInvalid: 'Hãy nhập mốc thời gian kèm độ lệch UTC, ví dụ 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Không có khung giờ trống nào trước khi hết hạn. Hãy kiểm tra các tài khoản, giờ hằng tuần và khoảng cách.',
  destinationMissing: 'Tài khoản này không còn thuộc bài đăng. Hãy tải lại và thử lại.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Hãy chọn tệp lịch CucCut (JSON) được xuất từ phiên bản được hỗ trợ.',
  archiveDuplicatePublications: 'Tệp lịch liệt kê một bài đăng hai lần. Hãy xuất lại từ máy tính gốc.',
  archiveDuplicateAccounts: 'Tệp lịch liệt kê một tài khoản hai lần. Hãy xuất lại từ máy tính gốc.',
  archiveDuplicateConnections: 'Tệp lịch liệt kê một kết nối hai lần. Hãy xuất lại từ máy tính gốc.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `“${p.label}” liệt kê cùng một tài khoản hai lần trong tệp lịch. Hãy xuất lại từ máy tính gốc.`,
  archiveTimezone: (p: { timezone: string }) => `Tệp lịch dùng múi giờ không xác định (${p.timezone}). Hãy xuất lại từ máy tính gốc.`,
  archiveMissingConnection: (p: { name: string }) => `Tệp lịch thiếu kết nối của “${p.name}”.`,
  archiveLinkedAccount: (p: { name: string }) => `Tài khoản được liên kết của “${p.name}” trong tệp lịch không hợp lệ.`,
  archiveMissingAccount: (p: { label: string }) => `Tệp lịch thiếu một tài khoản mà “${p.label}” đang dùng.`,
  archiveInvalidDate: (p: { label: string }) => `Tệp lịch có ngày không hợp lệ cho “${p.label}”.`,
  importConnectionConflict: (p: { name: string }) => `Kết nối “${p.name}” trong tệp lịch xung đột với một kết nối trên máy tính này.`,
  importAccountConflict: (p: { name: string }) => `Tài khoản “${p.name}” trong tệp lịch xung đột với một tài khoản trên máy tính này.`,
  importedInFlight: 'Đã nhập khi đang gửi bài. Hãy kiểm tra kết quả trong ứng dụng của mạng đó và ghi lại trước khi gửi lại.',
};
