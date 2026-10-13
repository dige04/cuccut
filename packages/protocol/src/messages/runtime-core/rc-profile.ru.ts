import type { RcProfileMessages } from './rc-profile.ts';

export const ru: RcProfileMessages = {
  readOnly: 'Профиль сохранён более новой версией CucCut, поэтому он показан здесь, но не изменяется',
  projectNotFound: 'Проект не найден',
  projectUnavailable: 'Папка проекта отсутствует или в неё нельзя записать, поэтому его правила и настройки не могут быть сохранены',
  projectTextOnly: 'У проекта есть один текст настроек, указанный как собственный. Раздел опроса существует только на уровне рабочей области',
  noAnswers: 'Ответьте хотя бы на один вопрос или пропустите опрос.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Имена из опроса',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `Правило не сохранено: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Правило не найдено: ${p.id}`,
  ruleOrder: 'В новом порядке каждое правило этого уровня должно быть указано ровно один раз',
  ruleLimit: (p: { limit: number }) => `На одном уровне может быть не более ${p.limit} правил`,
  templateMissing: (p: { id: string }) => `Шаблон «${p.id}» не установлен. Правило сохранено; агент пропускает шаблон, пока он не будет установлен`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Название правила',
  fieldWhen: 'Когда',
  fieldInstruction: 'Инструкция',
  fieldTemplate: 'Шаблон',
  fieldNote: 'Заметка',
  fieldOrder: 'Порядок',
  required: 'обязательно',
  tooLong: (p: { limit: number }) => `длиннее ${p.limit} символов`,
  badId: 'используйте строчные буквы, цифры и дефисы, начиная с буквы или цифры, не больше 64 символов',
  badTemplateId: 'не является идентификатором шаблона (строчные буквы и цифры, соединённые одиночными дефисами)',
  badOrder: 'должно быть целым числом',
  needInstructionOrTemplate: 'укажите инструкцию или выберите шаблон',

  // A write from the answers (profile-writer)
  writeBusy: 'Настройки уже записываются по ответам. Дождитесь окончания этой записи',
  writeStopped: 'CucCut закрывается, поэтому настройки не были записаны. Ваши ответы сохранены',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Эта сессия не относится к проекту, поэтому уровня проекта нет. Используйте уровень workspace или откройте сессию в проекте',
  levelWorkspace: 'для каждого проекта',
  levelProject: (p: { name: string }) => `для проекта ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Сохранить ответы на опрос: ${p.questions}`,
  toolSkipSummary: 'Пропустить опрос (ответы сохраняются)',
  toolWriteSummary: 'Записать ваши настройки по ответам на опрос',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Добавить в ваши настройки ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Заменить ваши настройки ${p.where} на: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Сохранить правило «${p.name}» ${p.where}: когда ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `использовать шаблон ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Удалить правило «${p.name}» ${p.where}`,
};
