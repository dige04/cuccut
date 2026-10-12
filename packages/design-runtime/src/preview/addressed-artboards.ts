/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewAddressedArtboards(
  runtime: RuntimeBindings,
): () => void {
  var PreviewAddressedArtboardsHtmlPattern: Dynamic;
  var PreviewAddressedArtboardsPattern: Dynamic;
  var PreviewAddressedArtboardsSupportPattern: Dynamic;
  var PreviewAddressedArtboardsTest: Dynamic;
  var PreviewAddressedArtboardsHandler: Dynamic;
  var HttpsProjectInvalidValue: Dynamic;
  var PreviewAddressedArtboardsResolvedValue: Dynamic;
  var PreviewAddressedArtboardsCache: Dynamic;
  function hasExactFileReference(input?: Dynamic, options?: Dynamic): Dynamic {
    for (
      let value: Dynamic = input.indexOf(options);
      value >= 0;
      value = input.indexOf(options, value + 1)
    ) {
      let value2: Dynamic = value === 0 ? "" : input[value - 1];
      if (
        value2 === "" ||
        !/[A-Za-z0-9_.%/-]/.test(value2) ||
        (value2 === "/" &&
          input[value - 2] === "." &&
          !/[A-Za-z0-9_.%/-]/.test(input[value - 3] ?? ""))
      )
        return true;
    }
    return false;
  }
  function projectReferenceTokens(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.decodeHtmlAttributeEntities)(input);
    return (value === input ? [input] : [input, value]).flatMap(
      (input2?: Dynamic): Dynamic => input2.match(/[\w.~%/\\:@!$&*+-]+/g) ?? [],
    );
  }
  function resolveProjectReference(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic;
    try {
      value = new URL(input, PreviewAddressedArtboardsResolvedValue + options);
    } catch {
      return;
    }
    if (value.origin === HttpsProjectInvalidValue) {
      if (!value.pathname.startsWith("/p/")) return null;
      try {
        return decodeURIComponent(value.pathname.slice(3));
      } catch {
        return value.pathname.slice(3);
      }
    }
  }
  function referencesOutsideProject(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return projectReferenceTokens(input).some(
      (input2?: Dynamic): Dynamic =>
        /\.\.|%2e/i.test(input2) &&
        resolveProjectReference(input2, options) === null,
    );
  }
  function addressedArtboardRefusal(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = PreviewAddressedArtboardsCache.get(options);
    if (
      entry !== undefined &&
      entry.text === input &&
      entry.native === context &&
      entry.paths === extra
    )
      return entry.why;
    let value2: Dynamic = ((): Dynamic => {
      if (input.includes("/appifact/"))
        return options + " names a path under /appifact/";
      if (referencesOutsideProject(input, context))
        return options + " names a path that climbs above the project folder";
      if (
        !PreviewAddressedArtboardsPattern.test(options) &&
        /\bimport\s*\(/.test(input)
      )
        return options + " imports a module as it runs";
      for (let value3 of value as Dynamic)
        if (
          value3 !== options &&
          PreviewAddressedArtboardsHandler(input, "/" + value3)
        )
          return options + " names " + value3 + " from the root";
      for (let value3 of projectReferenceTokens(input) as Dynamic) {
        if (!/^\/(?!\/)/.test(value3)) continue;
        let value4: Dynamic = (0, runtime.resolveProjectAssetPath)(
          context,
          value3,
        );
        if (
          value4 !== null &&
          value4 !== options &&
          value.includes(value4) &&
          resolveProjectReference(value3, context) !== value4
        )
          return options + " names " + value4 + " from the root";
      }
      for (let value3 of value as Dynamic)
        if (
          value3 !== options &&
          context !== "" &&
          runtime.PlatformFileContentWebpAvifPattern.test(value3) &&
          PreviewAddressedArtboardsHandler(input, value3)
        )
          return options + " names " + value3 + " from the project folder";
    })();
    PreviewAddressedArtboardsCache.set(options, {
      text: input,
      native: context,
      paths: extra,
      why: value2,
    });
    return value2;
  }
  function addressedRuntimeRefusal(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.maskHtmlRawContent)(input);
    for (let [value2, value3] of (0, runtime.findHtmlTags)(
      value,
      "base",
    ) as Dynamic)
      if (
        (0, runtime.getHtmlAttribute)(input.slice(value2, value3), "href") !==
        null
      )
        return "a base element of its own";
    for (let [value2, value3] of (0, runtime.findHtmlTags)(
      value,
      "script",
    ) as Dynamic) {
      let value4: Dynamic = input.slice(value2, value3),
        value5: Dynamic = (0, runtime.getHtmlAttribute)(value4, "src"),
        value6: Dynamic =
          ((0, runtime.getHtmlAttribute)(value4, "type") ?? "")
            .trim()
            .toLowerCase() === "module";
      if (value5 === null) {
        if (value6) return "an inline module script";
        continue;
      }
      let value7: Dynamic = (0, runtime.resolveProjectAssetPath)(
        options,
        value5,
      );
      if (!(value7 === null || context[value7] == null)) {
        if (value6) return "a module script names " + value7;
        if ((0, runtime.getHtmlAttribute)(value4, "async") !== null)
          return "an async script names " + value7;
      }
    }
  }
  function isRequiredProjectFile(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return input === options || context.has(input) || value.has(input);
  }
  function filterAddressedFiles(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic;
    return input.filter(
      (input2?: Dynamic): Dynamic =>
        isRequiredProjectFile(input2, options, context, value) ||
        input2 in (value2 ??= extra()),
    );
  }
  function buildAddressedArtboard(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context.projectRoot === undefined)
      return {
        copied:
          "the published files are not known for the version the editor's page addresses, or one of them did not load",
      };
    let value: Dynamic = input[options];
    if (value == null)
      return {
        copied: "the artboard's file is not among the editor's files",
      };
    if ((0, runtime.isLoadingArtboardHtml)(value))
      return {
        copied: "the artboard's content has not arrived",
      };
    if (!context.publishedAtAddress(options))
      return {
        copied:
          "the artboard's file is not in the published version the editor shows",
      };
    let value2: Dynamic = (0, runtime.PreviewAssetRewritingSlice)(options),
      value3: Dynamic = Object.keys(input),
      value4: Dynamic = value3.join(`
`),
      state: Dynamic = {};
    for (let value6 of value3 as Dynamic) {
      let value7: Dynamic = input[value6];
      if (PreviewAddressedArtboardsSupportPattern.test(value6))
        return {
          copied: "the canvas holds a runtime file of its own: " + value6,
        };
      if (PreviewAddressedArtboardsTest(value6)) {
        if ((0, runtime.PreviewAssetRewritingSlice)(value6) !== value2)
          return {
            copied: "the artboard uses a page from another folder: " + value6,
          };
        if (
          value6 !== options &&
          (0, runtime.rewriteHtmlDependencies)(value7, input, value2) !== value7
        )
          return {
            copied:
              "a component names a stored stylesheet or script: " + value6,
          };
        let value9: Dynamic = addressedRuntimeRefusal(value7, value2, input);
        if (value9 !== undefined)
          return {
            copied: value9 + " in " + value6,
          };
        state[value6] = value7;
      } else {
        if (!context.publishedAsHeld(value6, value7))
          return {
            copied: "not published with the bytes the editor holds: " + value6,
          };
        if (
          (0, runtime.isProjectSourcePath)(value6) &&
          (0, runtime.normalizeBlobAssetPaths)(value7) !== value7
        )
          return {
            copied:
              'an uploaded file named as "_blob/" and not "/_blob/" in ' +
              value6,
          };
      }
      if (runtime.PlatformFileContentWebpAvifPattern.test(value6)) continue;
      let value8: Dynamic = addressedArtboardRefusal(
        value7,
        value6,
        PreviewAddressedArtboardsPattern.test(value6)
          ? (0, runtime.PreviewAssetRewritingSlice)(value6)
          : value2,
        value3,
        value4,
      );
      if (value8 !== undefined)
        return {
          copied: value8,
        };
    }
    let pathname: Dynamic = new URL(context.projectRoot).pathname,
      value5: Dynamic =
        context.projectRoot +
        options.split("/").map(encodeURIComponent).join("/");
    return {
      projectRoot: context.projectRoot,
      projectPath: pathname,
      pageUrl: value5,
      files: state,
    };
  }
  function validateAddressedArtboard(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (
      value.projectRoot !== undefined &&
      value.projectRoot !== context &&
      !value.describes(context)
    )
      return "the list of files no longer describes the version the artboard was built for, or a file did not load from it";
    let value2: Dynamic = buildAddressedArtboard(input, options, value);
    return "copied" in value2 ? value2.copied : undefined;
  }
  function addressedProjectState(): Dynamic {
    return {
      projectRoot: (0, runtime.getCurrentPublishedProjectRoot)(),
      publishedAsHeld: runtime.isFilePublishedWithMimeType,
      publishedAtAddress: runtime.isFilePublishedAtAddress,
      describes: runtime.describesPublishedRoot,
    };
  }
  function resolveAddressedArtboard(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return context
      ? buildAddressedArtboard(input, options, addressedProjectState())
      : {
          copied: "the flag is off",
        };
  }
  function addressedArtboardFailure(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return validateAddressedArtboard(
      (0, runtime.collectProjectDependencyFiles)(input, options),
      options,
      context,
      addressedProjectState(),
    );
  }
  function addressedArtboardCacheKey(input?: Dynamic): Dynamic {
    return input ? (0, runtime.publishedProjectCacheKey)() : "";
  }
  bindRuntimeValue(
    runtime,
    "PreviewAddressedArtboardsHtmlPattern",
    () => PreviewAddressedArtboardsHtmlPattern,
    (value) => {
      PreviewAddressedArtboardsHtmlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewAddressedArtboardsPattern",
    () => PreviewAddressedArtboardsPattern,
    (value) => {
      PreviewAddressedArtboardsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewAddressedArtboardsSupportPattern",
    () => PreviewAddressedArtboardsSupportPattern,
    (value) => {
      PreviewAddressedArtboardsSupportPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewAddressedArtboardsTest",
    () => PreviewAddressedArtboardsTest,
    (value) => {
      PreviewAddressedArtboardsTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasExactFileReference",
    () => hasExactFileReference,
  );
  bindRuntimeValue(
    runtime,
    "PreviewAddressedArtboardsHandler",
    () => PreviewAddressedArtboardsHandler,
    (value) => {
      PreviewAddressedArtboardsHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HttpsProjectInvalidValue",
    () => HttpsProjectInvalidValue,
    (value) => {
      HttpsProjectInvalidValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewAddressedArtboardsResolvedValue",
    () => PreviewAddressedArtboardsResolvedValue,
    (value) => {
      PreviewAddressedArtboardsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "projectReferenceTokens",
    () => projectReferenceTokens,
  );
  bindRuntimeValue(
    runtime,
    "resolveProjectReference",
    () => resolveProjectReference,
  );
  bindRuntimeValue(
    runtime,
    "referencesOutsideProject",
    () => referencesOutsideProject,
  );
  bindRuntimeValue(
    runtime,
    "PreviewAddressedArtboardsCache",
    () => PreviewAddressedArtboardsCache,
    (value) => {
      PreviewAddressedArtboardsCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "addressedArtboardRefusal",
    () => addressedArtboardRefusal,
  );
  bindRuntimeValue(
    runtime,
    "addressedRuntimeRefusal",
    () => addressedRuntimeRefusal,
  );
  bindRuntimeValue(
    runtime,
    "isRequiredProjectFile",
    () => isRequiredProjectFile,
  );
  bindRuntimeValue(runtime, "filterAddressedFiles", () => filterAddressedFiles);
  bindRuntimeValue(
    runtime,
    "buildAddressedArtboard",
    () => buildAddressedArtboard,
  );
  bindRuntimeValue(
    runtime,
    "validateAddressedArtboard",
    () => validateAddressedArtboard,
  );
  bindRuntimeValue(
    runtime,
    "addressedProjectState",
    () => addressedProjectState,
  );
  bindRuntimeValue(
    runtime,
    "resolveAddressedArtboard",
    () => resolveAddressedArtboard,
  );
  bindRuntimeValue(
    runtime,
    "addressedArtboardFailure",
    () => addressedArtboardFailure,
  );
  bindRuntimeValue(
    runtime,
    "addressedArtboardCacheKey",
    () => addressedArtboardCacheKey,
  );
  return () => {
    PreviewAddressedArtboardsHtmlPattern = /\.dc\.html$/i;
    PreviewAddressedArtboardsPattern = /\.css$/i;
    PreviewAddressedArtboardsSupportPattern = /(^|\/)support\.js$/;
    PreviewAddressedArtboardsTest = (input?: Dynamic): Dynamic =>
      PreviewAddressedArtboardsHtmlPattern.test(input);
    PreviewAddressedArtboardsHandler = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      hasExactFileReference(input, options) ||
      (encodeURI(options) !== options &&
        hasExactFileReference(input, encodeURI(options)));
    HttpsProjectInvalidValue = "https://project.invalid";
    PreviewAddressedArtboardsResolvedValue = HttpsProjectInvalidValue + "/p/";
    PreviewAddressedArtboardsCache = new Map();
  };
}
