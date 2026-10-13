import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const ru: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Это видео пока не соответствует вашему стандарту: ${p.count} ${s(p.count, 'замечание останавливает', 'замечаний останавливают')} этот экспорт`,
  blockedRemedy: 'Исправьте перечисленное и экспортируйте снова или откройте проверку и оставьте замечание с обоснованием без изменений.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric}: ${p.value}, а стандарт требует ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `не менее ${p.min}`,
  limitAtMost: (p: { max: number }) => `не более ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `от ${p.min} до ${p.max}`,
  limitYes: 'да',
  limitNo: 'нет',
  limitAny: 'любое значение',
  valueYes: 'да',
  valueNo: 'нет',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Укажите причину: оставить замечание без изменений или понизить его важность можно только с обоснованием',
  reasonTooLong: (p: { limit: number }) => `Сделайте обоснование короче ${p.limit} символов`,
  unknownFinding: (p: { id: string }) => `В стандарте этого видео нет проверки или вопроса с именем «${p.id}»`,
  criteriaInvalid: 'В стандарте есть проблемы, которые нужно исправить до сохранения',
  criteriaConflict: 'Стандарт был изменён в другом месте; прочитайте его заново и повторите попытку',
  answersInvalid: 'Ответы не в ожидаемом формате: одна запись на вопрос, с оценкой и доказательством',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Решения проверки',
  waiveLabel: (p: { id: string }) => `Оставить «${p.id}» без изменений`,
  unwaiveLabel: (p: { id: string }) => `Снова проверять «${p.id}» по стандарту`,
  severityLabel: (p: { id: string }) => `Изменить важность «${p.id}»`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Вы ещё не задали стандарт, поэтому применяются встроенные проверки.',
  reasonUser: 'Проверяется по вашему стандарту (Настройки › Проверка).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'Проверка не дошла до этого вопроса.',
  evidenceMissing: 'Ответ «соответствует» без чего-либо для проверки.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Ответ «соответствует», но доказательство — не момент внутри видео.';
      case 'frame':
        return 'Ответ «соответствует», но доказательство — не кадр из этого видео.';
      case 'field':
        return 'Ответ «соответствует», но доказательство ничего не называет в этом видео.';
      case 'quote':
        return 'Ответ «соответствует», но цитаты нет в тексте или субтитрах этого видео.';
      default:
        return 'Ответ «соответствует», но доказательство нельзя проверить.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Заполните или удалите блоки-заглушки перед сдачей.',
  builtinFixBlank: 'Закройте или заполните пустоту, где на экране ничего нет.',
  builtinFixTextEdge: 'Передвиньте или сузьте текст, чтобы он оставался в кадре.',
};
