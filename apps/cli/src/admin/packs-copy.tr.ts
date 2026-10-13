import type { PacksMessages } from './packs-copy.ts';

export const tr: PacksMessages = {
  packsHelp: `Kullanım:
  cuccut packs inspect <source>    Bir paketi okur ve içindeki her şeyi kurmadan gösterir.
                                   <source>: bir klasör, bir GitHub adresi (owner/repo, bir depo URL’si veya
                                   …/tree/<branch>/<folder>) ya da pack.json sunan bir https:// adresi
  cuccut packs install <source>    Bir paketi okur ve şablonlarını, becerilerini, kütüphane öğelerini, stil
                                   rehberini ve hızlı eylemlerini kurar
    --replace                      Aynı kimliklere sahip kendi şablon ve becerilerinizi değiştirir (çöp kutusuna
                                   gider); bu olmadan korunur ve atlanır
  cuccut packs remove <id>         Bir paketi siler: paket ve getirdiği şablon ile beceriler 24 saat boyunca çöp
                                   kutusuna gider; kütüphane öğeleri ve yaptığınız değişiklikler kalır
  cuccut packs restore <trashId>   24 saat içinde bir silmeyi geri alır
  cuccut packs style <id> [<file>|-]
                                   Paketin stil rehberini yazdırır; bir dosyayla (ya da standart girdi için -)
                                   dosyayı rehber olarak kaydeder (boş bir dosya rehberi kaldırır)
  cuccut packs export <folder> --name <name>
                                   Kendi şablonlarınızdan, becerilerinizden ve kütüphane öğelerinizden dosya
                                   dizinli bir paket klasörü yazar; olduğu gibi gönderilebilir, GitHub’a yüklenebilir
                                   ya da herhangi bir statik barındırıcıdan sunulabilir. Klasör boş olmalı ya da paketin
                                   önceki bir dışa aktarımı olmalı
    --id <id>                      Paketin kimliği (varsayılan: addan üretilir)
    --version <version>            Varsayılan 1.0.0
    --author <name>, --description <text>
    --template <id>                Kendi şablonunuz (tekrarlanabilir)
    --skill <id>                   Yerleşik olmayan bir beceri (tekrarlanabilir)
    --library <glossaries|brand>:<entryId>
                                   Bir kütüphane öğesi (tekrarlanabilir); sesler kalır
    --quick-actions <packId>       Kurulu bir paketin hızlı eylemleri (tekrarlanabilir)
    --style-from <packId>          Kurulu bir paketin stil rehberi ve referans dosyaları`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, ${author} tarafından` : ''}`,
  notInstalled: 'Kurulu değil: önce okuyun.',
  installedVersion: (version: string) =>
    `${version} sürümü kurulu. Yeniden kurmak, paketin sahip olduklarını günceller ve sizin değişikliklerinizi korur.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} şablon` : '',
      skills ? `${skills} beceri` : '',
      library ? `${library} kütüphane öğesi` : '',
      style ? 'bir stil rehberi' : '',
      quickActions ? `${quickActions} hızlı eylem` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Kendine ait bir şey yok';
  },
  sectionTemplates: 'Şablonlar',
  sectionSkills: 'Beceriler',
  sectionLibrary: 'Kütüphane',
  sectionStyle: 'Stil rehberi: ajanlar seçmeden ve düzenlemeden önce bunu okur',
  sectionExamples: 'Referans dosyaları',
  sectionQuick: 'Hızlı eylemler: tek tıklamayla ajana gönderilen iletiler',
  sectionReserved: 'Kurallar ve inceleme standardı: pakette saklanır; CucCut bunları henüz kullanmıyor',
  sectionWarnings: 'Uyarılar',
  agentReads: 'Bir ajanın izleyeceği metin. Okuyun.',
  stateNew: 'yeni',
  stateUpdate: 'bu paketin kurduğu kopyayı günceller',
  stateChanged: 'kurulumdan sonra değiştirdiniz: --replace kullanılmadıkça korunur',
  stateExists: 'Bu kimlikle zaten sizinki var: --replace kullanılmadıkça sizinki korunur',
  stateBuiltin: 'Bu kimlikle yerleşik bir öğe var, bu yüzden bu kurulmaz',
  skillFiles: (files: number) => `${files} dosya`,
  duplicate: 'zaten kütüphanenizde; yeniden eklenmedi',
  bytes: (bytes: number) => `${bytes} bayt`,
  missingSkill: (template: string, skill: string) =>
    `${template} “${skill}” becerisini öneriyor, ama bu beceri ne bu bilgisayarda ne de pakette var`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, ${line}. satır: ${why}${text ? ` (“${text}”)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Bu paket kurulmayacak: ${file} dosyasının ${line}. satırı ${why}${text ? ` (“${text}”)` : ''}`,
  installHint: (source: string) => `Şununla kurun: cuccut packs install ${source}`,
  replaceHint: 'Aynı kimliklere sahip kendi öğelerinizi değiştirmek için --replace ekleyin.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `${name} v${version} kuruldu: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `${kind === 'template' ? 'Şablon' : kind === 'skill' ? 'Beceri' : 'Kütüphane öğesi'} ${id} atlandı: ${
      reason === 'builtin'
        ? 'bu kimlikle yerleşik bir öğe var'
        : reason === 'exists'
          ? 'bu kimlikle kendi öğeniz var (--replace ekleyin)'
          : 'kurulumdan sonra değiştirdiniz (--replace ekleyin)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name} silindi: ${templates} şablon ve ${skills} beceri onunla birlikte gitti. Kütüphane öğeleri kalır.`,
  kept: (count: number, ids: string) => `${count} değiştirdiğiniz öğe kalır: ${ids}`,
  undo: (trashId: string) => `24 saat içinde geri alın: cuccut packs restore ${trashId}`,
  replacedUndo: (ids: string, trashId: string) => `Replaced your own ${ids}. Undo within 24 hours: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `${name} v${version} geri getirildi`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} için stil rehberi yok. cuccut packs style ${id} <file> ile bir tane kaydedin`,
  styleSaved: (name: string, chars: number, limit: number) => `${name} paketinin stil rehberi kaydedildi (${chars} / ${limit} karakter)`,
  styleRemoved: (name: string) => `${name} paketinin stil rehberi kaldırıldı`,
  takesEffect: 'Bir sonraki yeni ajan oturumundan itibaren geçerli olur.',
  idFormat: (value: string) => `Geçerli bir paket kimliği değil (küçük harfler, rakamlar ve tek kısa çizgi): ${value}`,

  // Export
  exportNeedsName: 'Paketin adını --name ile verin.',
  exportNoId: (name: string) => `“${name}” adından kimlik oluşturulamıyor; --id ile belirtin.`,
  libraryFormat: (value: string) => `Kütüphane öğesi değil (glossaries:<entryId> ya da brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `${dir} yazıldı: ${files} dosya, ${bytes} bayt. Klasörü olduğu gibi gönderin, GitHub’a yükleyin ya da herhangi bir statik barındırıcıdan sunun.`,
  exportedCheck: (dir: string) => `Geri okumak için: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `${file} okunamıyor: ${reason}`,
};
