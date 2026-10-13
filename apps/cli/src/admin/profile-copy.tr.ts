import type { ProfileMessages } from './profile-copy.ts';

export const tr: ProfileMessages = {
  help: `Kullanım:
  cuccut profile show [--project <id>]
                                   CucCut’un sizin hakkınızda bildikleri: görüşme, tercihleriniz, kurallarınız
                                   ve doğru yazılması gereken adlar; bir proje ile (--project veya geçerli klasörün
                                   projesi), o projenin tercihleri ve kuralları da
  cuccut profile answers set <question> <text>
                                   Bir görüşme yanıtını kaydet (who, record, platforms, annoys, names);
                                   boş metin yanıtı siler
  cuccut profile interview skip|reopen|write
                                   Görüşmeyi atla, yeniden aç ya da tercihlerinizi yanıtlardan varsayılan agent’ınızla
                                   yaz (agent yoksa yanıtlar yazıldığı gibi saklanır)
  cuccut profile preferences [--project <id>] --file <md>
                                   Kendi tercihlerinizi ya da projeninkini bir Markdown dosyasıyla değiştirin
                                   (--file - standart girdiyi okur); görüşmenin yazdığı bölüm korunur
  cuccut profile rules list [--project <id>]
                                   Kurallarınız (ya da projenin kuralları), okunma sırasıyla
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Kurallar sırayla okunur; ikisi çelişirse sonraki kazanır
Agent’lar profili bir oturum başladığında okur; zaten açık oturumlar mevcut durumlarını korur.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Görüşme sorusu değil: ${value} (şunlardan birini kullanın: ${ids})`,
  needFile: 'Tercihleri bir Markdown dosyası olarak verin: --file <md>, ya da standart girdi için --file -',
  badMove: (value: string) => `Bir kuralı yukarı, aşağı ya da bir konuma taşıyın (1 ilk sıradır): ${value}`,
  ruleMissing: (id: string) => `Bu düzeyde ${id} kuralı yok (cuccut profile rules list komutuna bakın)`,
  projectMissing: (id: string) => `${id} projesi yok (cuccut projects list komutuna bakın)`,
  stdinPrompt: 'Tercihleri yazın ya da yapıştırın, sonra Ctrl-D tuşlayın:',

  // show
  questionWho: 'Ne üretiyorsunuz ve kime hitap ediyor?',
  questionRecord: 'Genellikle neyi kaydedersiniz?',
  questionPlatforms: 'Nereye gidiyor ve ne kadar sürmeli?',
  questionAnnoys: 'Bugün videolarınızda sizi neyin rahatsız ettiği?',
  questionNames: 'Doğru yazılması gereken adlar',
  interviewLine: (status: string, answered: number, total: number) => `Görüşme: ${status}, ${total} sorudan ${answered} tanesi yanıtlandı`,
  statusPending: 'henüz yapılmadı',
  statusSkipped: 'atlandı',
  statusDone: 'tamamlandı',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Tercihleriniz',
  interviewHeading: 'Görüşmenin yazdıkları',
  projectHeading: (name: string) => `${name} için tercihler`,
  noText: '  (yok)',
  rulesHeading: 'Kurallar',
  projectRulesHeading: (name: string) => `${name} için kurallar`,
  noRules: '  Henüz kural yok',
  namesLine: (names: string) => `Doğru yazılacak adlar: ${names}`,
  readOnly: 'Profil CucCut’un daha yeni bir sürümü tarafından kaydedildi: gösterilir, ancak değişiklikler reddedilir',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (kapalı)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Ne zaman: ${when}`,
  ruleDo: (instruction: string) => `   Yap: ${instruction}`,
  ruleTemplate: (id: string) => `   Şablon: ${id}`,
  stageAny: 'seçme ve düzenleme',
  stageClip: 'klip seçme',
  stageEdit: 'düzenleme',
  ruleEnabled: (name: string) => `Açıldı: ${name}`,
  ruleDisabled: (name: string) => `Kapatıldı: ${name}`,
  ruleRemoved: (name: string, id: string) => `${name} kaldırıldı (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `${name} ${total} içinde ${position}. sıraya taşındı`,

  // Writes
  answerSaved: (question: string) => `“${question}” yanıtı kaydedildi`,
  answerCleared: (question: string) => `“${question}” yanıtı temizlendi`,
  interviewSkipped: 'Görüşme atlandı; yanıtlar korunuyor',
  interviewReopened: 'Görüşme önceki yanıtlarla yeniden açıldı',
  writing: 'Tercihleriniz yanıtlardan yazılıyor. Bu bir an sürer…',
  writtenByAgent: 'Tercihler yanıtlarınızdan yazıldı:',
  keptAsTyped: (reason: string) => `Yanıtlarınız yazdığınız gibi saklandı (${reason}):`,
  reasonNoAgent: 'kurulu ve oturum açılmış bir agent yok',
  reasonAgentFailed: 'agent’ın çalışması tamamlanmadı',
  reasonBadOutput: 'agent’ın çıktısı kullanılamadı',
  namesAdded: (names: string) => `Ad sözlüğe eklendi: ${names}`,
  preferencesSaved: (chars: number) => `Tercihleriniz kaydedildi (${chars} karakter)`,
  projectPreferencesSaved: (name: string, chars: number) => `${name} için tercihler kaydedildi (${chars} karakter)`,
  takesEffect: 'Agent’lar bunu bir oturum başladığında okur; zaten açık oturumlar mevcut durumlarını korur',
};
