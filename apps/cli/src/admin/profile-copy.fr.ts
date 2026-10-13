import type { ProfileMessages } from './profile-copy.ts';

export const fr: ProfileMessages = {
  help: `Utilisation :
  cuccut profile show [--project <id>]
                                   Ce que CucCut sait de toi : l’entretien, tes préférences, tes règles
                                   et les noms à écrire correctement ; avec un projet (--project, ou le projet
                                   du dossier courant), aussi les préférences et règles de ce projet
  cuccut profile answers set <question> <text>
                                   Enregistrer une réponse d’entretien (who, record, platforms, annoys, names) ;
                                   un texte vide l’efface
  cuccut profile interview skip|reopen|write
                                   Passer l’entretien, le rouvrir, ou écrire tes préférences à partir des
                                   réponses avec ton agent par défaut (sans agent, les réponses sont gardées telles quelles)
  cuccut profile preferences [--project <id>] --file <md>
                                   Remplacer tes préférences, ou celles du projet, par un fichier Markdown
                                   (--file - lit l’entrée standard) ; la section écrite par l’entretien reste
  cuccut profile rules list [--project <id>]
                                   Tes règles (ou celles du projet) dans l’ordre de lecture
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   Les règles sont lues dans l’ordre ; quand deux se contredisent, la dernière l’emporte
Les agents lisent le profil au démarrage d’une session ; les sessions déjà ouvertes gardent ce qu’elles avaient.`,

  // Arguments
  badQuestion: (value: string, ids: string) => `Ce n’est pas une question d’entretien : ${value} (utilise l’une de : ${ids})`,
  needFile: 'Donne les préférences sous forme de fichier Markdown : --file <md>, ou --file - pour l’entrée standard',
  badMove: (value: string) => `Monte une règle, descends-la ou place-la à une position (1 est la première) : ${value}`,
  ruleMissing: (id: string) => `Aucune règle ${id} à ce niveau (voir cuccut profile rules list)`,
  projectMissing: (id: string) => `Aucun projet ${id} (voir cuccut projects list)`,
  stdinPrompt: 'Saisis ou colle les préférences, puis appuie sur Ctrl-D :',

  // show
  questionWho: 'Que crées-tu, et pour qui ?',
  questionRecord: 'Que filmes-tu habituellement ?',
  questionPlatforms: 'Où ça part, et combien de temps doit durer une vidéo ?',
  questionAnnoys: 'Qu’est-ce qui t’agace dans tes vidéos aujourd’hui ?',
  questionNames: 'Noms à écrire correctement',
  interviewLine: (status: string, answered: number, total: number) => `Entretien : ${status}, ${answered} réponses sur ${total}`,
  statusPending: 'pas encore fait',
  statusSkipped: 'passé',
  statusDone: 'terminé',
  answerLine: (question: string, answer: string) => `  ${question} : ${answer}`,
  unanswered: '—',
  generalHeading: 'Tes préférences',
  interviewHeading: 'Ce qu’a écrit l’entretien',
  projectHeading: (name: string) => `Préférences pour ${name}`,
  noText: '  (aucune)',
  rulesHeading: 'Règles',
  projectRulesHeading: (name: string) => `Règles pour ${name}`,
  noRules: '  Aucune règle pour l’instant',
  namesLine: (names: string) => `Noms à écrire correctement : ${names}`,
  readOnly: 'Le profil a été enregistré par une version plus récente de CucCut : il est affiché, mais les modifications sont refusées',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (désactivée)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   Quand : ${when}`,
  ruleDo: (instruction: string) => `   Faire : ${instruction}`,
  ruleTemplate: (id: string) => `   Modèle : ${id}`,
  stageAny: 'choix et montage',
  stageClip: 'choix des clips',
  stageEdit: 'montage',
  ruleEnabled: (name: string) => `Activée : ${name}`,
  ruleDisabled: (name: string) => `Désactivée : ${name}`,
  ruleRemoved: (name: string, id: string) => `« ${name} » supprimée (${id})`,
  ruleMoved: (name: string, position: number, total: number) => `« ${name} » déplacée à la position ${position} sur ${total}`,

  // Writes
  answerSaved: (question: string) => `Réponse à « ${question} » enregistrée`,
  answerCleared: (question: string) => `Réponse à « ${question} » effacée`,
  interviewSkipped: 'Entretien passé ; les réponses sont conservées',
  interviewReopened: 'L’entretien est de nouveau ouvert, avec les réponses précédentes',
  writing: 'Écriture de tes préférences à partir des réponses. Cela prend un moment…',
  writtenByAgent: 'Préférences écrites à partir de tes réponses :',
  keptAsTyped: (reason: string) => `Tes réponses ont été gardées telles que tu les as saisies (${reason}) :`,
  reasonNoAgent: 'aucun agent n’est installé et connecté',
  reasonAgentFailed: 'l’exécution de l’agent ne s’est pas terminée',
  reasonBadOutput: 'la sortie de l’agent n’était pas exploitable',
  namesAdded: (names: string) => `Noms ajoutés au glossaire : ${names}`,
  preferencesSaved: (chars: number) => `Tes préférences ont été enregistrées (${chars} caractères)`,
  projectPreferencesSaved: (name: string, chars: number) => `Préférences de ${name} enregistrées (${chars} caractères)`,
  takesEffect: 'Les agents lisent ceci au démarrage d’une session ; les sessions déjà ouvertes gardent ce qu’elles avaient',
};
