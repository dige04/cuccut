/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** The Google Fonts stylesheets a CSS text imports. */
export interface GoogleFontImports {
  /** Stylesheet URLs, without duplicates. */
  hrefs: string[];
  /** Stylesheet URLs of optional variants (italics, extra weights) that may be missing. */
  optional: Set<string>;
}

/** Options of one resource fetch. */
export interface ResourceFetchOptions {
  credentials?: RequestCredentials;
  cache?: RequestCache;
  /** Retry once within the retry budget after a retryable failure. */
  retry?: boolean;
}

/** Thrown when a resource answers with an error status. */
export interface ResourceFetchFailure extends Error {
  status: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    googleFontImports: (css: string) => GoogleFontImports;
    /** The document's font set, after forcing a layout so pending faces register. */
    documentFontSet: () => FontFaceSet;
    googleFontVariantAvailable: (
      href: string,
      includeLoading?: boolean,
    ) => boolean;
    fetchWithSingleRetry: <T>(
      fetchWithTimeout: (timeoutMs: number) => Promise<T>,
      timeoutMs: number,
      retry?: boolean,
    ) => Promise<T>;
    fetchResourceWithTimeout: <T>(
      url: string,
      timeoutMs: number,
      options: ResourceFetchOptions,
      decode: (response: Response) => Promise<T>,
    ) => Promise<T>;
    fetchResourceText: (
      url: string,
      timeoutMs?: number,
      options?: ResourceFetchOptions,
    ) => Promise<string>;
    fetchResourceDataUrl: (
      url: string,
      timeoutMs?: number,
      options?: ResourceFetchOptions,
    ) => Promise<string>;
    googleFontsImportRegex: RegExp;
    googleFontFileUrlRegex: RegExp;
    resourceFetchTimeoutMs: number;
    resourceFetchRetryBudgetMs: number;
    minimumResourceFetchRetryMs: number;
    ResourceFetchError: new (status: number) => ResourceFetchFailure;
    retryableHttpStatuses: Set<number>;
    isNonRetryableFetchError: (error: unknown) => boolean;
    fetchFontStylesheet: (href: string) => Promise<string>;
    fetchFontDataUrl: (url: string) => Promise<string>;
    initializeFontFetching: () => void;
  }
}

