import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(labels);

export const es: SlidesMessages = {
  pages: (n) => (n === 1 ? '1 diapositiva' : `${n} diapositivas`),
  paneLabel: (name) => `Diapositivas «${name}»`,
  frameTitle: (name) => `Editor de diapositivas: ${name}`,
  opening: 'Abriendo diapositivas…',
  unavailableTitle: 'Editor de diapositivas no disponible',
  unavailableBody: 'Esta versión de CucCut no incluye el editor de diapositivas. Los archivos de las diapositivas siguen en su carpeta.',
  openFailed: (reason) => `No se pudieron abrir las diapositivas: ${reason}`,
  open: 'Abrir diapositivas',
  openCard: (name) => `Abrir diapositivas «${name}»`,
  openInEditor: 'Abrir en el editor de diapositivas',
  annotate: 'Anotar',
  noteLabel: 'Anotación',
  notePlaceholder: '¿Qué hay que cambiar?',
  addToChat: 'Añadir al chat',
  cancel: 'Cancelar',
  token: (n) => `Anotaciones de diapositivas · ${n}`,
  added: (token) => `Añadido al chat · ${token}`,
  removeAll: 'Quitar todas las anotaciones de diapositivas',
  removeOne: (n) => `Quitar la anotación ${n}`,
  item: (n, label, text) => `Anotación ${n}, ${label}: ${text}`,
  empty: 'Escribe primero la anotación y luego añádela al chat',
  tooLong: (max) => `Una anotación puede tener como máximo ${max} caracteres`,
  tooMany: (max) => `Un mensaje puede llevar como máximo ${max} anotaciones de diapositivas. Envía estas primero.`,
  noConversation: 'Esta pestaña aún no forma parte de una sesión. Envía un mensaje para empezar una y luego añade anotaciones.',
  message: 'Revisa las diapositivas según estas anotaciones.',
  flushFailed: (names) =>
    `Los cambios en las diapositivas ${list(names.map((n) => `«${n}»`))} aún no se han guardado, así que el mensaje no se envió. Inténtalo de nuevo o quita primero las anotaciones de diapositivas.`,
};
