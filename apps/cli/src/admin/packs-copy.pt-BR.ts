import type { PacksMessages } from './packs-copy.ts';

export const ptBR: PacksMessages = {
  packsHelp: `Uso:
  cuccut packs inspect <source>    Lê um pacote e mostra tudo o que ele traz, sem instalá-lo.
                                   <source>: uma pasta, um endereço do GitHub (owner/repo, a URL de um
                                   repositório ou …/tree/<branch>/<folder>) ou um endereço https:// que sirva pack.json
  cuccut packs install <source>    Lê um pacote e instala seus modelos, habilidades, itens da biblioteca, guia
                                   de estilo e ações rápidas
    --replace                      Substitui seus próprios modelos e habilidades com os mesmos ids (eles vão para a
                                   lixeira); sem esta opção, são mantidos e ignorados
  cuccut packs remove <id>         Exclui um pacote: ele e os modelos e habilidades que trouxe vão para a lixeira
                                   por 24 horas; os itens da biblioteca e as suas alterações ficam
  cuccut packs restore <trashId>   Desfaz uma exclusão, em até 24 horas
  cuccut packs style <id> [<file>|-]
                                   Imprime o guia de estilo do pacote; com um arquivo (ou - para a entrada padrão),
                                   salva o arquivo como guia (um arquivo vazio o remove)
  cuccut packs export <folder> --name <name>
                                   Grava uma pasta de pacote com seus modelos, habilidades e itens da biblioteca,
                                   com o índice de arquivos, para enviar como está, enviar ao GitHub ou servir a partir
                                   de qualquer hospedagem estática. A pasta deve estar vazia ou ser uma exportação anterior do pacote
    --id <id>                      O id do pacote (padrão: gerado a partir do nome)
    --version <version>            Padrão 1.0.0
    --author <name>, --description <text>
    --template <id>                Um modelo seu (repetível)
    --skill <id>                   Uma habilidade que não é embutida (repetível)
    --library <glossaries|brand>:<entryId>
                                   Um item da biblioteca (repetível); as vozes ficam de fora
    --quick-actions <packId>       As ações rápidas de um pacote instalado (repetível)
    --style-from <packId>          O guia de estilo e os arquivos de referência de um pacote instalado`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, por ${author}` : ''}`,
  notInstalled: 'Não instalado: leia primeiro.',
  installedVersion: (version: string) =>
    `A versão ${version} está instalada. Instalar de novo atualiza o que o pacote possui e mantém o que você alterou.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} ${templates === 1 ? 'modelo' : 'modelos'}` : '',
      skills ? `${skills} ${skills === 1 ? 'habilidade' : 'habilidades'}` : '',
      library ? `${library} ${library === 1 ? 'item da biblioteca' : 'itens da biblioteca'}` : '',
      style ? 'um guia de estilo' : '',
      quickActions ? `${quickActions} ${quickActions === 1 ? 'ação rápida' : 'ações rápidas'}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Nada próprio';
  },
  sectionTemplates: 'Modelos',
  sectionSkills: 'Habilidades',
  sectionLibrary: 'Biblioteca',
  sectionStyle: 'Guia de estilo: os agentes leem antes de escolher e editar',
  sectionExamples: 'Arquivos de referência',
  sectionQuick: 'Ações rápidas: mensagens enviadas ao agente com um clique',
  sectionReserved: 'Regras e padrão de revisão: mantidos com o pacote; o CucCut ainda não os usa',
  sectionWarnings: 'Avisos',
  agentReads: 'Texto que um agente vai seguir. Leia.',
  stateNew: 'novo',
  stateUpdate: 'atualiza a cópia que este pacote instalou',
  stateChanged: 'você a alterou desde a instalação: mantida, a menos que use --replace',
  stateExists: 'você já tem uma com este id: a sua é mantida, a menos que use --replace',
  stateBuiltin: 'uma embutida tem este id, então esta não é instalada',
  skillFiles: (files: number) => `${files} ${files === 1 ? 'arquivo' : 'arquivos'}`,
  duplicate: 'já está na sua biblioteca; não foi adicionado de novo',
  bytes: (bytes: number) => `${bytes} bytes`,
  missingSkill: (template: string, skill: string) =>
    `${template} recomenda a habilidade "${skill}", que não está neste computador nem no pacote`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, linha ${line}: ${why}${text ? ` ("${text}")` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Este pacote não será instalado: a linha ${line} de ${file} ${why}${text ? ` ("${text}")` : ''}`,
  installHint: (source: string) => `Instale com: cuccut packs install ${source}`,
  replaceHint: 'Adicione --replace para substituir seus próprios itens com os mesmos ids.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `${name} v${version} instalado: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `${kind === 'template' ? 'Modelo' : kind === 'skill' ? 'Habilidade' : 'Item da biblioteca'} ${id} ignorado: ${
      reason === 'builtin'
        ? 'uma embutida tem este id'
        : reason === 'exists'
          ? 'você tem um seu com este id (adicione --replace)'
          : 'você o alterou desde a instalação (adicione --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name} excluído: ${templates} ${templates === 1 ? 'modelo' : 'modelos'} e ${skills} ${skills === 1 ? 'habilidade' : 'habilidades'} foram junto. Os itens da biblioteca ficam.`,
  kept: (count: number, ids: string) => `${count} ${count === 1 ? 'que você alterou fica' : 'que você alterou ficam'}: ${ids}`,
  undo: (trashId: string) => `Desfazer em até 24 horas: cuccut packs restore ${trashId}`,
  replacedUndo: (ids: string, trashId: string) => `Replaced your own ${ids}. Undo within 24 hours: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `${name} v${version} restaurado`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} não tem guia de estilo. Salve um com cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Guia de estilo de ${name} salvo (${chars} / ${limit} caracteres)`,
  styleRemoved: (name: string) => `Guia de estilo de ${name} removido`,
  takesEffect: 'Vale a partir da próxima nova sessão de agente.',
  idFormat: (value: string) => `Não é um id de pacote (letras minúsculas, dígitos e hífens simples): ${value}`,

  // Export
  exportNeedsName: 'Dê um nome ao pacote com --name.',
  exportNoId: (name: string) => `Não é possível criar um id a partir de "${name}"; informe um com --id.`,
  libraryFormat: (value: string) => `Não é um item da biblioteca (glossaries:<entryId> ou brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `${dir} gravado: ${files} ${files === 1 ? 'arquivo' : 'arquivos'}, ${bytes} bytes. Envie a pasta como está, envie-a ao GitHub ou sirva-a a partir de qualquer hospedagem estática.`,
  exportedCheck: (dir: string) => `Leia de volta com: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Não foi possível ler ${file}: ${reason}`,
};