export function installFontsFetch(runtime: RuntimeBindings): () => void {
  var googleFontsImportRegex: RuntimeBindings["googleFontsImportRegex"];
  var googleFontFileUrlRegex: RuntimeBindings["googleFontFileUrlRegex"];
  var resourceFetchTimeoutMs: RuntimeBindings["resourceFetchTimeoutMs"];
  var resourceFetchRetryBudgetMs: RuntimeBindings["resourceFetchRetryBudgetMs"];
  var minimumResourceFetchRetryMs: RuntimeBindings["minimumResourceFetchRetryMs"];
  var ResourceFetchError: RuntimeBindings["ResourceFetchError"];
  var retryableHttpStatuses: RuntimeBindings["retryableHttpStatuses"];
  var isNonRetryableFetchError: RuntimeBindings["isNonRetryableFetchError"];
  var fetchFontStylesheet: RuntimeBindings["fetchFontStylesheet"];
  var fetchFontDataUrl: RuntimeBindings["fetchFontDataUrl"];
  var initializeFontFetching: RuntimeBindings["initializeFontFetching"];
  function googleFontImports(css: string): GoogleFontImports {
    let hrefs: string[] = [
      ...new Set(
        [...css.matchAll(googleFontsImportRegex)].map(
          (input: RegExpMatchArray): string => input[2]!,
        ),
      ),
    ];
    return {
      hrefs: hrefs,
      optional: new Set(
        hrefs.flatMap(
          (input: string): string[] =>
            (0, runtime.optionalGoogleFontStylesheetUrls)(
              input,
              runtime.defaultGoogleFontWeights,
            ),
        ),
      ),
    };
  }
  function documentFontSet(): FontFaceSet {
    document.documentElement?.offsetHeight;
    return document.fonts;
  }
  function googleFontVariantAvailable(
    href: string,
    includeLoading: boolean = false,
  ): boolean {
    let match: RegExpExecArray | null =
      /[?&]family=([^:&]+):ital,wght@([01]),([\d.]+)&/.exec(href);
    if (!match || typeof document === "undefined" || !("fonts" in document)) {
      return true;
    }
    let family: string = match[1]!.replace(/\+/g, " ").toLowerCase(),
      style: string = match[2] === "1" ? "italic" : "normal",
      value: string = match[3]!.replace("..", " ");
    for (let value2 of documentFontSet())
      if (
        (includeLoading
          ? value2.status === "loaded"
          : value2.status !== "unloaded" && value2.status !== "error") &&
        value2.style === style &&
        value2.weight === value &&
        value2.family.replace(/["']/g, "").toLowerCase() === family
      ) {
        return true;
      }
    return false;
  }
  async function fetchWithSingleRetry<T>(
    fetchWithTimeout: (timeoutMs: number) => Promise<T>,
    timeoutMs: number,
    retry?: boolean,
  ): Promise<T> {
    let startedAt: number = Date.now();
    try {
      return await fetchWithTimeout(timeoutMs);
    } catch (value: unknown) {
      let value2: number = Math.min(
        timeoutMs,
        resourceFetchRetryBudgetMs - (Date.now() - startedAt),
      );
      if (
        !retry ||
        isNonRetryableFetchError(value) ||
        value2 < minimumResourceFetchRetryMs
      ) {
        throw value;
      }
      return fetchWithTimeout(value2);
    }
  }
  async function fetchResourceWithTimeout<T>(
    url: string,
    timeoutMs: number,
    options: ResourceFetchOptions,
    decode: (response: Response) => Promise<T>,
  ): Promise<T> {
    let controller: AbortController = new AbortController(),
      timeout: ReturnType<typeof setTimeout> = setTimeout(
        (): void => controller.abort(),
        timeoutMs,
      );
    try {
      let state: RequestInit = {
          signal: controller.signal,
          credentials: options.credentials ?? "omit",
        },
        value: Response = await fetch(url, {
          ...state,
          ...(options.cache !== undefined && {
            cache: options.cache,
          }),
        });
      if (!value.ok && options.cache === "force-cache") {
        value = await fetch(url, {
          ...state,
          cache: "reload",
        });
      }
      if (!value.ok) {
        throw new ResourceFetchError(value.status);
      }
      return await decode(value);
    } finally {
      clearTimeout(timeout);
    }
  }
  function fetchResourceText(
    url: string,
    timeoutMs: number = resourceFetchTimeoutMs,
    options: ResourceFetchOptions = {},
  ): Promise<string> {
    return fetchWithSingleRetry(
      (input: number): Promise<string> =>
        fetchResourceWithTimeout(
          url,
          input,
          options,
          (input2: Response): Promise<string> => input2.text(),
        ),
      timeoutMs,
      options.retry === true,
    );
  }
  function fetchResourceDataUrl(
    url: string,
    timeoutMs: number = resourceFetchTimeoutMs,
    options: ResourceFetchOptions = {},
  ): Promise<string> {
    return fetchWithSingleRetry(
      (input: number): Promise<string> =>
        fetchResourceWithTimeout(
          url,
          input,
          options,
          async (input2: Response): Promise<string> => {
            let value: Blob = await input2.blob();
            return new Promise<string>(
              (
                input3: (value: string) => void,
                options2: (reason: Error) => void,
              ): void => {
                let value2: FileReader = new FileReader();
                value2.onload = (): void => input3(String(value2.result));
                value2.onerror = (): void => options2(Error("read failed"));
                value2.readAsDataURL(value);
              },
            );
          },
        ),
      timeoutMs,
      options.retry === true,
    );
  }
  bindRuntimeValue(runtime, "googleFontImports", () => googleFontImports);
  bindRuntimeValue(runtime, "documentFontSet", () => documentFontSet);
  bindRuntimeValue(
    runtime,
    "googleFontVariantAvailable",
    () => googleFontVariantAvailable,
  );
  bindRuntimeValue(runtime, "fetchWithSingleRetry", () => fetchWithSingleRetry);
  bindRuntimeValue(
    runtime,
    "fetchResourceWithTimeout",
    () => fetchResourceWithTimeout,
  );
  bindRuntimeValue(runtime, "fetchResourceText", () => fetchResourceText);
  bindRuntimeValue(runtime, "fetchResourceDataUrl", () => fetchResourceDataUrl);
  bindRuntimeValue(
    runtime,
    "googleFontsImportRegex",
    () => googleFontsImportRegex,
    (value) => {
      googleFontsImportRegex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleFontFileUrlRegex",
    () => googleFontFileUrlRegex,
    (value) => {
      googleFontFileUrlRegex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resourceFetchTimeoutMs",
    () => resourceFetchTimeoutMs,
    (value) => {
      resourceFetchTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resourceFetchRetryBudgetMs",
    () => resourceFetchRetryBudgetMs,
    (value) => {
      resourceFetchRetryBudgetMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minimumResourceFetchRetryMs",
    () => minimumResourceFetchRetryMs,
    (value) => {
      minimumResourceFetchRetryMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ResourceFetchError",
    () => ResourceFetchError,
    (value) => {
      ResourceFetchError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "retryableHttpStatuses",
    () => retryableHttpStatuses,
    (value) => {
      retryableHttpStatuses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isNonRetryableFetchError",
    () => isNonRetryableFetchError,
    (value) => {
      isNonRetryableFetchError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fetchFontStylesheet",
    () => fetchFontStylesheet,
    (value) => {
      fetchFontStylesheet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fetchFontDataUrl",
    () => fetchFontDataUrl,
    (value) => {
      fetchFontDataUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFontFetching",
    () => initializeFontFetching,
    (value) => {
      initializeFontFetching = value;
    },
  );
  return () => {
    resourceFetchTimeoutMs = 8000;
    resourceFetchRetryBudgetMs = 12000;
    minimumResourceFetchRetryMs = 2000;
    isNonRetryableFetchError = (state: unknown): boolean =>
      typeof state === "object" &&
      state !== null &&
      "status" in state &&
      typeof state.status === "number" &&
      state.status >= 400 &&
      state.status < 500 &&
      !retryableHttpStatuses.has(state.status);
    fetchFontStylesheet = (input: string): Promise<string> =>
      fetchResourceText(input, resourceFetchTimeoutMs, {
        retry: true,
      });
    fetchFontDataUrl = (input: string): Promise<string> =>
      fetchResourceDataUrl(input, resourceFetchTimeoutMs, {
        retry: true,
        cache: "force-cache",
      });
    initializeFontFetching = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeFontCatalog)();
      googleFontsImportRegex =
        /@import url\((["']?)(https:\/\/fonts\.googleapis\.com\/[^"')\s]+)\1\);?/g;
      googleFontFileUrlRegex =
        /url\((["']?)(https:\/\/fonts\.gstatic\.com\/[^"')\s]+)\1\)/g;
      ResourceFetchError = class value extends Error {
        status: number;
        constructor(input: number) {
          super("fetch " + String(input));
          this.status = input;
        }
      };
      retryableHttpStatuses = new Set([408, 425, 429]);
    });
  };
}
