import { pluralForm } from '@cuccut/protocol';
import type { WorkspaceMessages } from './workspace-copy.ts';

export const ru: WorkspaceMessages = {
  aside: 'Всё здесь действует для всех проектов',
  generalBlurb: 'Как выглядит CucCut и на каком языке говорит, куда сохраняются загрузки и что он может получать из интернета.',
  shortcutsBlurb: 'Клавиши, которые работают в любом месте CucCut. Сочетания клавиш редактора — в Справке (F1).',
  shortcutsPanel: 'В любом месте CucCut',
  fontsBlurb: 'Шрифты для субтитров и заголовков: откуда они берутся и какие уже есть на этом компьютере.',
  privacyBlurb: 'Что остаётся на этом компьютере, что можно отправлять облачным провайдерам и что агенты могут делать без спроса.',
  diagnosticsBlurb: 'Локальный Runtime, его журналы и то, сколько ресурсов компьютера могут занимать фоновые задачи.',
  aboutBlurb: 'Версии приложения, интерфейса и Runtime, а также то, как обновляется CucCut.',
  checking: 'Проверка…',
  noAgent: 'Нет готового агента',
  shortcutCount: (n) => pluralForm('ru', n, { one: `${n} сочетание`, few: `${n} сочетания`, many: `${n} сочетаний`, other: `${n} сочетания` }),
  skillCount: (n) => (n === 0 ? 'Пока нет' : pluralForm('ru', n, { one: `${n} навык`, few: `${n} навыка`, many: `${n} навыков`, other: `${n} навыка` })),
  glossaryCount: (n) => (n === 0 ? 'Пока нет' : pluralForm('ru', n, { one: `${n} глоссарий`, few: `${n} глоссария`, many: `${n} глоссариев`, other: `${n} глоссария` })),
  grantCount: (n) =>
    n === 0 ? 'Нет действующих разрешений' : pluralForm('ru', n, { one: `${n} действующее разрешение`, few: `${n} действующих разрешения`, many: `${n} действующих разрешений`, other: `${n} действующего разрешения` }),
  runtimeOn: 'Runtime подключён',
  runtimeOff: 'Runtime не подключён',
  installed: (n) => (n === 0 ? 'Ничего не установлено' : `Установлено: ${n}`),
  noDefault: 'По умолчанию не задано',
  version: (version) => `Версия ${version}`,
  desktopOnly: 'Только в настольном приложении',
  notYet: 'Пока недоступно',
  loadFailed: 'Не удалось загрузить',
  fontsSummary: 'Для субтитров и заголовков',
  packsBlurb:
    'A way of making videos that travels: templates, skills, library items and a style guide in one folder. Import one from a folder, GitHub or a web address, or export yours to send.',
  packCount: (n: number) => (n === 0 ? 'None installed' : n === 1 ? '1 pack' : `${n} packs`),
};
