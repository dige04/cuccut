import type { RcPublishingMessages } from './rc-publishing.ts';

export const vi: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Chỉ chủ sở hữu mới làm được việc này, trong ứng dụng CucCut trên máy tính này.',
  desktopOnly: 'Ủy quyền, gửi bài, ghi lại kết quả và quản lý kết nối chỉ có trong ứng dụng CucCut trên máy tính này.',
  settingsOwnerOnly: 'Chỉ chủ sở hữu mới được đổi lịch đăng bài. Hãy nhờ họ đổi trong Cài đặt đăng bài.',
  transferNotAllowed: 'Nhập và xuất lịch có trong ứng dụng CucCut và dòng lệnh.',
  authorizationRequired: 'Chủ sở hữu phải ủy quyền đúng bài đăng này trong CucCut trước khi Agent có thể gửi.',
  // Publications.
  publicationArchived: 'Bài đăng này đã được lưu trữ. Hãy khôi phục trước khi sửa.',
  publicationLocked: 'Các đích đã gửi giữ nguyên nội dung chung. Hãy sửa đích bị lỗi hoặc chuẩn bị một phát hành mới.',
  destinationLocked: 'Việc đăng cho tài khoản này đã bắt đầu. Hãy rút lại hoặc ghi nhận kết quả trước khi thay đổi.',
  destinationKept: 'Đích đã gửi vẫn nằm trong bài đăng. Hãy rút lại hoặc ghi nhận kết quả trước khi xóa.',
  destinationAccountFixed: 'Để dùng tài khoản khác, hãy xóa đích này và thêm tài khoản đó.',
  destinationNotFound: 'Tài khoản này không còn thuộc bài đăng. Hãy tải lại và thử lại.',
  duplicateAccount: 'Mỗi tài khoản chỉ được chọn một lần.',
  duplicatePlacement: 'Giờ của mỗi tài khoản chỉ được chọn một lần.',
  afterExpiry: 'Hãy chọn một thời điểm trước khi bài đăng này hết hạn.',
  invalid: 'Bài đăng này chưa sẵn sàng. Hãy sửa các vấn đề được liệt kê, rồi thử lại.',
  nothingToSend: 'Mọi tài khoản của bài đăng này đã được gửi. Hãy chuẩn bị một phát hành mới để gửi lại.',
  slotTaken: (p: { account: string }) =>
    `Thời điểm này xung đột với một bài đăng khác của ${p.account}. Hãy chọn thời điểm khác, hoặc đặt khoảng cách giữa các bài ngắn hơn trong Cài đặt đăng bài.`,
  slotsHaveDestinationTimes: 'Một số bài đăng này có giờ riêng cho một tài khoản. Hãy xóa các giờ đó trước khi giữ chỗ giờ chung.',
  calendarRange: 'Hãy chọn khoảng lịch tối đa 93 ngày, với ngày bắt đầu trước ngày kết thúc.',
  archiveInFlight: 'Hãy rút lại các lần gửi đang chờ hoặc ghi nhận kết quả của chúng trước khi lưu trữ bài đăng này.',
  // Delivery.
  providerUnsupported: 'Phiên bản CucCut này chỉ đăng bài thủ công. Hãy chọn Tự đăng cho kết nối này.',
  notWaiting: 'Chỉ có thể rút lại tài khoản đang chờ bạn.',
  cancelNotAllowed: 'Chỉ có thể hủy tài khoản chưa được gửi. Hãy rút lại, hoặc ghi nhận kết quả trước.',
  reconcileFinal: 'Lần đăng đã xuất bản hoặc đã hủy là một phần của lịch sử. Hãy chuẩn bị một phát hành mới thay vì sửa nó.',
  reconcileSending: 'Hãy chờ lần gửi hiện tại hoàn tất trước khi ghi nhận kết quả.',
  reconcileFutureTime: 'Nhập thời gian trong tương lai mà mạng hiển thị cho bài đăng này.',
  // Pinned exports.
  exportRequired: 'Hãy kết xuất và ghim video trước.',
  exportChanged: 'Bản xuất đã duyệt đã thay đổi. Hãy ghim một bản xuất đã xác minh trước khi đăng.',
  exportStale: 'Hãy xuất phiên bản hiện tại trước khi ghim, hoặc chọn Kết xuất và ghim.',
  exportNotFinished: 'Bản xuất này chưa hoàn tất. Hãy chờ hoặc chọn bản xuất khác.',
  exportNotVideo: 'Hãy chọn bản xuất MP4 đã hoàn tất của toàn bộ video.',
  exportOtherVideo: 'Bản xuất này thuộc video hoặc chuỗi khác. Hãy chọn bản xuất của video này.',
  exportFileMissing: 'Tệp đã xuất không còn trên máy tính này. Hãy kết xuất và ghim lại video.',
  exportFileChanged: 'Tệp đã xuất đã thay đổi sau khi được kết xuất. Hãy kết xuất và ghim lại video.',
  pinLocked: 'Các đích đã gửi giữ nguyên bản xuất đã ghim. Hãy chuẩn bị một phát hành mới để dùng bản xuất khác.',
  renderFailed: 'Bản xuất của bài đăng này chưa hoàn tất. Hãy kết xuất và ghim lại.',
  renderCancelled: 'Bản xuất của bài đăng này đã bị hủy. Hãy kết xuất và ghim lại khi bạn sẵn sàng.',
  videoNotFound: 'Video này không có trên máy tính này. Hãy mở dự án của nó rồi thử lại.',
  // Settings, connections and accounts.
  accountNotFound: 'Tài khoản này không còn tồn tại. Hãy tải lại Cài đặt đăng bài rồi thử lại.',
  connectionNotFound: 'Kết nối này không còn tồn tại. Hãy tải lại Cài đặt đăng bài rồi thử lại.',
  defaultAccountMissing: 'Một tài khoản mặc định không còn tồn tại. Hãy chọn lại các tài khoản mặc định.',
  connectionProviderFixed: 'Kết nối giữ tuyến đã được thêm cùng nó. Hãy thêm kết nối mới để đăng theo cách khác.',
  accountIdentityFixed: 'Tài khoản giữ kết nối và mạng của nó. Hãy thêm một tài khoản mới.',
  accountDuplicate: 'Tài khoản này đã được thêm vào kết nối này.',
  accountInUse: (p: { name: string }) =>
    `${p.name} có một bài đăng đang chờ, đã lên lịch hoặc chưa được xác nhận. Hãy ghi nhận kết quả của nó trước khi xóa tài khoản.`,
  linkInvalid: 'Hãy chọn một tài khoản khác trên cùng mạng và chưa được liên kết.',
  linkCanonical: 'Các tài khoản khác đang liên kết với tài khoản này. Hãy liên kết tuyến kia với tài khoản này thay thế.',
  // Copy proposals.
  proposalReason: 'Bản nháp dựa trên video, bản chép lời và hướng dẫn viết của bạn. Hãy xem lại trước khi áp dụng.',
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'Đăng bài CucCut',
  // Calendar transfer and cleanup.
  backupFailed: 'Không thể ghi bản sao lưu dữ liệu đăng bài, nên chưa nhập gì. Hãy kiểm tra ổ đĩa rồi thử lại.',
};
