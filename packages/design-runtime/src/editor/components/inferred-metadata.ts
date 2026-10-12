/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsInferredMetadata(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsInferredMetadataAZaZPattern: Dynamic;
  var ComponentsInferredMetadataPattern: Dynamic;
  function inferredTypeToPropMetadata(source?: Dynamic): Dynamic {
    let value: Dynamic =
      source.kind === "enum"
        ? {
            editor: "enum",
            options: (source.options ?? []).map(
              (input?: Dynamic): Dynamic =>
                (0, runtime.convertInferredEnumValue)(source, input),
            ),
          }
        : source.kind === "boolean"
          ? {
              editor: "boolean",
            }
          : source.kind === "number"
            ? {
                editor: "float",
              }
            : {
                editor: "text",
                ...(source.typeName !== undefined
                  ? {
                      tsType: source.typeName,
                    }
                  : {}),
              };
    source.default !== undefined && (value.default = source.default);
    return value;
  }
  function inferredPropsMetadata(input?: Dynamic): Dynamic {
    return Object.fromEntries(
      input.map(
        (input2?: Dynamic): Dynamic => [
          input2.name,
          inferredTypeToPropMetadata(input2),
        ],
      ),
    );
  }
  function templatePropReferences(
    input?: Dynamic,
    options: Dynamic = false,
  ): Dynamic {
    let value: Dynamic = [
      ...input.matchAll(ComponentsInferredMetadataAZaZPattern),
    ].map((input2?: Dynamic): Dynamic => input2[1]);
    return value.length !==
      (input.match(ComponentsInferredMetadataPattern)?.length ?? 0)
      ? []
      : options &&
          (value.length !== 1 ||
            input.replace(ComponentsInferredMetadataAZaZPattern, "").trim() !==
              "")
        ? []
        : value;
  }
  function canEditBoundComponentProps(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    items?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    if (items.length === 0 || input.tagName(options) !== "dc-import")
      return false;
    let value: Dynamic = input.attributes(options);
    return (
      (value.name ?? value.component) === context &&
      items.every((input2?: Dynamic): Dynamic => extra.has(input2))
    );
  }
  bindRuntimeValue(
    runtime,
    "inferredTypeToPropMetadata",
    () => inferredTypeToPropMetadata,
  );
  bindRuntimeValue(
    runtime,
    "inferredPropsMetadata",
    () => inferredPropsMetadata,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsInferredMetadataAZaZPattern",
    () => ComponentsInferredMetadataAZaZPattern,
    (value) => {
      ComponentsInferredMetadataAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsInferredMetadataPattern",
    () => ComponentsInferredMetadataPattern,
    (value) => {
      ComponentsInferredMetadataPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "templatePropReferences",
    () => templatePropReferences,
  );
  bindRuntimeValue(
    runtime,
    "canEditBoundComponentProps",
    () => canEditBoundComponentProps,
  );
  return () => {
    ComponentsInferredMetadataAZaZPattern = /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g;
    ComponentsInferredMetadataPattern = /\{\{[\s\S]*?\}\}/g;
  };
}
