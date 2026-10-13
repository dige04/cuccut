import type { ProfileMessages } from './profile-copy.ts';

export const ru: ProfileMessages = {
  help: `Использование:
  cuccut profile show [--project <id>]
                                   Что CucCut знает о вас: опрос, ваши настройки, ваши правила
                                   и имена, которые нужно писать правильно; с проектом (--project или проектом
                                   текущей папки) также настройки и правила этого проекта
  cuccut profile answers set <question> <text>
                                   Сохранить один ответ опроса (who, record, platforms, annoys, names);
                                   пустой текст удаляет ответ
  cuccut profile interview skip|reopen|write
                                   Пропустить опрос, открыть его снова или записать ваши настройки по ответам
                                   агентом по умолчанию (без агента ответы сохраняются как введены)
  cuccut profile preferences [--project <id>] --file <md>
                                   Заменить ваши настройки или настройки проекта файлом Markdown
                                   (--file - читает стандартный ввод); раздел, записанный опросом, сохраняется
  cuccut profile rules list [--project <id>]
                                   Ваши правила (или правила проекта) в порядке их чтения
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Правила читаются по порядку; если два противоречат друг другу, побеждает последнее
Агенты читают профиль при запуске сессии; уже открытые сессии сохраняют то, что у них было.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Нет такого вопроса опроса: ${value} (используйте один из: ${ids})`,
  needFile: 'Укажите настройки файлом Markdown: --file <md> или --file - для стандартного ввода',
  badMove: (value: string) => `Переместите правило вверх, вниз или на позицию (1 — первое): ${value}`,
  ruleMissing: (id: string) => `Правила ${id} на этом уровне нет (см. cuccut profile rules list)`,
  projectMissing: (id: string) => `Проекта ${id} нет (см. cuccut projects list)`,
  stdinPrompt: 'Введите или вставьте настройки, затем нажмите Ctrl-D:',

  // show
  questionWho: 'Что вы создаёте и для кого?',
  questionRecord: 'Что вы обычно записываете?',
  questionPlatforms: 'Где это публикуется и какой должна быть длина?',
  questionAnnoys: 'Что сегодня раздражает вас в ваших видео?',
  questionNames: 'Имена, которые нужно писать правильно',
  interviewLine: (status: string, answered: number, total: number) => `Опрос: ${status}, отвечено ${answered} из ${total}`,
  statusPending: 'ещё не пройден',
  statusSkipped: 'пропущен',
  statusDone: 'пройден',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Ваши настройки',
  interviewHeading: 'Что записал опрос',
  projectHeading: (name: string) => `Настройки для ${name}`,
  noText: '  (нет)',
  rulesHeading: 'Правила',
  projectRulesHeading: (name: string) => `Правила для ${name}`,
  noRules: '  Правил пока нет',
  namesLine: (names: string) => `Имена, которые нужно писать правильно: ${names}`,
  readOnly: 'Профиль сохранён более новой версией CucCut: он показан, но изменения отклоняются',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (выкл.)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Когда: ${when}`,
  ruleDo: (instruction: string) => `   Делать: ${instruction}`,
  ruleTemplate: (id: string) => `   Шаблон: ${id}`,
  stageAny: 'выбор и монтаж',
  stageClip: 'выбор клипов',
  stageEdit: 'монтаж',
  ruleEnabled: (name: string) => `Включено: ${name}`,
  ruleDisabled: (name: string) => `Выключено: ${name}`,
  ruleRemoved: (name: string, id: string) => `Удалено правило ${name} (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `Правило ${name} перемещено на позицию ${position} из ${total}`,

  // Writes
  answerSaved: (question: string) => `Ответ на «${question}» сохранён`,
  answerCleared: (question: string) => `Ответ на «${question}» удалён`,
  interviewSkipped: 'Опрос пропущен; ответы сохранены',
  interviewReopened: 'Опрос снова открыт, с прежними ответами',
  writing: 'Запись ваших настроек по ответам. Это займёт немного времени…',
  writtenByAgent: 'Настройки записаны по вашим ответам:',
  keptAsTyped: (reason: string) => `Ваши ответы сохранены так, как вы их ввели (${reason}):`,
  reasonNoAgent: 'агент не установлен и не вошёл в систему',
  reasonAgentFailed: 'работа агента не была завершена',
  reasonBadOutput: 'результат агента нельзя было использовать',
  namesAdded: (names: string) => `Имена добавлены в глоссарий: ${names}`,
  preferencesSaved: (chars: number) => `Настройки сохранены (${chars} символов)`,
  projectPreferencesSaved: (name: string, chars: number) => `Настройки для ${name} сохранены (${chars} символов)`,
  takesEffect: 'Агенты читают это при запуске сессии; уже открытые сессии сохраняют то, что у них было',
};
