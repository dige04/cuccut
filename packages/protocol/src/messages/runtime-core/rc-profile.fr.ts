import type { RcProfileMessages } from './rc-profile.ts';

export const fr: RcProfileMessages = {
  readOnly: 'Le profil a été enregistré par une version plus récente de CucCut : il est affiché ici mais n’est pas modifié',
  projectNotFound: 'Projet introuvable',
  projectUnavailable: 'Le dossier du projet est absent ou inscriptible, donc ses règles et préférences ne peuvent pas être enregistrées',
  projectTextOnly: 'Un projet a un seul texte de préférences, défini comme propre. La section de l’entretien n’existe qu’au niveau de l’espace de travail',
  noAnswers: 'Réponds à au moins une question, ou passe.',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'Noms issus de l’entretien',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `La règle n’a pas été enregistrée : ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `Règle introuvable : ${p.id}`,
  ruleOrder: 'Le nouvel ordre doit lister chaque règle de ce niveau exactement une fois',
  ruleLimit: (p: { limit: number }) => `Un niveau contient au plus ${p.limit} règles`,
  templateMissing: (p: { id: string }) => `Le modèle « ${p.id} » n’est pas installé. La règle a été enregistrée ; l’agent ignore le modèle tant qu’il n’est pas installé`,
  problemSeparator: ' ; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field} : ${p.problem}`,
  fieldId: 'Id',
  fieldName: 'Nom de la règle',
  fieldWhen: 'Quand',
  fieldInstruction: 'Instruction',
  fieldTemplate: 'Modèle',
  fieldNote: 'Note',
  fieldOrder: 'Ordre',
  required: 'obligatoire',
  tooLong: (p: { limit: number }) => `plus long que ${p.limit} caractères`,
  badId: 'utilise des lettres minuscules, des chiffres et des tirets, commence par une lettre ou un chiffre, 64 caractères au plus',
  badTemplateId: 'n’est pas un identifiant de modèle (lettres minuscules et chiffres, reliés par des tirets simples)',
  badOrder: 'doit être un nombre entier',
  needInstructionOrTemplate: 'donne une instruction ou choisis un modèle',

  // A write from the answers (profile-writer)
  writeBusy: 'Les préférences sont déjà en cours d’écriture à partir des réponses. Attends la fin de cette écriture',
  writeStopped: 'CucCut se ferme, donc les préférences n’ont pas été écrites. Tes réponses sont enregistrées',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'Cette session n’appartient à aucun projet, il n’y a donc pas de niveau projet. Utilise le niveau workspace, ou ouvre une session dans le projet',
  levelWorkspace: 'pour chaque projet',
  levelProject: (p: { name: string }) => `pour le projet ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `Enregistrer les réponses à l’entretien : ${p.questions}`,
  toolSkipSummary: 'Passer l’entretien (les réponses sont conservées)',
  toolWriteSummary: 'Écrire tes préférences à partir des réponses à l’entretien',
  toolPreferencesAppend: (p: { where: string; text: string }) => `Ajouter à tes préférences ${p.where} : ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `Remplacer tes préférences ${p.where} par : ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `Enregistrer la règle « ${p.name} » ${p.where} : quand ${p.when}, ${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `utiliser le modèle ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `Supprimer la règle « ${p.name} » ${p.where}`,
};
