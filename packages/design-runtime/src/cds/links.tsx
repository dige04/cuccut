/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCdsLinks(runtime: RuntimeBindings): () => void {
  var CdsLinksPattern: Dynamic;
  var initializeCdsLinks: Dynamic;
  var CdsLinksSubscribers: Dynamic;
  var CdsLinksOpenerReferrerPattern: Dynamic;
  var initializeCdsLinks_2: Dynamic;
  var reactCdsLinks: Dynamic;
  var LinkRouterContext: Dynamic;
  var CdsLinksPattern_2: Dynamic;
  var CdsLinksPattern_3: Dynamic;
  var CdsLinksPattern_4: Dynamic;
  var CdsLinksPattern_5: Dynamic;
  var CdsLinksPattern_6: Dynamic;
  var CdsLinksPattern_7: Dynamic;
  var CdsLinksPattern_8: Dynamic;
  var CdsLinksPattern_9: Dynamic;
  var CdsLinksHttpsMailtoPattern: Dynamic;
  var CdsLinksIntentPattern: Dynamic;
  var CdsLinksVscodeCursorPattern: Dynamic;
  var CdsLinksVscodeCursorPattern_2: Dynamic;
  var CdsLinksSubscribers_2: Dynamic;
  var CdsLinksPattern_10: Dynamic;
  var CdsLinksItems: Dynamic;
  var CdsLinksSubscribers_3: Dynamic;
  var trustedClaudeOrigin: Dynamic;
  var trustedClaudeAlternateOrigin: Dynamic;
  var routerOptionKeys: Dynamic;
  var CdsLinksOnPointerEnterOnPointerLeaveOnPointerDownConfig: Dynamic;
  var CdsLinksKeysValue: Dynamic;
  var initializeLinkRouter: Dynamic;
  function trimHrefControls(href?: Dynamic): Dynamic {
    let cleaned: Dynamic = href.replace(CdsLinksPattern, ""),
      start: Dynamic = 0,
      end: Dynamic = cleaned.length;
    for (; start < end && cleaned.charCodeAt(start) <= 32; ) start++;
    for (; end > start && cleaned.charCodeAt(end - 1) <= 32; ) end--;
    return start === 0 && end === cleaned.length
      ? cleaned
      : cleaned.slice(start, end);
  }
  function isBlockedHref(originalHref?: Dynamic, safeHref?: Dynamic): Dynamic {
    return (
      safeHref === "#" &&
      originalHref !== undefined &&
      trimHrefControls(originalHref) !== "#"
    );
  }
  function isNewBrowsingContext(target?: Dynamic): Dynamic {
    return !!target && !CdsLinksSubscribers.has(target.toLowerCase());
  }
  function normalizeLinkRel(
    target?: Dynamic,
    rel?: Dynamic,
    defaultRel?: Dynamic,
  ): Dynamic {
    if (!isNewBrowsingContext(target)) return rel ?? undefined;
    if (rel == null) return defaultRel();
    let tokens2: Dynamic = rel
      .split(/\s+/)
      .filter(
        (input?: Dynamic): Dynamic =>
          input !== "" && input.toLowerCase() !== "opener",
      );
    tokens2.some(
      (input?: Dynamic): Dynamic => CdsLinksOpenerReferrerPattern.test(input),
    ) || tokens2.push("noopener");
    return tokens2.join(" ");
  }
  function useLinkRouter(): Dynamic {
    return (0, reactCdsLinks.useContext)(LinkRouterContext);
  }
  function sanitizeHref(href?: Dynamic): Dynamic {
    if (!href) return href;
    let normalizedHref: Dynamic = trimHrefControls(href);
    return CdsLinksPattern_2.test(normalizedHref)
      ? blockUnsafeHref(normalizedHref, "it contains a control character")
      : CdsLinksPattern_3.test(normalizedHref)
        ? blockUnsafeHref(
            normalizedHref,
            "it starts with whitespace the browser keeps",
          )
        : CdsLinksPattern_10.test(normalizedHref)
          ? normalizedHref.startsWith("//")
            ? normalizedHref
            : CdsLinksIntentPattern.test(normalizedHref)
              ? isValidAndroidIntentUrl(normalizedHref)
                ? normalizedHref
                : blockUnsafeHref(
                    normalizedHref,
                    "only an Anthropic Android app's own sign-in intent: shape is followed",
                  )
              : CdsLinksVscodeCursorPattern.test(normalizedHref)
                ? isSafeDataUrl(normalizedHref)
                  ? normalizedHref
                  : blockUnsafeHref(
                      normalizedHref,
                      "only an Anthropic extension's marketplace page or a VS Code settings link is followed",
                    )
                : CdsLinksHttpsMailtoPattern.test(normalizedHref)
                  ? normalizedHref
                  : blockUnsafeHref(
                      normalizedHref,
                      "its scheme is not one CDS links navigate",
                    )
          : normalizeHttpHref(normalizedHref);
  }
  function blockUnsafeHref(input?: Dynamic, options?: Dynamic): Dynamic {
    return "#";
  }
  function normalizeHttpHref(input?: Dynamic): Dynamic {
    let value: Dynamic = CdsLinksPattern_4.test(input);
    try {
      let value2: Dynamic = new URL(input, trustedClaudeOrigin),
        value3: Dynamic =
          value2.pathname.replace(/^\/{2,}/, "/") + value2.search + value2.hash;
      if (
        value ||
        value2.origin !== trustedClaudeOrigin ||
        value2.pathname.startsWith("//")
      ) {
        value || value2.origin;
        return value3;
      }
      if (hasUnsafeNetworkPath(input)) return value3;
      let value4: Dynamic = stripHrefQueryAndHash(input);
      if (
        CdsLinksPattern_6.test(input) &&
        CdsLinksPattern_9.test(value4) &&
        !value2.pathname.startsWith("//")
      ) {
        let value5: Dynamic = value4
          .replaceAll("\\", "/")
          .split("/")
          .map(
            (input2?: Dynamic): Dynamic =>
              CdsLinksPattern_8.test(input2)
                ? input2.replace(/%2e/gi, ".")
                : input2,
          )
          .join("/");
        if (value5 !== value4) {
          let value6: Dynamic = value5 + input.slice(value4.length);
          return value6;
        }
      }
    } catch {
      if (value)
        return blockUnsafeHref(
          input,
          "it names a host this URL parser cannot parse",
        );
    }
    return input;
  }
  function hasUnsafeNetworkPath(input?: Dynamic): Dynamic {
    if (!CdsLinksPattern_5.test(input)) return false;
    let value: Dynamic = stripHrefQueryAndHash(input);
    return value.includes("\\") || CdsLinksPattern_7.test(value);
  }
  function stripHrefQueryAndHash(input?: Dynamic): Dynamic {
    let value: Dynamic = input.search(/[?#]/);
    return value < 0 ? input : input.slice(0, value);
  }
  function isSafeDataUrl(input?: Dynamic): Dynamic {
    return CdsLinksVscodeCursorPattern_2.test(
      input.replace(
        CdsLinksVscodeCursorPattern,
        (input2?: Dynamic): Dynamic => input2.toLowerCase(),
      ),
    );
  }
  function isValidAndroidIntentUrl(input?: Dynamic): Dynamic {
    if (!CdsLinksIntentPattern.test(input)) return false;
    let value: Dynamic = input.indexOf("#");
    if (value < 0 || input.indexOf("#", value + 1) >= 0) return false;
    let value2: Dynamic = input.slice(value + 1);
    if (!value2.startsWith("Intent;") || !value2.endsWith(";end")) return false;
    let value3: Dynamic = value2.slice(7, -4),
      entries: Dynamic = new Map();
    for (let value4 of value3.split(";") as Dynamic) {
      let value5: Dynamic = value4.indexOf("=");
      if (value5 <= 0) return false;
      let value6: Dynamic = value4.slice(0, value5);
      if (entries.has(value6) || !CdsLinksSubscribers_2.has(value6))
        return false;
      entries.set(value6, value4.slice(value5 + 1));
    }
    let entry: Dynamic = entries.get("package");
    if (
      entry === undefined ||
      !CdsLinksSubscribers_3.has(entry) ||
      entries.get("scheme") !== "https"
    )
      return false;
    let entry2: Dynamic = entries.get("S.browser_fallback_url");
    if (entry2 === undefined) return true;
    try {
      return new URL(decodeURIComponent(entry2)).protocol === "https:";
    } catch {
      return false;
    }
  }
  function classifyLinkDestination(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic;
    try {
      value = new URL(input, options);
    } catch {
      return "other";
    }
    if (value.origin === options) return "relative";
    if (value.protocol !== "https:" && value.protocol !== "http:")
      return "other";
    let hostname: Dynamic = value.hostname;
    return CdsLinksItems.some(
      (input2?: Dynamic): Dynamic =>
        hostname === input2 || hostname.endsWith("." + input2),
    )
      ? "first-party"
      : "other";
  }
  function isTrustedLink(input?: Dynamic): Dynamic {
    if (!input) return false;
    let value: Dynamic = classifyLinkDestination(input, trustedClaudeOrigin);
    return (
      value !== "other" &&
      value === classifyLinkDestination(input, trustedClaudeAlternateOrigin)
    );
  }
  function getExternalLinkRel(input?: Dynamic): Dynamic {
    return isTrustedLink(input) ? "noopener" : "noopener noreferrer";
  }
  function getLinkRel(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = sanitizeHref(input);
    return isNewBrowsingContext(options)
      ? getExternalLinkRel(value)
      : isTrustedLink(value)
        ? undefined
        : "noreferrer";
  }
  function isSameOriginHref(input?: Dynamic): Dynamic {
    if (typeof window === "undefined") return false;
    try {
      let value: Dynamic = new URL(input, (window as Dynamic).location.href);
      return (
        value.origin !== "null" &&
        value.protocol === (window as Dynamic).location.protocol &&
        value.origin === (window as Dynamic).location.origin
      );
    } catch {
      return false;
    }
  }
  function shouldHandleLinkWithRouter(event?: Dynamic): Dynamic {
    return !event.router ||
      !event.href ||
      event.href.startsWith("#") ||
      (event.target && event.target.toLowerCase() !== "_self") ||
      (event.download !== null &&
        event.download !== undefined &&
        event.download !== false)
      ? false
      : isSameOriginHref(event.href);
  }
  function toRouterPath(input?: Dynamic): Dynamic {
    if (!CdsLinksPattern_10.test(input)) return input;
    let value: Dynamic = new URL(input, (window as Dynamic).location.href);
    return value.pathname.replace(/^\/{2,}/, "/") + value.search + value.hash;
  }
  function isModifiedClick(input?: Dynamic): Dynamic {
    return (
      input.defaultPrevented ||
      input.button !== 0 ||
      input.metaKey ||
      input.ctrlKey ||
      input.shiftKey ||
      input.altKey
    );
  }
  function pickRouterOptions(input?: Dynamic): Dynamic {
    let value: Dynamic = input,
      state: Dynamic = {};
    for (let value2 of routerOptionKeys as Dynamic)
      value[value2] !== undefined && (state[value2] = value[value2]);
    return state;
  }
  function omitRouterOptions(input?: Dynamic): Dynamic {
    let state: Dynamic = {
      ...input,
    };
    for (let value of routerOptionKeys as Dynamic) delete state[value];
    return state;
  }
  function composeEventHandlers(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return options
      ? (input2?: Dynamic): Dynamic => {
          input?.(input2);
          (!context || !input2.defaultPrevented) && options(input2);
        }
      : input;
  }
  function useLinkProps({
    href: href,
    routerOptions: routerOptions,
    target: target,
    rel: rel,
    download: download,
    onClick: onClick,
    onPointerEnter: onPointerEnter,
    onPointerLeave: onPointerLeave,
    onPointerDown: onPointerDown,
    onFocus: onFocus,
    onBlur: onBlur,
  }: Dynamic): Dynamic {
    "use no memo";

    let value: Dynamic = useLinkRouter(),
      value2: Dynamic = sanitizeHref(href),
      value3: Dynamic = isBlockedHref(href, value2),
      value4: Dynamic = value3 ? undefined : target,
      value5: Dynamic = value3 ? undefined : download,
      value6: Dynamic =
        value?.resolveHref &&
        value2 &&
        !value2.startsWith("#") &&
        !CdsLinksPattern_10.test(value2)
          ? value.resolveHref(value2)
          : value2,
      value7: Dynamic = value !== undefined,
      value8: Dynamic = (0, reactCdsLinks.useMemo)((): Dynamic => {
        let state: Dynamic = {
          href: value2,
          target: value4,
          download: value5,
          router: value7,
        };
        return shouldHandleLinkWithRouter(state)
          ? toRouterPath(state.href)
          : undefined;
      }, [value2, value4, value5, value7]),
      value9: Dynamic = (0, reactCdsLinks.useCallback)(
        (event?: Dynamic): Dynamic => {
          onClick?.(event);
          !(isModifiedClick(event) || value8 === undefined || !value) &&
            (event.preventDefault(), value.navigate(value8, routerOptions));
        },
        [onClick, value8, value, routerOptions],
      ),
      value10: Dynamic = value?.intentHandlers,
      value11: Dynamic = (0, reactCdsLinks.useMemo)(
        (): Dynamic =>
          value10 && value8 !== undefined ? value10(value8) : undefined,
        [value10, value8],
      ),
      value12: Dynamic = (0, reactCdsLinks.useMemo)((): Dynamic => {
        let state: Dynamic = {
            onPointerEnter: onPointerEnter,
            onPointerLeave: onPointerLeave,
            onPointerDown: onPointerDown,
            onFocus: onFocus,
            onBlur: onBlur,
          },
          state2: Dynamic = {};
        for (let value13 of CdsLinksKeysValue as Dynamic) {
          let value14: Dynamic = composeEventHandlers(
            state[value13],
            value11?.[value13],
            CdsLinksOnPointerEnterOnPointerLeaveOnPointerDownConfig[value13],
          );
          value14 && (state2[value13] = value14);
        }
        return state2;
      }, [
        value11,
        onPointerEnter,
        onPointerLeave,
        onPointerDown,
        onFocus,
        onBlur,
      ]);
    return {
      href: value6,
      target: value4,
      rel: normalizeLinkRel(
        value4,
        rel,
        (): Dynamic => getExternalLinkRel(value6),
      ),
      download: value5,
      onClick: value9,
      ...value12,
    };
  }
  bindRuntimeValue(runtime, "trimHrefControls", () => trimHrefControls);
  bindRuntimeValue(runtime, "isBlockedHref", () => isBlockedHref);
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern",
    () => CdsLinksPattern,
    (value) => {
      CdsLinksPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCdsLinks",
    () => initializeCdsLinks,
    (value) => {
      initializeCdsLinks = value;
    },
  );
  bindRuntimeValue(runtime, "isNewBrowsingContext", () => isNewBrowsingContext);
  bindRuntimeValue(runtime, "normalizeLinkRel", () => normalizeLinkRel);
  bindRuntimeValue(
    runtime,
    "CdsLinksSubscribers",
    () => CdsLinksSubscribers,
    (value) => {
      CdsLinksSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksOpenerReferrerPattern",
    () => CdsLinksOpenerReferrerPattern,
    (value) => {
      CdsLinksOpenerReferrerPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCdsLinks_2",
    () => initializeCdsLinks_2,
    (value) => {
      initializeCdsLinks_2 = value;
    },
  );
  bindRuntimeValue(runtime, "useLinkRouter", () => useLinkRouter);
  bindRuntimeValue(runtime, "sanitizeHref", () => sanitizeHref);
  bindRuntimeValue(runtime, "blockUnsafeHref", () => blockUnsafeHref);
  bindRuntimeValue(runtime, "normalizeHttpHref", () => normalizeHttpHref);
  bindRuntimeValue(runtime, "hasUnsafeNetworkPath", () => hasUnsafeNetworkPath);
  bindRuntimeValue(
    runtime,
    "stripHrefQueryAndHash",
    () => stripHrefQueryAndHash,
  );
  bindRuntimeValue(runtime, "isSafeDataUrl", () => isSafeDataUrl);
  bindRuntimeValue(
    runtime,
    "isValidAndroidIntentUrl",
    () => isValidAndroidIntentUrl,
  );
  bindRuntimeValue(
    runtime,
    "classifyLinkDestination",
    () => classifyLinkDestination,
  );
  bindRuntimeValue(runtime, "isTrustedLink", () => isTrustedLink);
  bindRuntimeValue(runtime, "getExternalLinkRel", () => getExternalLinkRel);
  bindRuntimeValue(runtime, "getLinkRel", () => getLinkRel);
  bindRuntimeValue(runtime, "isSameOriginHref", () => isSameOriginHref);
  bindRuntimeValue(
    runtime,
    "shouldHandleLinkWithRouter",
    () => shouldHandleLinkWithRouter,
  );
  bindRuntimeValue(runtime, "toRouterPath", () => toRouterPath);
  bindRuntimeValue(runtime, "isModifiedClick", () => isModifiedClick);
  bindRuntimeValue(runtime, "pickRouterOptions", () => pickRouterOptions);
  bindRuntimeValue(runtime, "omitRouterOptions", () => omitRouterOptions);
  bindRuntimeValue(runtime, "composeEventHandlers", () => composeEventHandlers);
  bindRuntimeValue(runtime, "useLinkProps", () => useLinkProps);
  bindRuntimeValue(
    runtime,
    "reactCdsLinks",
    () => reactCdsLinks,
    (value) => {
      reactCdsLinks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LinkRouterContext",
    () => LinkRouterContext,
    (value) => {
      LinkRouterContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_2",
    () => CdsLinksPattern_2,
    (value) => {
      CdsLinksPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_3",
    () => CdsLinksPattern_3,
    (value) => {
      CdsLinksPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_4",
    () => CdsLinksPattern_4,
    (value) => {
      CdsLinksPattern_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_5",
    () => CdsLinksPattern_5,
    (value) => {
      CdsLinksPattern_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_6",
    () => CdsLinksPattern_6,
    (value) => {
      CdsLinksPattern_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_7",
    () => CdsLinksPattern_7,
    (value) => {
      CdsLinksPattern_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_8",
    () => CdsLinksPattern_8,
    (value) => {
      CdsLinksPattern_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_9",
    () => CdsLinksPattern_9,
    (value) => {
      CdsLinksPattern_9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksHttpsMailtoPattern",
    () => CdsLinksHttpsMailtoPattern,
    (value) => {
      CdsLinksHttpsMailtoPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksIntentPattern",
    () => CdsLinksIntentPattern,
    (value) => {
      CdsLinksIntentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksVscodeCursorPattern",
    () => CdsLinksVscodeCursorPattern,
    (value) => {
      CdsLinksVscodeCursorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksVscodeCursorPattern_2",
    () => CdsLinksVscodeCursorPattern_2,
    (value) => {
      CdsLinksVscodeCursorPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksSubscribers_2",
    () => CdsLinksSubscribers_2,
    (value) => {
      CdsLinksSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksPattern_10",
    () => CdsLinksPattern_10,
    (value) => {
      CdsLinksPattern_10 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksItems",
    () => CdsLinksItems,
    (value) => {
      CdsLinksItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksSubscribers_3",
    () => CdsLinksSubscribers_3,
    (value) => {
      CdsLinksSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trustedClaudeOrigin",
    () => trustedClaudeOrigin,
    (value) => {
      trustedClaudeOrigin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trustedClaudeAlternateOrigin",
    () => trustedClaudeAlternateOrigin,
    (value) => {
      trustedClaudeAlternateOrigin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "routerOptionKeys",
    () => routerOptionKeys,
    (value) => {
      routerOptionKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksOnPointerEnterOnPointerLeaveOnPointerDownConfig",
    () => CdsLinksOnPointerEnterOnPointerLeaveOnPointerDownConfig,
    (value) => {
      CdsLinksOnPointerEnterOnPointerLeaveOnPointerDownConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsLinksKeysValue",
    () => CdsLinksKeysValue,
    (value) => {
      CdsLinksKeysValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeLinkRouter",
    () => initializeLinkRouter,
    (value) => {
      initializeLinkRouter = value;
    },
  );
  return () => {
    initializeCdsLinks = (0, runtime.initializeOnce)((): Dynamic => {
      CdsLinksPattern = /[\t\n\r]/g;
    });
    initializeCdsLinks_2 = (0, runtime.initializeOnce)((): Dynamic => {
      CdsLinksSubscribers = new Set(["_self", "_parent", "_top"]);
      CdsLinksOpenerReferrerPattern = /^no(?:opener|referrer)$/i;
    });
    initializeLinkRouter = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      initializeCdsLinks();
      initializeCdsLinks_2();
      reactCdsLinks = (0, runtime.toModuleNamespace)((0, runtime.load_react)());
      LinkRouterContext = (0, reactCdsLinks.createContext)(undefined);
      CdsLinksPattern_2 = /[\x00-\x1f\x7f-\x9f]/;
      CdsLinksPattern_3 = /^\s/;
      CdsLinksPattern_4 = /^[/\\]{2}/;
      CdsLinksPattern_5 = /^[/\\](?![/\\])/;
      CdsLinksPattern_6 = /^[^/\\]/;
      CdsLinksPattern_7 = /\/(?:\.|%2e){1,2}(?:\/|$)/i;
      CdsLinksPattern_8 = /^(?:\.|%2e){1,2}$/i;
      CdsLinksPattern_9 = /\\|%2e/i;
      // CucCut: the Claude app schemes (claude, claude-cli, claude-nest) are not link targets here.
      CdsLinksHttpsMailtoPattern = /^(?:https?|mailto|tel|slack|blob):/i;
      CdsLinksIntentPattern = /^intent:/i;
      CdsLinksVscodeCursorPattern = /^(?:vscode|cursor):/i;
      // CucCut: no first-party editor extensions; only VS Code settings links are followed.
      CdsLinksVscodeCursorPattern_2 =
        /^vscode:\/\/settings\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
      CdsLinksSubscribers_2 = new Set([
        "scheme",
        "package",
        "S.browser_fallback_url",
      ]);
      CdsLinksPattern_10 = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
      // CucCut: no first-party web domains or Android apps; every external link is treated as "other".
      CdsLinksItems = [];
      CdsLinksSubscribers_3 = new Set();
      trustedClaudeOrigin = "https://cds-relative-href.invalid";
      trustedClaudeAlternateOrigin = "http://cds-relative-href.invalid";
      routerOptionKeys = [
        "onClick",
        "onPointerEnter",
        "onPointerLeave",
        "onPointerDown",
        "onFocus",
        "onBlur",
      ];
      CdsLinksOnPointerEnterOnPointerLeaveOnPointerDownConfig = {
        onPointerEnter: true,
        onPointerLeave: false,
        onPointerDown: true,
        onFocus: true,
        onBlur: false,
      };
      CdsLinksKeysValue = Object.keys(
        CdsLinksOnPointerEnterOnPointerLeaveOnPointerDownConfig,
      );
    });
  };
}
