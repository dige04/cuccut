import type { McpMessages } from './mcp-copy.ts';

export const vi: McpMessages = {
previousClientUnknown: 'Không xác định được máy khách mà mục đã thay thế dùng nên chưa thu hồi máy khách: cuccut mcp status liệt kê máy khách hiện có; thu hồi máy khách không dùng bằng cuccut services mcp revoke <clientId>', defaultProjectRegistered: (name, path) => `CucCut chưa có dự án: đã đăng ký dự án mặc định “${name}” (${path}) để Agent bên ngoài tạo video`,
help: `Cách dùng:
  cuccut mcp install --agent <claude-code|codex|cursor|gemini> [--level ask|auto] [--name <client name>] [--yes]
                                   Kết nối Agent bên ngoài với dịch vụ MCP CucCut: khởi chạy dịch vụ (và tự khởi chạy cùng Runtime),
                                   tạo máy khách và token mới cho Agent rồi ghi địa chỉ và token vào cấu hình MCP của Agent
                                   (tên mục cuccut); sau đó khởi động lại Agent
                                   Nếu CucCut chưa có dự án, đăng ký dự án CLI trong thư mục dự án mặc định cho Agent bên ngoài
    --level ask|auto               Mức truy cập: ask yêu cầu xác nhận mỗi lần ghi và tác vụ trong CucCut (mặc định dịch vụ);
                                   auto chạy trực tiếp. Bỏ qua thì giữ mức hiện tại
    --name <client name>           Tên máy khách hiển thị trong CucCut (mặc định tên Agent); có thể thu hồi riêng
    --yes                          Nếu cấu hình Agent đã có mục cuccut, thay thế và thu hồi máy khách mục cũ dùng
                                   (nhận dạng từ token cũ; nếu không nhận ra, liệt kê máy khách cùng tên để bạn quyết định
                                   thu hồi). Nếu không có, không ghi đè và không tạo máy khách
  Vị trí token: Claude Code giữ trong env (CUCCUT_MCP_TOKEN) của ~/.claude/settings.json, cấu hình chỉ tham chiếu.
  Codex (~/.codex/config.toml), Cursor (~/.cursor/mcp.json) và Gemini CLI (~/.gemini/settings.json) không có chỗ cho biến
  môi trường nên token được ghi văn bản thuần trong cấu hình: không commit hoặc chia sẻ tệp và ưu tiên mức ask;
  nếu token lộ, thu hồi bằng cuccut services mcp revoke <clientId>.
  Dịch vụ chỉ khả dụng khi Runtime CucCut đang chạy (mở CucCut hoặc chạy cuccut runtime ensure).
  cuccut mcp status                Trạng thái, địa chỉ, mức và máy khách của dịch vụ MCP cùng việc cấu hình mỗi Agent có mục
                                   cuccut hay không (không kèm token)`,
entryExists: (file, entry) => `${file} đã có mục ${entry}; chưa đổi gì. Thêm --yes để thay thế`, serviceNotAvailable: 'Phiên bản CucCut này không cung cấp dịch vụ MCP', serviceStartFailed: (reason) => `Dịch vụ MCP chưa khởi chạy: ${reason ?? 'chưa rõ nguyên nhân'}`, connected: (host, url) => `Đã kết nối ${host} với dịch vụ MCP CucCut: ${url}`, configEnv: (configFile, envFile, envVar) => `Cấu hình: ${configFile} (token trong env.${envVar} của ${envFile}; cấu hình chỉ tham chiếu)`, configPlaintext: (configFile, clientId) => `Cấu hình: ${configFile} (token ghi văn bản thuần trong tệp này: không commit hoặc chia sẻ; nếu lộ, thu hồi bằng cuccut services mcp revoke ${clientId})`, clientLine: (name, clientId, level) => `Máy khách: ${name} (${clientId})  Mức: ${level ?? '—'}`, restartHint: (host) => `Khởi động lại ${host} để có hiệu lực. Dịch vụ chạy cùng Runtime CucCut: nếu Runtime chưa chạy, mở CucCut hoặc chạy cuccut runtime ensure trước`, replacedRevoked: (name, clientId) => `Đã thay mục cũ và thu hồi máy khách nó dùng: ${name} (${clientId})`, replacedRevokeFailed: (reason) => `Đã thay mục cũ nhưng không thu hồi được máy khách nó dùng: ${reason}`, oldClientRemains: (ids) => `Máy khách cũ vẫn còn: ${ids.join(', ')}. Nếu không dùng nữa: cuccut services mcp revoke <clientId>`, sameNameClientsRemain: (ids, unrecognized) => `${unrecognized ? 'Không xác định được máy khách mục cũ dùng; máy khách' : 'Máy khách'} cùng tên vẫn còn: ${ids.join(', ')}. Nếu không dùng nữa: cuccut services mcp revoke <clientId>`, hostsHeading: (entry) => `Cấu hình mỗi Agent có mục ${entry} hay không:`, hostUnreadable: (problem) => `không đọc được (${problem})`, hostConfigured: 'có', hostNotConfigured: 'không', noServiceStatus: 'Runtime chưa báo trạng thái dịch vụ MCP', levelChoice: (value) => `--level phải là ask hoặc auto: ${value}`,
};
