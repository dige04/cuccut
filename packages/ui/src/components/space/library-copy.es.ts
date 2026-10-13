import type { LibraryMessages } from './library-copy.ts';

export const es: LibraryMessages = {
  blurb: 'Vídeos, medios y todo lo que hicieron tus agentes, de todos los proyectos.',
  blurbProject: 'Vídeos, medios y resultados de este proyecto.',
  blurbFavorite: 'Todo lo que marcaste como favorito, de todos los proyectos.',
  blurbTrash: 'Los elementos de la Papelera esperan aquí hasta que los restaures o los elimines permanentemente.',
  allItems: 'Todos los elementos',
  projects: 'Proyectos',
  items: (n: number) => (n === 1 ? '1 elemento' : `${n} elementos`),
  matching: (n: number, q: string) => `${n === 1 ? '1 elemento coincide' : `${n} elementos coinciden`} con “${q}”`,
  kindFilter: 'Tipo de elemento',
  clearSearch: 'Borrar búsqueda',
  noMatchBody: 'Prueba con otro nombre o cambia de tipo.',
  openHint: 'Abre para previsualizar · Los vídeos se abren en el editor',
  inProject: (name: string) => `En ${name}`,
  clearProject: 'Mostrar todos los proyectos',
  backToLibrary: 'Volver a la biblioteca',
};
