import type { RcProfileMessages } from './rc-profile.ts';

export const ptBR: RcProfileMessages = {
  readOnly: 'O perfil foi salvo por uma versão mais recente do CucCut, então é mostrado aqui, mas não é alterado',
  projectNotFound: 'Projeto não encontrado',
  projectUnavailable: 'A pasta do projeto está ausente ou não pode ser gravada, então as regras e preferências dele não podem ser salvas',
  projectTextOnly: 'Um projeto tem um único texto de preferências, definido como próprio. A seção da entrevista existe apenas no nível do espaço de trabalho',
  noAnswers: 'Responda pelo menos uma pergunta ou pule.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Nomes da entrevista',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `A regra não foi salva: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Regra não encontrada: ${p.id}`,
  ruleOrder: 'A nova ordem precisa listar cada regra deste nível exatamente uma vez',
  ruleLimit: (p: { limit: number }) => `Um nível comporta no máximo ${p.limit} regras`,
  templateMissing: (p: { id: string }) => `O modelo "${p.id}" não está instalado. A regra foi salva; o agente ignora o modelo até que ele seja instalado`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Nome da regra',
  fieldWhen: 'Quando',
  fieldInstruction: 'Instrução',
  fieldTemplate: 'Modelo',
  fieldNote: 'Nota',
  fieldOrder: 'Ordem',
  required: 'obrigatório',
  tooLong: (p: { limit: number }) => `maior que ${p.limit} caracteres`,
  badId: 'use letras minúsculas, dígitos e hífens, começando com uma letra ou dígito, com no máximo 64 caracteres',
  badTemplateId: 'não é um id de modelo (letras minúsculas e dígitos, unidos por hífens simples)',
  badOrder: 'precisa ser um número inteiro',
  needInstructionOrTemplate: 'informe uma instrução ou escolha um modelo',

  // A write from the answers (profile-writer)
  writeBusy: 'As preferências já estão sendo escritas a partir das respostas. Aguarde essa gravação terminar',
  writeStopped: 'O CucCut está fechando, então as preferências não foram escritas. Suas respostas foram salvas',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Esta sessão não está em um projeto, então não há nível de projeto. Use o nível workspace ou abra uma sessão no projeto',
  levelWorkspace: 'para todos os projetos',
  levelProject: (p: { name: string }) => `para o projeto ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Salvar respostas da entrevista: ${p.questions}`,
  toolSkipSummary: 'Pular a entrevista (as respostas são mantidas)',
  toolWriteSummary: 'Escrever suas preferências a partir das respostas da entrevista',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Adicionar às suas preferências ${p.where}: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Substituir suas preferências ${p.where} por: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Salvar a regra "${p.name}" ${p.where}: quando ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `usar o modelo ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Remover a regra "${p.name}" ${p.where}`,
};
