import type { TranscriptMessages, TranscriptToolsMessages } from './transcript-copy.ts';


function secondsLabel(seconds: number): string { return seconds < 10 ? `${(Math.round(seconds * 10) / 10).toFixed(1).replace('.', ',')} giây` : `${Math.round(seconds)} giây`; }

export const viSeconds = secondsLabel;

export const viTranscript: TranscriptMessages = {
  title: "Bản chép lời",
  modes: "Chế độ sửa bản chép lời",
  modeEdit: "Chỉnh sửa văn bản",
  modeCut: "Cắt tư liệu",

  hintEdit: "Chỉ đổi văn bản chép lời; giữ video và âm thanh. Nhấp đúp từ để sửa; ⌫ chỉ xóa chữ.",
  hintCut: "Chọn chữ và nhấn ⌫ để cắt cả video, âm thanh và phụ đề. Từ cắt giữ gạch ngang, có thể khôi phục.",

  emptyTitle: "Chưa có bản chép lời",
  emptyNoMedia: "Thêm video hoặc âm thanh trước. Chép lời xong, lời nói sẽ hiện ở đây.",
  emptyNotPlaced: "Video hoặc âm thanh chưa có trên dòng thời gian. Hãy đặt lên đó rồi chép lời để bản chép lời hiện ở đây.",
  emptyNotTranscribed: "Các tư liệu trên dòng thời gian chưa được chép lời. Hãy chép lời trong bảng Phụ đề để bản chép lời hiện ở đây.",
  gotoSubtitle: "Chép lời trong Phụ đề",
  addMedia: "Thêm nội dung",
  loading: "Đang tải bản chép lời…",
  noWords: "Bản chép lời không có từ để hiện.",
  notSpeech: "Không nhận dạng được định dạng bản chép lời.",


  stats: (count, cut) => cut ? `${count} từ · ${cut} đã cắt` : `${count} từ`,
  jump: "Đến đây",
  cutWordTitle: "Cắt khỏi dòng thời gian",
  partialWordTitle: "Đoạn cắt nằm trong từ; chỉ phần còn lại trên dòng thời gian",

  // Selection bar
  selected: (count, seconds) => seconds === null ? `Đã chọn ${count} từ` : `Đã chọn ${count} từ · ${secondsLabel(seconds)}`,
  cut: "Cắt",
  restore: "Khôi phục",
  editWord: "Sửa từ",
  deleteText: "Xóa văn bản",
  clear: "Bỏ chọn · Esc",
  aiFind: "Tìm chỗ cắt",
  aiFindHint: "Hoặc để AI tìm từ đệm và khoảng ngắt trước",

  // Result
  cutDone: (seconds, ranges) => ranges > 1 ? `Đã cắt ${secondsLabel(seconds)} · ${ranges} phạm vi` : `Đã cắt ${secondsLabel(seconds)}`,
  cutNothing: "Từ chọn không còn trên dòng thời gian; không có gì cắt.",
  cutTooShort: "Vùng chọn ngắn hơn một khung hình, không cắt được.",
  restoreDone: (seconds) => `Đã khôi phục ${secondsLabel(seconds)}`,
  restoreNotRelaid: "Một số đoạn cắt không có mối nối tương ứng. Đã bỏ khỏi danh sách cắt nhưng chưa đặt lại nội dung.",
  restoreRefused: {
    untracked: "Phạm vi này không bị cắt bỏ (ví dụ được cắt tỉa khi kéo cạnh clip) nên không có đoạn cắt nào để khôi phục. Hãy kéo cạnh clip trên dòng thời gian để đưa lại.",
    partial: "Chỉ một phần của phạm vi này bị cắt bỏ nên không thể đổi phạm vi. Hãy nhấp vào dải cắt để khôi phục phần đó trước.",
  },
  textSaved: "Đã cập nhật chữ · giữ video và âm thanh",
  textDeleted: (count) => `Đã xóa chữ của ${count} từ · giữ video và âm thanh`,

  stale: (count) => `${count} rãnh phụ đề tạo từ bản chép lời cũ chưa cập nhật.`,
  gotoCaptions: "Mở Phụ đề",
  undo: "Hoàn tác",

  // Timeline cut markers
  seamLabel: (seconds) => `Đã cắt ${secondsLabel(seconds)} · nhấp khôi phục`,
  liveCopy: "Sao chép phần đã chép lời",
  liveCopied: "Đã sao chép phần đã chép lời · việc chép lời vẫn đang chạy",
  liveSpeaker: "Đang nhận dạng",
  liveWaiting: "Văn bản nhận dạng được sẽ lần lượt hiện ở đây. Một số dịch vụ chỉ trả về toàn bộ khi xong.",
  liveNote: "Văn bản nhận dạng được hiện theo từng đoạn. Bạn có thể chỉnh sửa khi chép lời xong.",
  liveJump: "Về mới nhất",
  liveSaving: "Đang lưu bản chép lời",
};

