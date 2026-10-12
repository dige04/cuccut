import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(labels);

export const es: DesignSystemMessages = {
  paneLabel: (name) => `Sistema de diseño «${name}»`,
  frameTitle: (name) => `Editor de sistemas de diseño: ${name}`,
  opening: 'Abriendo el sistema de diseño…',
  unavailableTitle: 'Editor de sistemas de diseño no disponible',
  unavailableBody: 'Esta versión de CucCut no incluye el editor de sistemas de diseño. Los archivos del sistema de diseño siguen en su carpeta.',
  hostBlockedTitle: 'El editor de sistemas de diseño no se puede abrir en esta dirección',
  hostBlockedBody: 'Abre CucCut Web en 127.0.0.1 o localhost para editar sistemas de diseño. Los archivos del sistema de diseño siguen en su carpeta.',
  openFailed: (reason) => `No se pudo abrir el sistema de diseño: ${reason}`,
  open: 'Abrir sistema de diseño',
  openInEditor: 'Abrir en el editor de sistemas de diseño',
  annotate: 'Anotar',
  noteLabel: 'Anotación',
  notePlaceholder: '¿Qué hay que cambiar?',
  addToChat: 'Añadir al chat',
  cancel: 'Cancelar',
  where: (name, label) => `Sistema de diseño «${name}» › ${label}`,
  token: (n) => `Anotaciones del sistema de diseño · ${n}`,
  added: (token) => `Añadido al chat · ${token}`,
  removeAll: 'Quitar todas las anotaciones del sistema de diseño',
  removeOne: (n) => `Quitar la anotación ${n}`,
  item: (n, label, text) => `Anotación ${n}, ${label}: ${text}`,
  empty: 'Escribe primero la anotación y luego añádela al chat',
  tooLong: (max) => `Una anotación puede tener como máximo ${max} caracteres`,
  tooMany: (max) => `Un mensaje puede llevar como máximo ${max} anotaciones del sistema de diseño. Envía estas primero.`,
  noConversation: 'Esta pestaña aún no forma parte de una sesión. Envía un mensaje para empezar una y luego añade anotaciones.',
  message: 'Revisa el sistema de diseño según estas anotaciones.',
  flushFailed: (names) =>
    `Los cambios en ${names.length === 1 ? 'el sistema de diseño' : 'los sistemas de diseño'} ${list(names.map((n) => `«${n}»`))} aún no se han guardado, así que el mensaje no se envió. Inténtalo de nuevo o quita primero las anotaciones del sistema de diseño.`,
};
