import type { PacksMessages } from './packs-copy.ts';

export const es: PacksMessages = {
  packsHelp: `Uso:
  cuccut packs inspect <source>    Lee un pack y muestra todo lo que contiene, sin instalarlo.
                                   <source>: una carpeta, una dirección de GitHub (owner/repo, la URL de un
                                   repositorio o …/tree/<branch>/<folder>) o una dirección https:// que sirva pack.json
  cuccut packs install <source>    Lee un pack e instala sus plantillas, habilidades, elementos de biblioteca, guía
                                   de estilo y acciones rápidas
    --replace                      Reemplaza tus plantillas y habilidades propias con los mismos ids (van a la
                                   papelera); sin esta opción se conservan y se omiten
  cuccut packs remove <id>         Elimina un pack: él y las plantillas y habilidades que trajo van a la papelera
                                   durante 24 horas; los elementos de biblioteca y tus cambios se quedan
  cuccut packs restore <trashId>   Deshace una eliminación, dentro de las 24 horas
  cuccut packs style <id> [<file>|-]
                                   Imprime la guía de estilo del pack; con un archivo (o - para la entrada estándar),
                                   guarda el archivo como guía (un archivo vacío la elimina)
  cuccut packs export <folder> --name <name>
                                   Escribe una carpeta de pack con tus plantillas, habilidades y elementos de
                                   biblioteca, con el índice de archivos, para enviarla tal cual, subirla a GitHub
                                   o servirla desde cualquier alojamiento estático. La carpeta debe estar vacía o ser
                                   una exportación anterior del pack
    --id <id>                      El id del pack (por defecto: se genera a partir del nombre)
    --version <version>            Por defecto 1.0.0
    --author <name>, --description <text>
    --template <id>                Una plantilla propia (repetible)
    --skill <id>                   Una habilidad que no viene integrada (repetible)
    --library <glossaries|brand>:<entryId>
                                   Un elemento de biblioteca (repetible); las voces se quedan
    --quick-actions <packId>       Las acciones rápidas de un pack instalado (repetible)
    --style-from <packId>          La guía de estilo y los archivos de referencia de un pack instalado`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, de ${author}` : ''}`,
  notInstalled: 'No instalado: léelo primero.',
  installedVersion: (version: string) =>
    `La versión ${version} está instalada. Instalarla de nuevo actualiza lo que el pack posee y conserva lo que cambiaste.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? (templates === 1 ? '1 plantilla' : `${templates} plantillas`) : '',
      skills ? (skills === 1 ? '1 habilidad' : `${skills} habilidades`) : '',
      library ? (library === 1 ? '1 elemento de biblioteca' : `${library} elementos de biblioteca`) : '',
      style ? 'una guía de estilo' : '',
      quickActions ? (quickActions === 1 ? '1 acción rápida' : `${quickActions} acciones rápidas`) : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Nada propio';
  },
  sectionTemplates: 'Plantillas',
  sectionSkills: 'Habilidades',
  sectionLibrary: 'Biblioteca',
  sectionStyle: 'Guía de estilo: los agentes la leen antes de elegir y editar',
  sectionExamples: 'Archivos de referencia',
  sectionQuick: 'Acciones rápidas: mensajes enviados al agente con un clic',
  sectionReserved: 'Reglas y estándar de revisión: se guardan con el pack; CucCut todavía no los usa',
  sectionWarnings: 'Advertencias',
  agentReads: 'Texto que un agente seguirá. Léelo.',
  stateNew: 'nuevo',
  stateUpdate: 'actualiza la copia que instaló este pack',
  stateChanged: 'lo cambiaste desde que se instaló: se conserva salvo con --replace',
  stateExists: 'ya tienes uno con este id: el tuyo se conserva salvo con --replace',
  stateBuiltin: 'uno integrado tiene este id, así que este no se instala',
  skillFiles: (files: number) => (files === 1 ? '1 archivo' : `${files} archivos`),
  duplicate: 'ya está en tu biblioteca; no se añade de nuevo',
  bytes: (bytes: number) => `${bytes} bytes`,
  missingSkill: (template: string, skill: string) =>
    `${template} recomienda la habilidad "${skill}", que no está en este ordenador ni en el pack`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, línea ${line}: ${why}${text ? ` ("${text}")` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `Este pack no se instalará: la línea ${line} de ${file} ${why}${text ? ` ("${text}")` : ''}`,
  installHint: (source: string) => `Instálalo con: cuccut packs install ${source}`,
  replaceHint: 'Añade --replace para reemplazar tus elementos propios que tengan los mismos ids.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `Instalado ${name} v${version}: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `Se omitió ${kind === 'template' ? 'la plantilla' : kind === 'skill' ? 'la habilidad' : 'el elemento de biblioteca'} ${id}: ${
      reason === 'builtin'
        ? 'uno integrado tiene este id'
        : reason === 'exists'
          ? 'tienes uno propio con este id (añade --replace)'
          : 'lo cambiaste desde que se instaló (añade --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `Se eliminó ${name}: ${templates} ${templates === 1 ? 'plantilla' : 'plantillas'} y ${skills} ${skills === 1 ? 'habilidad' : 'habilidades'} se fueron con él. Los elementos de biblioteca se quedan.`,
  kept: (count: number, ids: string) => `${count} ${count === 1 ? 'que cambiaste se queda' : 'que cambiaste se quedan'}: ${ids}`,
  undo: (trashId: string) => `Deshacer dentro de las 24 horas: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `Restaurado ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} no tiene guía de estilo. Guárdala con cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Se guardó la guía de estilo de ${name} (${chars} / ${limit} caracteres)`,
  styleRemoved: (name: string) => `Se eliminó la guía de estilo de ${name}`,
  takesEffect: 'Se aplica desde la próxima sesión nueva de agente.',
  idFormat: (value: string) => `No es un id de pack (letras minúsculas, dígitos y guiones simples): ${value}`,

  // Export
  exportNeedsName: 'Pon un nombre al pack con --name.',
  exportNoId: (name: string) => `No se puede crear un id a partir de "${name}"; indícalo con --id.`,
  libraryFormat: (value: string) => `No es un elemento de biblioteca (glossaries:<entryId> o brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `Se escribió ${dir}: ${files} ${files === 1 ? 'archivo' : 'archivos'}, ${bytes} bytes. Envía la carpeta tal cual, súbela a GitHub o sírvela desde cualquier alojamiento estático.`,
  exportedCheck: (dir: string) => `Léelo con: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `No se puede leer ${file}: ${reason}`,
};
