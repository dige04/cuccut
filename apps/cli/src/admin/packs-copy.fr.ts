import type { PacksMessages } from './packs-copy.ts';

export const fr: PacksMessages = {
  packsHelp: `Utilisation :
  cuccut packs inspect <source>    Lit un pack et affiche tout ce qu'il contient, sans l'installer.
                                   <source> : un dossier, une adresse GitHub (owner/repo, une URL de dépôt ou
                                   …/tree/<branch>/<folder>) ou une adresse https:// qui sert pack.json
  cuccut packs install <source>    Lit un pack et installe ses modèles, compétences, éléments de bibliothèque, guide
                                   de style et actions rapides
    --replace                      Remplace vos modèles et compétences portant les mêmes identifiants (ils vont à la
                                   corbeille) ; sans cette option, ils sont conservés et ignorés
  cuccut packs remove <id>         Supprime un pack : lui-même ainsi que les modèles et compétences qu'il a apportés
                                   vont à la corbeille pour 24 heures ; les éléments de bibliothèque et vos modifications restent
  cuccut packs restore <trashId>   Annule une suppression, dans les 24 heures
  cuccut packs style <id> [<file>|-]
                                   Affiche le guide de style du pack ; avec un fichier (ou - pour l'entrée standard),
                                   enregistre ce fichier comme guide (un fichier vide le supprime)
  cuccut packs export <folder> --name <name>
                                   Écrit un dossier de pack à partir de vos modèles, compétences et éléments de
                                   bibliothèque, avec l'index des fichiers, à envoyer tel quel, à pousser sur GitHub
                                   ou à servir depuis n'importe quel hébergement statique. Le dossier doit être vide ou être
                                   un export précédent du pack
    --id <id>                      L'identifiant du pack (par défaut : généré à partir du nom)
    --version <version>            Par défaut 1.0.0
    --author <name>, --description <text>
    --template <id>                Un modèle personnel (répétable)
    --skill <id>                   Une compétence non intégrée (répétable)
    --library <glossaries|brand>:<entryId>
                                   Un élément de bibliothèque (répétable) ; les voix restent
    --quick-actions <packId>       Les actions rapides d'un pack installé (répétable)
    --style-from <packId>          Le guide de style et les fichiers de référence d'un pack installé`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, par ${author}` : ''}`,
  notInstalled: 'Non installé : lisez-le d’abord.',
  installedVersion: (version: string) =>
    `La version ${version} est installée. Réinstaller met à jour ce que le pack possède et conserve vos modifications.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} ${templates === 1 ? 'modèle' : 'modèles'}` : '',
      skills ? `${skills} ${skills === 1 ? 'compétence' : 'compétences'}` : '',
      library ? `${library} ${library === 1 ? 'élément de bibliothèque' : 'éléments de bibliothèque'}` : '',
      style ? 'un guide de style' : '',
      quickActions ? `${quickActions} ${quickActions === 1 ? 'action rapide' : 'actions rapides'}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Rien de propre';
  },
  sectionTemplates: 'Modèles',
  sectionSkills: 'Compétences',
  sectionLibrary: 'Bibliothèque',
  sectionStyle: 'Guide de style : les agents le lisent avant de choisir et de modifier',
  sectionExamples: 'Fichiers de référence',
  sectionQuick: 'Actions rapides : messages envoyés à l’agent en un clic',
  sectionReserved: 'Règles et norme de relecture : conservées avec le pack ; CucCut ne les utilise pas encore',
  sectionWarnings: 'Avertissements',
  agentReads: 'Texte que suivra un agent. Lisez-le.',
  stateNew: 'nouveau',
  stateUpdate: 'met à jour la copie installée par ce pack',
  stateChanged: 'vous l’avez modifié depuis l’installation : conservé sauf avec --replace',
  stateExists: 'vous avez déjà un élément avec cet identifiant : le vôtre est conservé sauf avec --replace',
  stateBuiltin: 'un élément intégré porte cet identifiant, donc celui-ci n’est pas installé',
  skillFiles: (files: number) => `${files} ${files === 1 ? 'fichier' : 'fichiers'}`,
  duplicate: 'déjà dans votre bibliothèque ; non ajouté à nouveau',
  bytes: (bytes: number) => `${bytes} octets`,
  missingSkill: (template: string, skill: string) =>
    `${template} recommande la compétence « ${skill} », qui n’est ni sur cet ordinateur ni dans le pack`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, ligne ${line} : ${why}${text ? ` (« ${text} »)` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Ce pack ne sera pas installé : la ligne ${line} de ${file} ${why}${text ? ` (« ${text} »)` : ''}`,
  installHint: (source: string) => `Installez-le avec : cuccut packs install ${source}`,
  replaceHint: 'Ajoutez --replace pour remplacer vos propres éléments portant les mêmes identifiants.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `${name} v${version} installé : ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `${kind === 'template' ? 'Modèle' : kind === 'skill' ? 'Compétence' : 'Élément de bibliothèque'} ${id} ignoré : ${
      reason === 'builtin'
        ? 'un élément intégré porte cet identifiant'
        : reason === 'exists'
          ? 'vous avez le vôtre avec cet identifiant (ajoutez --replace)'
          : 'vous l’avez modifié depuis l’installation (ajoutez --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name} supprimé : ${templates} ${templates === 1 ? 'modèle' : 'modèles'} et ${skills} ${skills === 1 ? 'compétence' : 'compétences'} ont disparu avec lui. Les éléments de bibliothèque restent.`,
  kept: (count: number, ids: string) => `${count} ${count === 1 ? 'élément modifié reste' : 'éléments modifiés restent'} : ${ids}`,
  undo: (trashId: string) => `Annuler dans les 24 heures : cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `${name} v${version} rétabli`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} n’a pas de guide de style. Enregistrez-en un avec cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Guide de style de ${name} enregistré (${chars} / ${limit} caractères)`,
  styleRemoved: (name: string) => `Guide de style de ${name} supprimé`,
  takesEffect: 'Prend effet à partir de la prochaine nouvelle session d’agent.',
  idFormat: (value: string) => `Ce n’est pas un identifiant de pack (lettres minuscules, chiffres et tirets simples) : ${value}`,

  // Export
  exportNeedsName: 'Donnez un nom au pack avec --name.',
  exportNoId: (name: string) => `Impossible de créer un identifiant à partir de « ${name} » ; indiquez-en un avec --id.`,
  libraryFormat: (value: string) => `Ce n’est pas un élément de bibliothèque (glossaries:<entryId> ou brand:<entryId>) : ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `${dir} écrit : ${files} ${files === 1 ? 'fichier' : 'fichiers'}, ${bytes} octets. Envoyez le dossier tel quel, poussez-le sur GitHub ou servez-le depuis n’importe quel hébergement statique.`,
  exportedCheck: (dir: string) => `Relisez-le avec : cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Impossible de lire ${file} : ${reason}`,
};
