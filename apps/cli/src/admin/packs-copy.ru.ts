import type { PacksMessages } from './packs-copy.ts';

export const ru: PacksMessages = {
  packsHelp: `Использование:
  cuccut packs inspect <source>    Читает пак и показывает всё, что в нём есть, не устанавливая его.
                                   <source>: папка, адрес GitHub (owner/repo, URL репозитория или
                                   …/tree/<branch>/<folder>) или адрес https://, по которому раздаётся pack.json
  cuccut packs install <source>    Читает пак и устанавливает его шаблоны, навыки, элементы библиотеки, гид по стилю
                                   и быстрые действия
    --replace                      Заменяет ваши шаблоны и навыки с теми же id (они уходят в корзину); без этого
                                   флага они сохраняются и пропускаются
  cuccut packs remove <id>         Удаляет пак: он сам и шаблоны и навыки, которые он принёс, уходят в корзину
                                   на 24 часа; элементы библиотеки и ваши изменения остаются
  cuccut packs restore <trashId>   Отменяет удаление в течение 24 часов
  cuccut packs style <id> [<file>|-]
                                   Выводит гид по стилю пака; с файлом (или - для стандартного ввода)
                                   сохраняет файл как гид (пустой файл удаляет его)
  cuccut packs export <folder> --name <name>
                                   Записывает папку пака из ваших шаблонов, навыков и элементов библиотеки
                                   с индексом файлов, чтобы отправить её как есть, загрузить на GitHub или раздавать
                                   с любого статического хостинга. Папка должна быть пустой или быть предыдущим экспортом пака
    --id <id>                      ID пака (по умолчанию создаётся из названия)
    --version <version>            По умолчанию 1.0.0
    --author <name>, --description <text>
    --template <id>                Ваш шаблон (можно повторять)
    --skill <id>                   Навык, не входящий в комплект (можно повторять)
    --library <glossaries|brand>:<entryId>
                                   Элемент библиотеки (можно повторять); голоса остаются
    --quick-actions <packId>       Быстрые действия установленного пака (можно повторять)
    --style-from <packId>          Гид по стилю и справочные файлы установленного пака`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, автор ${author}` : ''}`,
  notInstalled: 'Не установлен: сначала прочитайте.',
  installedVersion: (version: string) =>
    `Версия ${version} установлена. Повторная установка обновит то, чем владеет пак, и сохранит ваши изменения.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} ${templates === 1 ? 'шаблон' : templates < 5 ? 'шаблона' : 'шаблонов'}` : '',
      skills ? `${skills} ${skills === 1 ? 'навык' : skills < 5 ? 'навыка' : 'навыков'}` : '',
      library ? `${library} ${library === 1 ? 'элемент библиотеки' : library < 5 ? 'элемента библиотеки' : 'элементов библиотеки'}` : '',
      style ? 'гид по стилю' : '',
      quickActions ? `${quickActions} ${quickActions === 1 ? 'быстрое действие' : quickActions < 5 ? 'быстрых действия' : 'быстрых действий'}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Ничего своего';
  },
  sectionTemplates: 'Шаблоны',
  sectionSkills: 'Навыки',
  sectionLibrary: 'Библиотека',
  sectionStyle: 'Гид по стилю: агенты читают его перед выбором и редактированием',
  sectionExamples: 'Справочные файлы',
  sectionQuick: 'Быстрые действия: сообщения, которые отправляются агенту одним нажатием',
  sectionReserved: 'Правила и стандарт проверки: хранятся вместе с паком; CucCut пока их не использует',
  sectionWarnings: 'Предупреждения',
  agentReads: 'Текст, которому будет следовать агент. Прочитайте его.',
  stateNew: 'новый',
  stateUpdate: 'обновит копию, которую установил этот пак',
  stateChanged: 'вы изменили его после установки: сохраняется, если не указан --replace',
  stateExists: 'у вас уже есть элемент с этим id: ваш сохраняется, если не указан --replace',
  stateBuiltin: 'встроенный элемент с этим id уже есть, поэтому этот не устанавливается',
  skillFiles: (files: number) => `${files} ${files === 1 ? 'файл' : files < 5 ? 'файла' : 'файлов'}`,
  duplicate: 'уже есть в вашей библиотеке; повторно не добавляется',
  bytes: (bytes: number) => `${bytes} байт`,
  missingSkill: (template: string, skill: string) =>
    `${template} рекомендует навык «${skill}», которого нет ни на этом компьютере, ни в паке`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, строка ${line}: ${why}${text ? ` («${text}»)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Этот пак не будет установлен: строка ${line} файла ${file} ${why}${text ? ` («${text}»)` : ''}`,
  installHint: (source: string) => `Установите командой: cuccut packs install ${source}`,
  replaceHint: 'Добавьте --replace, чтобы заменить ваши элементы с теми же id.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `Установлен ${name} v${version}: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `Пропущен ${kind === 'template' ? 'шаблон' : kind === 'skill' ? 'навык' : 'элемент библиотеки'} ${id}: ${
      reason === 'builtin'
        ? 'встроенный элемент с этим id уже есть'
        : reason === 'exists'
          ? 'у вас есть свой с этим id (добавьте --replace)'
          : 'вы изменили его после установки (добавьте --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `Удалён ${name}: вместе с ним ушли ${templates} ${templates === 1 ? 'шаблон' : templates < 5 ? 'шаблона' : 'шаблонов'} и ${skills} ${skills === 1 ? 'навык' : skills < 5 ? 'навыка' : 'навыков'}. Элементы библиотеки остались.`,
  kept: (count: number, ids: string) => `${count} ${count === 1 ? 'изменённый вами элемент остаётся' : 'изменённых вами элемента остаются'}: ${ids}`,
  undo: (trashId: string) => `Отмена в течение 24 часов: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `Восстановлен ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `У ${name} нет гида по стилю. Сохраните его командой cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Гид по стилю ${name} сохранён (${chars} / ${limit} символов)`,
  styleRemoved: (name: string) => `Гид по стилю ${name} удалён`,
  takesEffect: 'Вступает в силу с новой сессии агента.',
  idFormat: (value: string) => `Это не ID пака (строчные латинские буквы, цифры и одиночные дефисы): ${value}`,

  // Export
  exportNeedsName: 'Дайте паку название через --name.',
  exportNoId: (name: string) => `Не удаётся создать ID из «${name}»; укажите его через --id.`,
  libraryFormat: (value: string) => `Это не элемент библиотеки (glossaries:<entryId> или brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `Записано ${dir}: ${files} ${files === 1 ? 'файл' : files < 5 ? 'файла' : 'файлов'}, ${bytes} байт. Отправьте папку как есть, загрузите её на GitHub или раздавайте с любого статического хостинга.`,
  exportedCheck: (dir: string) => `Прочитать обратно: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Не удаётся прочитать ${file}: ${reason}`,
};
