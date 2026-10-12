/** Restored application module; prepare first, initialize in original order. */
import type * as Model from "../contracts";
import type * as Core from "../contracts/model-core";
import type { UploadFontInput } from "../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelLibraries(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var PACKAGED_LIBRARY_CATALOG: Core.PackagedLibrary[];
  var REACT_LIBRARY_CATALOG: Core.PackagedLibrary[];
  var LIBRARY_NAME_PATTERN: RegExp;
  var LIBRARY_VERSION_PATTERN: RegExp;
  var PACKAGED_LIBRARY_PATH_PATTERN: RegExp;
  function findPackagedLibrary(
    name: string,
    catalog = PACKAGED_LIBRARY_CATALOG,
  ) {
    return catalog.find((input): boolean => input.name === name);
  }
  function matchesLibraryVersion(
    availableVersion: string,
    requestedVersion: string,
  ) {
    if (availableVersion === requestedVersion) {
      return true;
    }
    return availableVersion.startsWith(requestedVersion + ".");
  }
  function resolvePreviewLibraries(
    declared: Model.DeclaredLibrary[],
    hasFile: (path: string) => boolean = (): boolean => false,
    catalog = PACKAGED_LIBRARY_CATALOG,
    allowCdn = false,
  ) {
    let load: Model.LoadedLibrary[] = [],
      fetchLibraries: Model.FetchLibrary[] = [],
      missing: string[] = [],
      missingFiles: string[] = [],
      visited = new Set<string>(),
      visit = (input: Model.DeclaredLibrary): void => {
        if (visited.has(input.name)) {
          return;
        }
        visited.add(input.name);
        let value = catalog.find(
          (input2) =>
            input2.name === input.name &&
            matchesLibraryVersion(input2.version, input.version),
        );
        if (value !== undefined) {
          for (let value3 of value.requires) {
            let value4 = findPackagedLibrary(value3, catalog);
            if (value4 === undefined) {
              continue;
            }
            visit(
              declared.find((input2): boolean => input2.name === value3) ?? {
                name: value4.name,
                version: value4.version,
              },
            );
          }
        }
        let value2 = input.file ?? value?.packedFile;
        if (value2 !== undefined && hasFile(value2)) {
          load.push({
            name: input.name,
            version: input.version,
            global: input.global ?? value?.provides[0] ?? null,
            file: value2,
          });
        } else if (
          allowCdn &&
          value !== undefined &&
          value.requires.every((input2) =>
            fetchLibraries.some((input3): boolean => input3.name === input2),
          )
        ) {
          fetchLibraries.push({
            name: value.name,
            version: value.version,
            global: value.provides[0] ?? null,
            url: value.cdn.url,
            integrity: value.cdn.integrity,
          });
        } else if (
          (missing.push(input.name + " " + input.version), value2 !== undefined)
        ) {
          missingFiles.push(value2);
        }
      };
    for (let value of declared) {
      visit(value);
    }
    return {
      load: load,
      fetch: fetchLibraries,
      missing: missing,
      missingFiles: missingFiles,
    };
  }
  function serializeResolvedLibraries(
    declared: Model.DeclaredLibrary[],
    resolved: Model.ResolvedLibraries,
    catalog = PACKAGED_LIBRARY_CATALOG,
  ) {
    return declared.map((input) => {
      let value = resolved.load.find(
          (input2): boolean => input2.name === input.name,
        ),
        value2 =
          input.global ?? findPackagedLibrary(input.name, catalog)?.provides[0];
      return {
        name: input.name,
        version: input.version,
        ...(value2 !== undefined
          ? {
              global: value2,
            }
          : {}),
        ...(value !== undefined
          ? {
              file: value.file,
            }
          : {}),
      };
    });
  }
  function inferDeclaredLibraries(
    declared: Model.DeclaredLibrary[],
    hasFile: (path: string) => boolean,
    catalog = PACKAGED_LIBRARY_CATALOG,
  ) {
    if (declared.length > 0) {
      return declared.map((input) => ({
        ...input,
      }));
    }
    return catalog
      .filter((input) => hasFile(input.packedFile))
      .map((input) => ({
        name: input.name,
        version: input.version.split(".")[0],
      }));
  }
  bindRuntimeValue(
    runtime,
    "PACKAGED_LIBRARY_CATALOG",
    () => PACKAGED_LIBRARY_CATALOG,
    (value) => {
      PACKAGED_LIBRARY_CATALOG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REACT_LIBRARY_CATALOG",
    () => REACT_LIBRARY_CATALOG,
    (value) => {
      REACT_LIBRARY_CATALOG = value;
    },
  );
  bindRuntimeValue(runtime, "findPackagedLibrary", () => findPackagedLibrary);
  bindRuntimeValue(
    runtime,
    "LIBRARY_NAME_PATTERN",
    () => LIBRARY_NAME_PATTERN,
    (value) => {
      LIBRARY_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIBRARY_VERSION_PATTERN",
    () => LIBRARY_VERSION_PATTERN,
    (value) => {
      LIBRARY_VERSION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PACKAGED_LIBRARY_PATH_PATTERN",
    () => PACKAGED_LIBRARY_PATH_PATTERN,
    (value) => {
      PACKAGED_LIBRARY_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "matchesLibraryVersion",
    () => matchesLibraryVersion,
  );
  bindRuntimeValue(
    runtime,
    "resolvePreviewLibraries",
    () => resolvePreviewLibraries,
  );
  bindRuntimeValue(
    runtime,
    "serializeResolvedLibraries",
    () => serializeResolvedLibraries,
  );
  bindRuntimeValue(
    runtime,
    "inferDeclaredLibraries",
    () => inferDeclaredLibraries,
  );
  return () => {
    // CucCut: previews take React 18.3.1 from the editor page's own copy (artifact-type/vendor/, put there by
    // apps/design-system-editor/build.mjs), not from jsDelivr: CucCut's CSP admits no CDN, and the desktop app
    // works offline. The files are the npm package's UMD builds, the same bytes jsDelivr serves, so the integrity
    // values stay. The address is root-relative, as editor/swatch-runtime.tsx requires.
    let pageVendorUrl = (file: string): string => {
      try {
        return new URL("artifact-type/vendor/" + file, document.baseURI).pathname;
      } catch {
        return "/artifact-type/vendor/" + file;
      }
    };
    PACKAGED_LIBRARY_CATALOG = [
      {
        name: "react",
        version: "18.3.1",
        provides: ["React"],
        requires: [],
        packedFile:
          runtime.DESIGN_SYSTEM_PATHS.libDir + "react.production.min.js",
        sha256:
          "d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd",
        cdn: {
          url: pageVendorUrl("react.production.min.js"),
          integrity:
            "sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z",
        },
      },
      {
        name: "react-dom",
        version: "18.3.1",
        provides: ["ReactDOM"],
        requires: ["react"],
        packedFile:
          runtime.DESIGN_SYSTEM_PATHS.libDir + "react-dom.production.min.js",
        sha256:
          "35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d",
        cdn: {
          url: pageVendorUrl("react-dom.production.min.js"),
          integrity:
            "sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1",
        },
      },
    ];
    REACT_LIBRARY_CATALOG = PACKAGED_LIBRARY_CATALOG.filter(
      (input) => input.name === "react" || input.name === "react-dom",
    );
    LIBRARY_NAME_PATTERN = /^[a-z][a-z0-9._-]{0,40}$/;
    LIBRARY_VERSION_PATTERN = /^\d{1,4}(?:\.\d{1,4}){0,2}$/;
    PACKAGED_LIBRARY_PATH_PATTERN = /^components\/lib\/[^/]{1,120}\.m?js$/;
  };
}
