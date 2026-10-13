import type { PacksMessages } from './packs-copy.ts';

export const vi: PacksMessages = {
  packsHelp: `Cách dùng:
  cuccut packs inspect <source>    Đọc một gói và hiển thị mọi thứ nó mang theo, mà không cài đặt.
                                   <source>: một thư mục, một địa chỉ GitHub (owner/repo, URL kho lưu trữ hoặc
                                   …/tree/<branch>/<folder>) hoặc một địa chỉ https:// phục vụ pack.json
  cuccut packs install <source>    Đọc một gói và cài các mẫu, kỹ năng, mục thư viện, hướng dẫn phong cách
                                   và thao tác nhanh của nó
    --replace                      Thay thế các mẫu và kỹ năng của riêng bạn có cùng id (chúng sẽ vào thùng rác);
                                   nếu không có tùy chọn này, chúng được giữ lại và bỏ qua
  cuccut packs remove <id>         Xóa một gói: gói cùng các mẫu và kỹ năng nó mang theo sẽ vào thùng rác trong
                                   24 giờ; mục thư viện và những gì bạn đã sửa vẫn được giữ lại
  cuccut packs restore <trashId>   Hoàn tác việc xóa, trong vòng 24 giờ
  cuccut packs style <id> [<file>|-]
                                   In hướng dẫn phong cách của gói; với một tệp (hoặc - để đọc từ đầu vào chuẩn),
                                   lưu tệp đó làm hướng dẫn (tệp rỗng sẽ xóa hướng dẫn)
  cuccut packs export <folder> --name <name>
                                   Ghi một thư mục gói từ các mẫu, kỹ năng và mục thư viện của riêng bạn, kèm
                                   danh sách tệp, để gửi nguyên trạng, đẩy lên GitHub hoặc phục vụ từ bất kỳ
                                   máy chủ tĩnh nào. Thư mục phải trống hoặc là một lần xuất trước của gói
    --id <id>                      Id của gói (mặc định: tạo từ tên)
    --version <version>            Mặc định 1.0.0
    --author <name>, --description <text>
    --template <id>                Một mẫu của riêng bạn (có thể lặp lại)
    --skill <id>                   Một kỹ năng không có sẵn (có thể lặp lại)
    --library <glossaries|brand>:<entryId>
                                   Một mục thư viện (có thể lặp lại); giọng nói không được mang theo
    --quick-actions <packId>       Các thao tác nhanh của một gói đã cài (có thể lặp lại)
    --style-from <packId>          Hướng dẫn phong cách và tệp tham chiếu của một gói đã cài`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, của ${author}` : ''}`,
  notInstalled: 'Chưa cài: hãy đọc trước.',
  installedVersion: (version: string) =>
    `Phiên bản ${version} đã được cài. Cài lại sẽ cập nhật những gì gói sở hữu và giữ lại những gì bạn đã sửa.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} mẫu` : '',
      skills ? `${skills} kỹ năng` : '',
      library ? `${library} mục thư viện` : '',
      style ? 'một hướng dẫn phong cách' : '',
      quickActions ? `${quickActions} thao tác nhanh` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Không có nội dung riêng';
  },
  sectionTemplates: 'Mẫu',
  sectionSkills: 'Kỹ năng',
  sectionLibrary: 'Thư viện',
  sectionStyle: 'Hướng dẫn phong cách: agent đọc trước khi chọn và chỉnh sửa',
  sectionExamples: 'Tệp tham chiếu',
  sectionQuick: 'Thao tác nhanh: tin nhắn gửi cho agent chỉ với một lần nhấp',
  sectionReserved: 'Quy tắc và tiêu chuẩn đánh giá: được giữ cùng gói; CucCut chưa dùng đến',
  sectionWarnings: 'Cảnh báo',
  agentReads: 'Văn bản agent sẽ làm theo. Hãy đọc.',
  stateNew: 'mới',
  stateUpdate: 'cập nhật bản sao mà gói này đã cài',
  stateChanged: 'bạn đã sửa nó từ khi cài: được giữ lại trừ khi dùng --replace',
  stateExists: 'bạn đã có một mục cùng id: của bạn được giữ lại trừ khi dùng --replace',
  stateBuiltin: 'một mục có sẵn có id này, nên mục này không được cài',
  skillFiles: (files: number) => `${files} tệp`,
  duplicate: 'đã có trong thư viện của bạn; không thêm lại',
  bytes: (bytes: number) => `${bytes} byte`,
  missingSkill: (template: string, skill: string) =>
    `${template} đề xuất kỹ năng "${skill}", nhưng kỹ năng này không có trên máy tính này cũng không có trong gói`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, dòng ${line}: ${why}${text ? ` ("${text}")` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Gói này sẽ không được cài: dòng ${line} của ${file} ${why}${text ? ` ("${text}")` : ''}`,
  installHint: (source: string) => `Cài bằng lệnh: cuccut packs install ${source}`,
  replaceHint: 'Thêm --replace để thay thế các mục của riêng bạn có cùng id.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `Đã cài ${name} v${version}: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `Đã bỏ qua ${kind === 'template' ? 'mẫu' : kind === 'skill' ? 'kỹ năng' : 'mục thư viện'} ${id}: ${
      reason === 'builtin'
        ? 'một mục có sẵn có id này'
        : reason === 'exists'
          ? 'bạn đã có mục riêng với id này (thêm --replace)'
          : 'bạn đã sửa nó từ khi cài (thêm --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `Đã xóa ${name}: ${templates} mẫu và ${skills} kỹ năng đi kèm. Mục thư viện vẫn được giữ lại.`,
  kept: (count: number, ids: string) => `${count} mục bạn đã sửa được giữ lại: ${ids}`,
  undo: (trashId: string) => `Hoàn tác trong vòng 24 giờ: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `Đã khôi phục ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} không có hướng dẫn phong cách. Hãy lưu một hướng dẫn bằng cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Đã lưu hướng dẫn phong cách của ${name} (${chars} / ${limit} ký tự)`,
  styleRemoved: (name: string) => `Đã xóa hướng dẫn phong cách của ${name}`,
  takesEffect: 'Có hiệu lực từ phiên agent mới tiếp theo.',
  idFormat: (value: string) => `Không phải id gói (chữ thường, chữ số và dấu gạch ngang đơn): ${value}`,

  // Export
  exportNeedsName: 'Hãy đặt tên cho gói bằng --name.',
  exportNoId: (name: string) => `Không tạo được id từ "${name}"; hãy đặt id bằng --id.`,
  libraryFormat: (value: string) => `Không phải mục thư viện (glossaries:<entryId> hoặc brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `Đã ghi ${dir}: ${files} tệp, ${bytes} byte. Gửi nguyên thư mục, đẩy lên GitHub, hoặc phục vụ từ bất kỳ máy chủ tĩnh nào.`,
  exportedCheck: (dir: string) => `Đọc lại bằng lệnh: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Không đọc được ${file}: ${reason}`,
};
