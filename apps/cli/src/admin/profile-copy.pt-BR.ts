import type { ProfileMessages } from './profile-copy.ts';

export const ptBR: ProfileMessages = {
  help: `Uso:
  cuccut profile show [--project <id>]
                                   O que o CucCut sabe sobre você: a entrevista, suas preferências, suas regras
                                   e os nomes a escrever corretamente; com um projeto (--project, ou o projeto da
                                   pasta atual), também as preferências e regras desse projeto
  cuccut profile answers set <question> <text>
                                   Salvar uma resposta da entrevista (who, record, platforms, annoys, names);
                                   um texto vazio a apaga
  cuccut profile interview skip|reopen|write
                                   Pular a entrevista, reabri-la, ou escrever suas preferências a partir das respostas
                                   com o seu agente padrão (sem agente, as respostas são mantidas como foram digitadas)
  cuccut profile preferences [--project <id>] --file <md>
                                   Substituir suas preferências, ou as do projeto, por um arquivo Markdown
                                   (--file - lê a entrada padrão); a seção escrita pela entrevista permanece
  cuccut profile rules list [--project <id>]
                                   Suas regras (ou as do projeto) na ordem em que são lidas
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   As regras são lidas em ordem; quando duas discordam, a última vence
Os agentes leem o perfil quando uma sessão começa; sessões já abertas mantêm o que tinham.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Não é uma pergunta da entrevista: ${value} (use uma de: ${ids})`,
  needFile: 'Informe as preferências como arquivo Markdown: --file <md>, ou --file - para a entrada padrão',
  badMove: (value: string) => `Mova uma regra para cima, para baixo ou para uma posição (1 é a primeira): ${value}`,
  ruleMissing: (id: string) => `Nenhuma regra ${id} neste nível (veja cuccut profile rules list)`,
  projectMissing: (id: string) => `Nenhum projeto ${id} (veja cuccut projects list)`,
  stdinPrompt: 'Digite ou cole as preferências e depois pressione Ctrl-D:',

  // show
  questionWho: 'O que você produz, e para quem é?',
  questionRecord: 'O que você costuma gravar?',
  questionPlatforms: 'Onde vai parar, e quanto tempo deve durar?',
  questionAnnoys: 'O que incomoda nos seus vídeos hoje?',
  questionNames: 'Nomes que precisam estar escritos corretamente',
  interviewLine: (status: string, answered: number, total: number) => `Entrevista: ${status}, ${answered} de ${total} respondidas`,
  statusPending: 'ainda não feita',
  statusSkipped: 'pulada',
  statusDone: 'concluída',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Suas preferências',
  interviewHeading: 'O que a entrevista escreveu',
  projectHeading: (name: string) => `Preferências de ${name}`,
  noText: '  (nenhuma)',
  rulesHeading: 'Regras',
  projectRulesHeading: (name: string) => `Regras de ${name}`,
  noRules: '  Nenhuma regra ainda',
  namesLine: (names: string) => `Nomes a escrever corretamente: ${names}`,
  readOnly: 'O perfil foi salvo por uma versão mais recente do CucCut: ele é exibido, mas as alterações são recusadas',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (desligada)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Quando: ${when}`,
  ruleDo: (instruction: string) => `   Fazer: ${instruction}`,
  ruleTemplate: (id: string) => `   Modelo: ${id}`,
  stageAny: 'escolher e editar',
  stageClip: 'escolher clipes',
  stageEdit: 'editar',
  ruleEnabled: (name: string) => `Ligada: ${name}`,
  ruleDisabled: (name: string) => `Desligada: ${name}`,
  ruleRemoved: (name: string, id: string) => `${name} removida (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `${name} movida para a posição ${position} de ${total}`,

  // Writes
  answerSaved: (question: string) => `Resposta para "${question}" salva`,
  answerCleared: (question: string) => `Resposta para "${question}" apagada`,
  interviewSkipped: 'Entrevista pulada; as respostas são mantidas',
  interviewReopened: 'A entrevista está aberta de novo, com as respostas anteriores',
  writing: 'Escrevendo suas preferências a partir das respostas. Isso leva um momento…',
  writtenByAgent: 'Preferências escritas a partir das suas respostas:',
  keptAsTyped: (reason: string) => `Suas respostas foram mantidas como foram digitadas (${reason}):`,
  reasonNoAgent: 'nenhum agente está instalado e conectado',
  reasonAgentFailed: 'a execução do agente não terminou',
  reasonBadOutput: 'a saída do agente não pôde ser usada',
  namesAdded: (names: string) => `Nomes adicionados ao glossário: ${names}`,
  preferencesSaved: (chars: number) => `Preferências salvas (${chars} caracteres)`,
  projectPreferencesSaved: (name: string, chars: number) => `Preferências de ${name} salvas (${chars} caracteres)`,
  takesEffect: 'Os agentes leem isto quando uma sessão começa; as sessões já abertas mantêm o que tinham',
};
