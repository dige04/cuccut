import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './harness-projects.zh-Hans.ts';
import { zhHant } from './harness-projects.zh-Hant.ts';
import { ja } from './harness-projects.ja.ts';
import { ko } from './harness-projects.ko.ts';
import { es } from './harness-projects.es.ts';
import { fr } from './harness-projects.fr.ts';
import { de } from './harness-projects.de.ts';
import { nl } from './harness-projects.nl.ts';
import { ptBR } from './harness-projects.pt-BR.ts';
import { it } from './harness-projects.it.ts';
import { ru } from './harness-projects.ru.ts';
import { pl } from './harness-projects.pl.ts';
import { tr } from './harness-projects.tr.ts';
import { vi } from './harness-projects.vi.ts';

/** Errors for looking up projects and sessions, project directories and project markers (`packages/harness`). */
const en = {
  conversationNotFound: (p: { id: string }) => `Session not found: ${p.id}`,
  projectNotFound: (p: { id: string }) => `Project not found: ${p.id}`,
  folderInaccessible: (p: { dir: string }) => `Folder doesn't exist or can't be accessed: ${p.dir}`,
  markerReadFailed: (p: { error: string }) => `Couldn't read the project marker: ${p.error}`,
  markerNewer: (p: { version: number }) =>
    `This project was created by a newer version of CucCut (project marker version ${p.version}). Update CucCut, then open it again`,
  /** Directory name used when a new project is created without a name. */
  untitledProject: 'Untitled project',
  /** Name of the project that collects videos with no matching session (ones left in a session's working directory before the upgrade) at startup. It is also its directory name. */
  recoveredVideos: 'Recovered videos',
  createFolderFailed: (p: { error: string }) => `Couldn't create the project folder: ${p.error}`,
  tooManySameName: 'Too many project folders have this name. Choose another name',
  markerNotWritable: (p: { dir: string }) =>
    `The project folder isn't writable, so the project marker .ccut/project.json couldn't be written: ${p.dir}`,
  markerWriteFailed: (p: { error: string }) => `Couldn't write the project marker: ${p.error}`,
  /** Before moving a session-less session's videos into a project, or deleting the session: a video in its working directory is still open (in another window, task or connection), so it cannot be moved (architecture design §3.10). `names` are the video directory names. */
  sessionVideosOpen: (p: { names: string }) => `Some videos in this session are still open: ${p.names}. Close them, then try again`,
};

export type HarnessProjectsMessages = typeof en;

export const HarnessProjects = defineCatalog('harnessProjects', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
