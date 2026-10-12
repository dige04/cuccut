import type { SkillsMessages } from './skills-copy.ts';

export const tr: SkillsMessages = {
skillsHelp: `Kullanım:
  cuccut skills add <folder>       Yerel Skill klasörünü (kökünde SKILL.md ile) <CUCCUT_HOME>/skills
                                   içine kopyala; varsayılan olarak açık
  cuccut skills import <source>    GitHub kaynağından Skill içe aktar: owner/repo, depo URL’si veya
                                   …/tree/<branch>/<folder>; varsayılan kapalı, açmadan önce gözden geçirin
    --id <id>                      add ve import için başka id kullan (varsayılan klasör adından
                                   türetilir; id varsa reddedilir, asla üzerine yazılmaz)
  cuccut skills enable|disable <id>
                                   Skill aç / kapat: sonraki yeni ajan oturumundan itibaren geçerli
  cuccut skills remove <id>        Eklenen veya içe aktarılan Skill sil (yerleşik olanlar silinemez, yalnızca kapatılır)`,
added: 'Eklendi', imported: 'İçe aktarıldı', turnedOn: 'Açıldı', turnedOff: 'Kapatıldı', reviewFirst: (id) => `Önce gözden geçirin (cuccut skills read ${id}), sonra cuccut skills enable ${id} ile açın`, takesEffectNextSession: 'Sonraki yeni ajan oturumundan itibaren geçerli; devam eden oturumlar etkilenmez', removed: (id, path) => `${id} silindi (${path})`, localSource: (path, addedAt) => `yerel klasör ${path} (${addedAt})`, remoteSource: (url, ref, commit, importedAt) => `${url} (${ref}@${commit}, ${importedAt})`, changed: (verb, id, name, enabled, path, source) => `${verb} ${id} (${name}, ${enabled ? 'açık' : 'kapalı'}) → ${path}${source ? `\nKaynak: ${source}` : ''}`, idFormat: (flag, value) => `${flag} Skill id kabul eder (küçük harf, kısa çizgiyle ayrılmış; cuccut skills komutuna bakın): ${value}`,
skillHelp: `Kullanım:
  cuccut skill install --agent <claude-code|codex|cursor|gemini> [--dir <folder>] [--link] [--yes]
                                   Dış ajanlar için CucCut Skill (CucCut kullanımı) host Skill klasörünün
                                   cuccut/ altına yükle: Claude Code ~/.claude/skills, Codex ~/.codex/skills,
                                   Cursor ~/.cursor/skills, Gemini CLI ~/.gemini/skills
    --dir <folder>                 Başka Skill klasörü kullan (altında cuccut/ içine yüklenir); --agent olmadan gerekli
    --link                         Oluşturulan Skill <CUCCUT_HOME>/agent-skills/cuccut içine, bağlantısını host içine
                                   koy: sonraki yükleme (herhangi host için) tümünü günceller
    --yes                          Hedef varsa değiştir (bağlantıda yalnızca bağlantı değiştirilir, hedef klasörü
                                   değil); verilmezse hiçbir şeyin üzerine yazılmaz
  cuccut skill path                CucCut Skill kaynağı, her host yükleme konumu ve mevcut
                                   yüklemeler (Runtime gerekmez)`,
targetExists: (target, linkTarget) => `${target} zaten var (${linkTarget !== null ? `${linkTarget} hedefine bağlantı` : 'klasör veya dosya'}); değişiklik yok. Değiştirmek için --yes ekleyin`, installed: (target, files, linkTo) => `CucCut Skill ${target} konumuna yüklendi (${files} dosya${linkTo ? `, bağlantı hedefi ${linkTo}` : ''})`, takesEffect: (host) => host ? `Yeni ${host} oturumunda geçerli` : 'Yeni oturumda geçerli', pathEscapes: (path) => `CucCut Skill içindeki yol klasörün dışını gösteriyor: ${path}`, sourceLine: (dir) => `Kaynak    ${dir ?? 'bulunamadı (CucCut yüklü değil ve burası depo değil; CUCCUT_AGENT_SKILLS_DIR ayarlayabilirsiniz)'}`, notInstalled: 'Yüklü değil', linkState: (target) => `Bağlantı → ${target}`, installedFolder: 'Yüklü (klasör)', isFile: 'Dosya (Skill klasörü değil)',
};
