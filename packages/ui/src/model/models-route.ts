import { MODEL_CATEGORY_INFO, modelPageFor, type ModelCategory, type ModelPage } from './settings-nav.ts';

/**
 * Model configuration route within settings (product design §2.1, §7.6): `settings/models/<class>[/<page>]`. When no page is given, or the given page does not belong to this class, it falls to the page where this class was last left, and if there is none, the first page. When the left column or the narrow-window dropdown switches class, the last page of that class is also carried.
 */
export interface ModelsLocation {
  category: ModelCategory;
  page: ModelPage;
}

export function resolveModelsRoute(
  category: ModelCategory,
  page: ModelPage | undefined,
  last: Partial<Record<ModelCategory, ModelPage>>,
): ModelsLocation {
  return { category, page: modelPageFor(category, page, last[category]) };
}

/** Where each class in the left column goes: the current class uses the already-resolved page (so the first frame matches the selected item); the others use the page they were last on. */
export function modelsNavTargets(current: ModelsLocation, last: Partial<Record<ModelCategory, ModelPage>>): ModelsLocation[] {
  return MODEL_CATEGORY_INFO.map((info) =>
    info.key === current.category ? current : { category: info.key, page: modelPageFor(info.key, undefined, last[info.key]) },
  );
}
