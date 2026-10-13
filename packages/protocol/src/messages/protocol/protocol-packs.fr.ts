import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const fr: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json doit contenir un seul objet JSON',
  formatMissing: 'pack.json n’a pas de "format": "cuccut.pack", ce n’est donc pas un pack CucCut',
  foreignFormat: 'C’est un pack agentcut : son pack.json n’a pas de champ "format". CucCut ne lit que les dossiers cuccut.pack',
  otherFormat: (p: { format: string }) => `pack.json indique que son format est "${p.format}", et non "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Le schéma de pack ${p.schema} n’est pas pris en charge ; cette version de CucCut lit le schéma 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" n’est pas pris en charge : les packs ne contiennent pas de code dans cette version de CucCut`,
  idChars: 'L’identifiant d’un pack est composé de lettres minuscules, de chiffres et de tirets simples, et commence par une lettre',
  idReserved: (p: { id: string }) => `"${p.id}" est un nom réservé et ne peut pas servir d’identifiant de pack`,
  versionChars: 'Une version est composée de lettres, de chiffres, de points, de tirets et de signes plus',
  templateIdChars: 'L’identifiant d’un modèle est composé de lettres minuscules, de chiffres et de tirets simples, et commence par une lettre',
  ruleIdChars: 'L’identifiant d’une règle est composé de lettres minuscules, de chiffres et de tirets simples',
  duplicateTemplates: 'Le même modèle est nommé deux fois',
  duplicateSkills: 'La même compétence est nommée deux fois',
  duplicateLibrary: 'Le même fichier de bibliothèque est nommé deux fois',
  duplicateExamples: 'Le même fichier de référence est nommé deux fois',
  duplicateQuickActions: 'Deux actions rapides ont le même libellé',
  duplicateRules: 'La même règle est nommée deux fois',
  duplicateFiles: 'Le même fichier est listé deux fois dans files',
  libraryDir: (p: { dir: string }) => `Les fichiers de bibliothèque se trouvent sous ${p.dir}/`,
  libraryVoice: 'Les voix ne peuvent pas voyager dans un pack : une voix nécessite le consentement de son propriétaire',
  examplesDir: (p: { dir: string }) => `Les fichiers de référence se trouvent sous ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Une référence ${p.kind} est l’un de ces formats : ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Une image fixe est une image : ${p.extensions}`,
  styleFile: 'Le guide de style est un fichier Markdown (.md) à la racine du pack',
  reviewFile: 'La norme de relecture est un fichier JSON à la racine du pack',
  sha256Hex: 'sha256 est composé de 64 chiffres hexadécimaux en minuscules',

  // Paths inside a pack
  pathRelative: 'Le chemin doit être relatif au dossier du pack',
  pathHidden: 'Les chemins d’un pack ne peuvent pas désigner des fichiers ou dossiers cachés (commençant par un point)',
  fileNotNamed: (p: { path: string }) => `${p.path} n’est pas nommé dans pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Il fait ${p.length} caractères ; un guide de style en contient au maximum ${p.limit}`,
  whyIgnoreInstructions: 'demande à l’agent d’ignorer ses instructions',
  whyChangeIdentity: 'tente de changer l’identité de l’agent',
  whyRevealSecrets: 'demande des secrets ou le prompt',
  whyCredential: 'contient un identifiant de connexion',
  whyCommand: 'contient une commande à exécuter',
  whyDeleteWork: 'demande à l’agent de supprimer du travail',
  whySendUrl: 'demande à l’agent d’envoyer quelque chose à une adresse web',
  whyPromptBoundary: 'imite une limite de prompt',
};
