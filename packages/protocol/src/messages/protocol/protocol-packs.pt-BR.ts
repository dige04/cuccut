import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const ptBR: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'O pack.json deve conter um único objeto JSON',
  formatMissing: 'O pack.json não tem "format": "cuccut.pack", então não é um pacote do CucCut',
  foreignFormat: 'Este é um pacote do agentcut: o pack.json dele não tem o campo "format". O CucCut lê apenas pastas cuccut.pack',
  otherFormat: (p: { format: string }) => `O pack.json diz que o formato é "${p.format}", não "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `O esquema de pacote ${p.schema} não é compatível; esta versão do CucCut lê o esquema 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" não é compatível: os pacotes não trazem código nesta versão do CucCut`,
  idChars: 'O id de um pacote são letras minúsculas, dígitos e hífens simples, e começa com uma letra',
  idReserved: (p: { id: string }) => `"${p.id}" é um nome reservado e não pode ser usado como id de pacote`,
  versionChars: 'Uma versão são letras, dígitos, pontos, hífens e sinais de mais',
  templateIdChars: 'O id de um modelo são letras minúsculas, dígitos e hífens simples, e começa com uma letra',
  ruleIdChars: 'O id de uma regra são letras minúsculas, dígitos e hífens simples',
  duplicateTemplates: 'O mesmo modelo está nomeado duas vezes',
  duplicateSkills: 'A mesma habilidade está nomeada duas vezes',
  duplicateLibrary: 'O mesmo arquivo da biblioteca está nomeado duas vezes',
  duplicateExamples: 'O mesmo arquivo de referência está nomeado duas vezes',
  duplicateQuickActions: 'Duas ações rápidas têm o mesmo rótulo',
  duplicateRules: 'A mesma regra está nomeada duas vezes',
  duplicateFiles: 'O mesmo arquivo está listado duas vezes em files',
  libraryDir: (p: { dir: string }) => `Os arquivos da biblioteca ficam em ${p.dir}/`,
  libraryVoice: 'Vozes não podem viajar em um pacote: uma voz precisa do consentimento do dono',
  examplesDir: (p: { dir: string }) => `Os arquivos de referência ficam em ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `Uma referência de ${p.kind} é uma destas: ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `Uma imagem fixa é uma imagem: ${p.extensions}`,
  styleFile: 'O guia de estilo é um arquivo Markdown (.md) na raiz do pacote',
  reviewFile: 'O padrão de revisão é um arquivo JSON na raiz do pacote',
  sha256Hex: 'sha256 são 64 dígitos hexadecimais minúsculos',

  // Paths inside a pack
  pathRelative: 'O caminho deve ser relativo à pasta do pacote',
  pathHidden: 'Caminhos de pacote não podem citar arquivos ou pastas ocultos (que começam com ponto)',
  fileNotNamed: (p: { path: string }) => `${p.path} não está nomeado no pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `Tem ${p.length} caracteres; um guia de estilo comporta no máximo ${p.limit}`,
  whyIgnoreInstructions: 'manda o agente ignorar as instruções dele',
  whyChangeIdentity: 'tenta mudar quem o agente é',
  whyRevealSecrets: 'pede segredos ou o prompt',
  whyCredential: 'contém uma credencial',
  whyCommand: 'contém um comando a executar',
  whyDeleteWork: 'pede ao agente que apague trabalho',
  whySendUrl: 'pede ao agente que envie algo para um endereço web',
  whyPromptBoundary: 'imita um limite de prompt',
};
