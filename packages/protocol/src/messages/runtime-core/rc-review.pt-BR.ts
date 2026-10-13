import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const ptBR: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `Este vídeo ainda não atende ao seu padrão: ${p.count} ${s(p.count, 'achado interrompe', 'achados interrompem')} esta exportação`,
  blockedRemedy: 'Corrija o que está listado e exporte de novo, ou abra a revisão e mantenha um achado com um motivo.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} é ${p.value}, e o padrão pede ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `pelo menos ${p.min}`,
  limitAtMost: (p: { max: number }) => `no máximo ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `entre ${p.min} e ${p.max}`,
  limitYes: 'sim',
  limitNo: 'não',
  limitAny: 'qualquer valor',
  valueYes: 'sim',
  valueNo: 'não',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Diga o motivo: manter um achado ou rebaixar sua importância exige um motivo',
  reasonTooLong: (p: { limit: number }) => `Mantenha o motivo com menos de ${p.limit} caracteres`,
  unknownFinding: (p: { id: string }) => `O padrão deste vídeo não tem nenhuma verificação ou pergunta chamada “${p.id}”`,
  criteriaInvalid: 'O padrão tem problemas a corrigir antes de poder ser salvo',
  criteriaConflict: 'O padrão foi alterado em outro lugar; leia-o de novo e tente novamente',
  answersInvalid: 'As respostas não estão no formato esperado: uma entrada por pergunta, com um veredito e uma evidência',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Decisões de revisão',
  waiveLabel: (p: { id: string }) => `Manter “${p.id}”`,
  unwaiveLabel: (p: { id: string }) => `Voltar a exigir “${p.id}” pelo padrão`,
  severityLabel: (p: { id: string }) => `Alterar a importância de “${p.id}”`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'Você ainda não definiu um padrão, então estas são as verificações integradas.',
  reasonUser: 'Verificado pelo seu padrão (Configurações › Revisão).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'A revisão não chegou a esta pergunta.',
  evidenceMissing: 'Respondido com “atende” sem nada para ver.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return 'Respondido com “atende”, mas a evidência não é um momento dentro do vídeo.';
      case 'frame':
        return 'Respondido com “atende”, mas a evidência não é um quadro tirado deste vídeo.';
      case 'field':
        return 'Respondido com “atende”, mas a evidência não nomeia nada deste vídeo.';
      case 'quote':
        return 'Respondido com “atende”, mas a citação não está na transcrição ou nas legendas deste vídeo.';
      default:
        return 'Respondido com “atende”, mas a evidência não pode ser verificada.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Preencha ou remova as caixas de marcação antes de entregar.',
  builtinFixBlank: 'Cubra ou feche a lacuna onde não há nada na tela.',
  builtinFixTextEdge: 'Mova ou estreite o texto para que ele fique dentro do quadro.',
};
