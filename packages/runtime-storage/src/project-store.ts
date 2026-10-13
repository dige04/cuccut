import type { Id, Project } from '@cuccut/protocol';
import { JsonStoreFile, isPlainObject, type StoreOptions } from './store-file.ts';

interface ProjectsFile {
  schemaVersion: 1;
  projects: Project[];
}

/**
 * Project registry (architecture design §1.5, §5.1): the project's identity lives in `.ccut/project.json` in the directory (`project-marker.ts`).
 * This file is only an index of "identity → last seen path", plus display name, pinning, and archiving. If the registry is lost, it can be rebuilt from the markers.
 * Paths are normalized absolute paths (realpath).
 * If the file is corrupt, it is renamed and kept, and the registry starts empty (the marker still exists, and projects are registered again when opened). Files written by a newer version are not rewritten (`store-file.ts`).
 */
export class ProjectStore {
  readonly #file: JsonStoreFile;
  #projects = new Map<Id, Project>();
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<Project[]> {
    const { value } = await this.#file.read({
      recognize: (raw) =>
        Array.isArray(raw.projects)
          ? raw.projects.filter((p): p is Project => isPlainObject(p) && typeof p.id === 'string' && typeof p.path === 'string')
          : null,
    });
    // Registrations written by 0.1 have no pinning or archiving, so fill in the defaults.
    this.#projects = new Map((value ?? []).map((p) => [p.id, { ...p, pinned: p.pinned ?? false, archived: p.archived ?? false }]));
    return this.list();
  }

  list(): Project[] {
    return [...this.#projects.values()];
  }

  get(id: Id): Project | undefined {
    return this.#projects.get(id);
  }

  findByPath(path: string): Project | undefined {
    return this.list().find((p) => p.path === path);
  }

  put(project: Project): Promise<void> {
    this.#projects.set(project.id, project);
    const snapshot: ProjectsFile = { schemaVersion: 1, projects: this.list() };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    return this.#saving;
  }

  flush(): Promise<void> {
    return this.#saving;
  }
}
