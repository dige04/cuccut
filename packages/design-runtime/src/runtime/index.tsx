/** Standalone document runtime uses the isolated npm React 18 installation. */
import React from 'react';
import * as ReactDOM from 'react-dom';
import {createRoot} from 'react-dom/client';
import {hideDesignSource, ensureReactAvailable, bootRuntime} from './runtime';
window.React = React;
window.ReactDOM = {...ReactDOM, createRoot};
hideDesignSource();
ensureReactAvailable().then(bootRuntime).catch((error: unknown) => {
  console.error('[dc] failed to load React or boot:', error);
  throw error;
});
