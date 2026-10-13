import type { RailMessages } from './rail-copy.ts';

export const ru: RailMessages = {
  running: (n: number) => `Выполняется: ${n}`,
  finished: (n: number) => `Завершено: ${n}`,
  nothingYet: 'Пока ничего',
  tasksBlurb: 'Расшифровка, перевод, экспорт и работа агентов — в одном списке. Откройте задачу, чтобы увидеть её шаги и результаты.',
  toolCount: (n: number) => `Инструментов: ${n}`,
  moreFinished: (n: number) => `Ещё ${n} — во «Всех задачах»`,
};