export const viTranscriptTools: TranscriptToolsMessages = {
  // Find and replace
  findTip: "Tìm và thay · ⌘F",
  findLabel: "Tìm và thay",
  findPlaceholder: "Tìm trong bản chép lời",

  lockTranslation: "Có thể tìm bản dịch nhưng không sửa tại đây; bảng Bản chép lời chỉ sửa bản gốc",
  lockLoading: "Bản chép lời mới đang tải; thay sau khi xong",
  replaceDone: (count) => `Đã thay ${count} kết quả · giữ video và âm thanh`,
  replaceNothing: "Không có kết quả cần đổi",

  // Copy
  copyMenu: "Sao chép bản chép lời",
  copyAllHead: (lang) => `Sao chép tất cả · ${lang}`,
  copyText: "Sao chép văn bản",
  copySettings: "Cài đặt sao chép",
  copyWithSettings: "Sao chép theo cài đặt",
  copyTextOnly: "Chỉ sao chép văn bản",
  textOnly: "Chỉ văn bản",
  keepCut: "Gồm phần cắt",
  copyConfirm: "Sao chép",
  copyTranslationOnly: "Đang chỉ hiện bản dịch nên nội dung được sao chép từ bảng: không kèm phần đầu, phần đã cắt sẽ bị bỏ qua.",
  copyScopeHead: (scope) => `Sao chép ${scope}`,
  copied: (scope, receipt) => `Đã sao chép ${scope} · ${receipt}`,
  copyFailed: "Không sao chép được · trình duyệt không cho truy cập bộ nhớ tạm",
  copyEmpty: "Không có gì sao chép",
  scopeAll: "tất cả",
  scopePara: "đoạn này",
  scopeChapter: (title: string) => `“${title}”`,
  scopeSelection: "văn bản chọn",
  copySelection: "Sao chép",
  copySelectionTip: "Sao chép chữ chọn · ⌘C",

  // Language view (design `langShort` and the transcript language menu)
  langLabel: "Ngôn ngữ bản chép lời",
  langSource: "Bản gốc",
  langTranslation: "Bản dịch",
  langBoth: (source: string, translation: string) => `${source} + ${translation}`,
  showBoth: "Hiện bản gốc bên cạnh",
  showBothNeedsTranslation: "Chọn bản dịch trước",
  showBothHint: "Cạnh nhau",
  noTranslation: "Chưa có bản dịch",
  noTranslationHint: "Dịch từ bảng Phụ đề bằng “+ Dịch sang…”",
  translationNote: "Bản dịch chỉ bám theo phát đến từng đoạn; thời gian từng từ chỉ có ở bản gốc, nên tô sáng từng từ sẽ không chính xác.",
  translationOnly: "Khi chỉ xem bản dịch thì không thể sửa hoặc cắt; hãy chuyển về bản gốc hoặc xem cạnh nhau để sửa.",
  noParagraphTranslation: "Đoạn này không có bản dịch",

  // Paragraph row (design `ParaRow`)
  paraMenu: "Đoạn này…",
  moveUp: "Chuyển chương trước",
  moveDown: "Chuyển chương sau",
  play: "Phát đoạn",
  moveHead: "Chuyển đến chương",
  moveTo: (title) => `Chuyển đến “${title}”`,
  moveWith: (count) => count > 1 ? `Chuyển cùng đoạn bên cạnh phía đó, tổng ${count} đoạn` : 'Chỉ chuyển đoạn này',

  noPrev: "Không có chương trước đoạn",
  noNext: "Không có chương sau đoạn",
  moveBlocked: "Chuyển sẽ để chương trống hoặc vượt đầu chương bên cạnh",
  moved: (title, count) => count > 1 ? `Đã chuyển ${count} đoạn đến “${title}”` : `Đã chuyển đến “${title}”`,
  cutPara: "Cắt đoạn này",
  cutParaHint: "Cắt cả video, âm thanh và phụ đề; có thể khôi phục",

  // Chapter header ("This chapter…")
  chapterMenu: "Chương này…",
  renameChapter: "Đổi tên…",
  cutChapter: "Cắt chương này",
  cutChapterHint: "Cắt cả video, âm thanh và phụ đề; các chương sau dồn lên",
  cutChapterRefused: {
    empty: "Chương không có thời lượng",
    whole: "Chương này là toàn video; cắt sẽ không còn gì",
    'no-tracks': "Không có rãnh nào trên dòng thời gian dùng tư liệu đã chép lời nên không có gì để cắt",
  },
  cutChapterDone: (title, seconds) => `Đã cắt “${title}” · ${secondsLabel(seconds)}`,
  removeMarker: "Xóa dấu chương",
  removeMarkerHint: "Chỉ xóa dấu chương; nội dung được giữ lại",
  find: "Tìm",
  badRegex: "Regex không hợp lệ",
  noResults: "Không có kết quả",
  previous: "Trước",
  next: "Tiếp theo",
  closeFind: "Đóng tìm kiếm",
  replaceWith: "Thay thế bằng",
  matchCase: "Phân biệt hoa thường",
  wholeWordShort: "Từ",
  wholeWord: "Khớp cả từ",
  regex: "Biểu thức chính quy · văn bản thay thế được chèn nguyên văn",
  replace: "Thay",
  replaceAll: "Thay tất cả",
  regexError: (error) => `Lỗi regex: ${error}`,
};
