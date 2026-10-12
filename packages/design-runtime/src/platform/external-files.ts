/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformExternalFiles(
  runtime: RuntimeBindings,
): () => void {
  var PlatformExternalFilesItems: Dynamic;
  var PlatformExternalFilesResolvedValue: Dynamic;
  var parseFileReferencesValue: Dynamic;
  var PlatformExternalFilesProjectWoffPattern: Dynamic;
  var PlatformExternalFilesSubscribers: Dynamic;
  var PlatformExternalFilesMapValue: Dynamic;
  var PlatformExternalFilesResolvedValue_2: Dynamic;
  var PlatformExternalFilesSubscribers_2: Dynamic;
  var PlatformExternalFilesAlias: Dynamic;
  function getAllFileReferencePaths(): Dynamic {
    return [
      ...PlatformExternalFilesResolvedValue,
      ...parseFileReferencesValue.map((input?: Dynamic): Dynamic => input.path),
      ...PlatformExternalFilesMapValue.map(
        (input?: Dynamic): Dynamic => input.path,
      ),
    ];
  }
  function parseFontFileReferences(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    if (input === null || typeof input != "object" || Array.isArray(input))
      return items;
    let index: Dynamic = 0,
      items2: Dynamic = [];
    for (let [value, value2] of Object.entries(input) as Dynamic) {
      let value3: Dynamic = value.slice(runtime.ProjectValue.length),
        value4: Dynamic = value2?.size;
      if (
        !(
          !(0, runtime.isFullProjectPath)(value) ||
          PlatformExternalFilesSubscribers.has(value.toLowerCase()) ||
          PlatformExternalFilesProjectWoffPattern.test(value)
        )
      ) {
        if ((0, runtime.isTypeDeclarationPath)(value3)) {
          items2.length < runtime.PlatformFileReferencesLimit_2 &&
          !(
            typeof value4 == "number" &&
            value4 > runtime.PlatformFileContentResolvedValue_10
          )
            ? items2.push({
                path: value3,
                file: value,
                ...(typeof value4 == "number"
                  ? {
                      bytes: value4,
                    }
                  : {}),
              })
            : index++;
          continue;
        }
        if (
          !(0, runtime.isProjectTextFilePath)(value3) ||
          items.length >= runtime.PlatformFileReferencesLimit ||
          (typeof value4 == "number" &&
            value4 > runtime.PlatformFileReferencesResolvedValue)
        ) {
          index++;
          continue;
        }
        items.push({
          path: value3,
          file: value,
          ...(typeof value4 == "number"
            ? {
                bytes: value4,
              }
            : {}),
        });
      }
    }
    return Object.assign(
      items,
      index > 0
        ? {
            dropped: index,
          }
        : {},
      items2.length > 0
        ? {
            types: items2,
          }
        : {},
    );
  }
  function setExternalFileReferences(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    options ??= (0, runtime.sameOriginFileFetcher)();
    PlatformExternalFilesSubscribers_2 = new Set(context);
    PlatformExternalFilesMapValue = [...input]
      .sort(
        ([input2]: Dynamic, [options2]: Dynamic): Dynamic =>
          input2 < options2 ? -1 : input2 > options2 ? 1 : 0,
      )
      .map(
        ([input2, input3]: Dynamic): Dynamic => ({
          path: input2,
          file: input3.ref.startsWith("blob:")
            ? input3.ref
            : "/" + input3.ref.replace(/^\//, ""),
          ...(input3.bytes > 0
            ? {
                bytes: input3.bytes,
              }
            : {}),
        }),
      );
    (0, runtime.setDeclarationReferences)(
      getTypeDeclarationReferences(),
      options,
    );
  }
  function getExternalFileReferences(): Dynamic {
    return PlatformExternalFilesMapValue.map(
      (input?: Dynamic): Dynamic => ({
        path: input.path,
        ref: input.file.replace(/^\//, ""),
      }),
    );
  }
  function setFileReferenceStore(input?: Dynamic): Dynamic {
    PlatformExternalFilesAlias = input;
  }
  async function saveExternalFileReference(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Promise<Dynamic> {
    if (PlatformExternalFilesAlias === undefined) return "no-store";
    let value2: Dynamic = (0, runtime.encodeStorePathSegment)(
      input,
    ).toLowerCase();
    return extra(input) ||
      PlatformExternalFilesMapValue.some(
        (input2?: Dynamic): Dynamic =>
          input2.path.toLowerCase() === input.toLowerCase(),
      ) ||
      [...PlatformExternalFilesSubscribers_2].some(
        (input2?: Dynamic): Dynamic => input2.toLowerCase() === value2,
      )
      ? "taken"
      : (PlatformExternalFilesSubscribers_2.add(
          (0, runtime.encodeStorePathSegment)(input),
        ),
        await PlatformExternalFilesAlias.set(
          runtime.FilesValue + "/" + (0, runtime.encodeStorePathSegment)(input),
          {
            path: input,
            kind: "text",
            dataRef: options,
            dataBytes: context,
            contentType: value,
          },
        ),
        "written");
  }
  function getTypeDeclarationReferences(): Dynamic {
    let value: Dynamic = PlatformExternalFilesMapValue.filter(
      (input?: Dynamic): Dynamic =>
        (0, runtime.isTypeDeclarationPath)(input.path) &&
        !((input.bytes ?? 0) > runtime.PlatformFileContentResolvedValue_10),
    );
    return [
      ...value,
      ...PlatformExternalFilesResolvedValue_2.filter(
        (input?: Dynamic): Dynamic =>
          !value.some(
            (input2?: Dynamic): Dynamic => input2.path === input.path,
          ),
      ),
    ].slice(0, runtime.PlatformFileReferencesLimit_2);
  }
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesItems",
    () => PlatformExternalFilesItems,
    (value) => {
      PlatformExternalFilesItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesResolvedValue",
    () => PlatformExternalFilesResolvedValue,
    (value) => {
      PlatformExternalFilesResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseFileReferencesValue",
    () => parseFileReferencesValue,
    (value) => {
      parseFileReferencesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getAllFileReferencePaths",
    () => getAllFileReferencePaths,
  );
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesProjectWoffPattern",
    () => PlatformExternalFilesProjectWoffPattern,
    (value) => {
      PlatformExternalFilesProjectWoffPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesSubscribers",
    () => PlatformExternalFilesSubscribers,
    (value) => {
      PlatformExternalFilesSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseFontFileReferences",
    () => parseFontFileReferences,
  );
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesMapValue",
    () => PlatformExternalFilesMapValue,
    (value) => {
      PlatformExternalFilesMapValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesResolvedValue_2",
    () => PlatformExternalFilesResolvedValue_2,
    (value) => {
      PlatformExternalFilesResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesSubscribers_2",
    () => PlatformExternalFilesSubscribers_2,
    (value) => {
      PlatformExternalFilesSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setExternalFileReferences",
    () => setExternalFileReferences,
  );
  bindRuntimeValue(
    runtime,
    "getExternalFileReferences",
    () => getExternalFileReferences,
  );
  bindRuntimeValue(
    runtime,
    "PlatformExternalFilesAlias",
    () => PlatformExternalFilesAlias,
    (value) => {
      PlatformExternalFilesAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setFileReferenceStore",
    () => setFileReferenceStore,
  );
  bindRuntimeValue(
    runtime,
    "saveExternalFileReference",
    () => saveExternalFileReference,
  );
  bindRuntimeValue(
    runtime,
    "getTypeDeclarationReferences",
    () => getTypeDeclarationReferences,
  );
  return () => {
    PlatformExternalFilesItems = [];
    PlatformExternalFilesResolvedValue = [];
    parseFileReferencesValue = [];
    PlatformExternalFilesProjectWoffPattern =
      /^project\/ds\/[^/]+\/.+\.(woff2|woff|ttf|otf)$/i;
    PlatformExternalFilesSubscribers = new Set([
      runtime.ProjectValue + "manifest.json",
      runtime.ProjectValue + "design-system.json",
    ]);
    PlatformExternalFilesMapValue = [];
    PlatformExternalFilesResolvedValue_2 = [];
    PlatformExternalFilesSubscribers_2 = new Set();
  };
}
