import type { McpMessages } from './mcp-copy.ts';

export const tr: McpMessages = {
previousClientUnknown: 'Değiştirilen öğenin kullandığı istemci belirlenemedi; istemci iptal edilmedi: cuccut mcp status mevcut istemcileri listeler; kullanılmayanları cuccut services mcp revoke <clientId> ile iptal edin', defaultProjectRegistered: (name, path) => `CucCut içinde proje yoktu: dış ajanların video oluşturması için varsayılan “${name}” projesi kaydedildi (${path})`,
help: `Kullanım:
  cuccut mcp install --agent <claude-code|codex|cursor|gemini> [--level ask|auto] [--name <client name>] [--yes]
                                   Dış ajanı CucCut MCP hizmetine bağla: hizmeti başlat (Runtime ile başlamasını da ayarla),
                                   ajan için yeni istemci ve jeton oluştur, adres ve jetonu ajanın MCP yapılandırmasına yaz
                                   (öğe adı cuccut); sonra ajanı yeniden başlat
                                   CucCut içinde proje yoksa CLI projesini varsayılan projeler klasörüne dış ajanlar için kaydet
    --level ask|auto               Erişim düzeyi: ask her yazma ve görevde CucCut içinde onay ister (hizmet varsayılanı);
                                   auto doğrudan çalıştırır. Verilmezse mevcut düzey korunur
    --name <client name>           CucCut içinde görünen istemci adı (varsayılan ajanın adı); ayrı iptal edilebilir
    --yes                          Ajanın yapılandırmasında cuccut öğesi varsa değiştir ve eski öğenin kullandığı istemciyi
                                   iptal et (eski jetondan tanınır; tanınamazsa aynı adlı istemciler iptal kararınız için
                                   listelenir). Verilmezse üzerine yazılmaz ve istemci oluşturulmaz
  Jeton konumu: Claude Code jetonu ~/.claude/settings.json env (CUCCUT_MCP_TOKEN) içinde tutar, yapılandırma yalnızca başvurur.
  Codex (~/.codex/config.toml), Cursor (~/.cursor/mcp.json) ve Gemini CLI (~/.gemini/settings.json) ortam değişkenleri
  için yer sunmaz; jeton yapılandırmaya düz metin yazılır: bu dosyaları commit etmeyin veya paylaşmayın, ask düzeyini
  tercih edin; jeton sızarsa cuccut services mcp revoke <clientId> ile iptal edin.
  Hizmet yalnızca CucCut Runtime çalışırken kullanılabilir (CucCut açın veya cuccut runtime ensure çalıştırın).
  cuccut mcp status                MCP hizmetinin durumu, adresi, düzeyi ve istemcileri ile her ajanın yapılandırmasında
                                   cuccut öğesi olup olmadığı (jetonlar gösterilmez)`,
entryExists: (file, entry) => `${file} içinde ${entry} öğesi zaten var; değişiklik yapılmadı. Değiştirmek için --yes ekleyin`, serviceNotAvailable: 'Bu CucCut sürümü MCP hizmeti sunmuyor', serviceStartFailed: (reason) => `MCP hizmeti başlamadı: ${reason ?? 'bilinmeyen neden'}`, connected: (host, url) => `${host} CucCut MCP hizmetine bağlandı: ${url}`, configEnv: (configFile, envFile, envVar) => `Yapılandırma: ${configFile} (jeton ${envFile} içindeki env.${envVar} alanında; yapılandırma yalnızca başvurur)`, configPlaintext: (configFile, clientId) => `Yapılandırma: ${configFile} (jeton bu dosyaya düz metin yazılır: commit etmeyin veya paylaşmayın; sızarsa cuccut services mcp revoke ${clientId} ile iptal edin)`, clientLine: (name, clientId, level) => `İstemci: ${name} (${clientId})  Düzey: ${level ?? '—'}`, restartHint: (host) => `Geçerli olması için ${host} yeniden başlatın. Hizmet CucCut Runtime ile çalışır: Runtime çalışmıyorsa önce CucCut açın veya cuccut runtime ensure çalıştırın`, replacedRevoked: (name, clientId) => `Eski öğe değiştirildi ve kullandığı istemci iptal edildi: ${name} (${clientId})`, replacedRevokeFailed: (reason) => `Eski öğe değiştirildi, ancak kullandığı istemci iptal edilemedi: ${reason}`, oldClientRemains: (ids) => `Eski istemci hâlâ var: ${ids.join(', ')}. Artık kullanılmıyorsa: cuccut services mcp revoke <clientId>`, sameNameClientsRemain: (ids, unrecognized) => `${unrecognized ? 'Eski öğenin kullandığı istemci belirlenemedi; aynı adlı istemciler' : 'Aynı adlı istemciler'} hâlâ var: ${ids.join(', ')}. Artık kullanılmıyorlarsa: cuccut services mcp revoke <clientId>`, hostsHeading: (entry) => `Her ajanın yapılandırmasında ${entry} öğesi var mı:`, hostUnreadable: (problem) => `okunamıyor (${problem})`, hostConfigured: 'evet', hostNotConfigured: 'hayır', noServiceStatus: 'Runtime MCP hizmetinin durumunu bildirmedi', levelChoice: (value) => `--level ask veya auto olmalı: ${value}`,
};
