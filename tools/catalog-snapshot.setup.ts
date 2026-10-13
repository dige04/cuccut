import { writeCatalogSnapshot } from './catalog-snapshot.ts';

/** vitest globalSetup: writes the CLI's offline catalog snapshot from the current tool catalog before tests (generated, not in git). */
export default function setup(): void {
  writeCatalogSnapshot();
}
