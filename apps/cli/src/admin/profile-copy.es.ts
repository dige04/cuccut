import type { ProfileMessages } from './profile-copy.ts';

export const es: ProfileMessages = {
  help: `Uso:
  cuccut profile show [--project <id>]
                                   Lo que CucCut sabe de ti: la entrevista, tus preferencias, tus reglas
                                   y los nombres que hay que escribir bien; con un proyecto (--project, o el proyecto
                                   de la carpeta actual), también las preferencias y reglas de ese proyecto
  cuccut profile answers set <question> <text>
                                   Guardar una respuesta de la entrevista (who, record, platforms, annoys, names);
                                   un texto vacío la borra
  cuccut profile interview skip|reopen|write
                                   Omitir la entrevista, volver a abrirla, o escribir tus preferencias a partir de las
                                   respuestas con tu agente predeterminado (sin agente, las respuestas se conservan tal como se escribieron)
  cuccut profile preferences [--project <id>] --file <md>
                                   Reemplazar tus preferencias, o las del proyecto, con un archivo Markdown
                                   (--file - lee la entrada estándar); la sección escrita por la entrevista se mantiene
  cuccut profile rules list [--project <id>]
                                   Tus reglas (o las del proyecto) en el orden en que se leen
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Las reglas se leen en orden; cuando dos se contradicen, gana la posterior
Los agentes leen el perfil al empezar una sesión; las sesiones ya abiertas conservan lo que tenían.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `No es una pregunta de la entrevista: ${value} (usa una de: ${ids})`,
  needFile: 'Indica las preferencias como archivo Markdown: --file <md>, o --file - para la entrada estándar',
  badMove: (value: string) => `Mueve una regla arriba, abajo o a una posición (1 es la primera): ${value}`,
  ruleMissing: (id: string) => `No hay ninguna regla ${id} en este nivel (consulta cuccut profile rules list)`,
  projectMissing: (id: string) => `No hay ningún proyecto ${id} (consulta cuccut projects list)`,
  stdinPrompt: 'Escribe o pega las preferencias y luego pulsa Ctrl-D:',

  // show
  questionWho: '¿Qué creas y para quién es?',
  questionRecord: '¿Qué grabas normalmente?',
  questionPlatforms: '¿Dónde se publica y cuánto debe durar?',
  questionAnnoys: '¿Qué te molesta de tus vídeos actuales?',
  questionNames: 'Nombres que deben escribirse bien',
  interviewLine: (status: string, answered: number, total: number) => `Entrevista: ${status}, ${answered} de ${total} respondidas`,
  statusPending: 'aún no realizada',
  statusSkipped: 'omitida',
  statusDone: 'completada',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'Tus preferencias',
  interviewHeading: 'Lo que escribió la entrevista',
  projectHeading: (name: string) => `Preferencias de ${name}`,
  noText: '  (ninguna)',
  rulesHeading: 'Reglas',
  projectRulesHeading: (name: string) => `Reglas de ${name}`,
  noRules: '  Todavía no hay reglas',
  namesLine: (names: string) => `Nombres que hay que escribir bien: ${names}`,
  readOnly: 'El perfil lo guardó una versión más reciente de CucCut: se muestra, pero no se aceptan cambios',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (desactivada)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Cuando: ${when}`,
  ruleDo: (instruction: string) => `   Hacer: ${instruction}`,
  ruleTemplate: (id: string) => `   Plantilla: ${id}`,
  stageAny: 'elegir y editar',
  stageClip: 'elegir clips',
  stageEdit: 'editar',
  ruleEnabled: (name: string) => `Activada: ${name}`,
  ruleDisabled: (name: string) => `Desactivada: ${name}`,
  ruleRemoved: (name: string, id: string) => `Eliminada ${name} (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `Movida ${name} a la posición ${position} de ${total}`,

  // Writes
  answerSaved: (question: string) => `Respuesta a «${question}» guardada`,
  answerCleared: (question: string) => `Respuesta a «${question}» borrada`,
  interviewSkipped: 'Entrevista omitida; las respuestas se conservan',
  interviewReopened: 'La entrevista está abierta de nuevo, con las respuestas anteriores',
  writing: 'Escribiendo tus preferencias a partir de las respuestas. Esto tarda un momento…',
  writtenByAgent: 'Preferencias escritas a partir de tus respuestas:',
  keptAsTyped: (reason: string) => `Tus respuestas se conservaron tal como las escribiste (${reason}):`,
  reasonNoAgent: 'no hay ningún agente instalado e iniciado sesión',
  reasonAgentFailed: 'la ejecución del agente no terminó',
  reasonBadOutput: 'la salida del agente no se pudo usar',
  namesAdded: (names: string) => `Nombres añadidos al glosario: ${names}`,
  preferencesSaved: (chars: number) => `Preferencias guardadas (${chars} caracteres)`,
  projectPreferencesSaved: (name: string, chars: number) => `Preferencias de ${name} guardadas (${chars} caracteres)`,
  takesEffect: 'Los agentes leen esto al empezar una sesión; las sesiones ya abiertas conservan lo que tenían',
};
