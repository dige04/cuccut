/** Support entry for documents embedding npm React 18 UMD assets. */
import {hideDesignSource, ensureReactAvailable, bootRuntime} from './runtime';
hideDesignSource();
ensureReactAvailable().then(bootRuntime).catch((error: unknown) => {
  console.error('[dc] failed to load React or boot:', error);
  throw error;
});
