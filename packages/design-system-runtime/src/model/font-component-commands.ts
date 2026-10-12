/** Restored application module; prepare first, initialize in original order. */
import type * as Model from "../contracts";
import type * as Core from "../contracts/model-core";
import type { UploadFontInput } from "../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelFontComponentCommands(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  function componentGuidelinesPath(
    system: Model.ParsedDesignSystem,
    componentName: string,
  ) {
    return (
      system.components.find((input): boolean => input.name === componentName)
        ?.guidelinesPath ??
      runtime.DESIGN_SYSTEM_PATHS.componentsDir +
        componentName +
        "/" +
        runtime.COMPONENT_FILENAMES.readme
    );
  }
  function setComponentGuidelines(
    content: Model.DesignSystemContent,
    componentName: string,
    markdown: string,
  ) {
    let system = (0, runtime.parsedDesignSystem)(content);
    if (
      !runtime.COMPONENT_NAME_PATTERN.test(componentName) ||
      !system.components.some((input): boolean => input.name === componentName)
    ) {
      return content;
    }
    let path = componentGuidelinesPath(system, componentName);
    if ((content.files[path] ?? "") === markdown) {
      return content;
    }
    if (markdown === "") {
      return (0, runtime.deleteDesignSystemFiles)(content, [path]);
    }
    return (0, runtime.setDesignSystemFile)(content, path, markdown);
  }
  function addFontFace(
    content: Model.DesignSystemContent,
    font: UploadFontInput,
  ): Model.DesignSystemContent {
    let family = font.family.trim();
    if (
      family === "" ||
      !runtime.FONT_STACK_PATTERN.test(family) ||
      /["']/.test(family)
    ) {
      return content;
    }
    if (
      (0, runtime.parseDataUriHeader)(font.value) === null &&
      (0, runtime.parseStoragePointer)(font.value) === null
    ) {
      return content;
    }
    let filename = (0, runtime.unusedFileName)(
        content.files,
        "fonts",
        (0, runtime.sanitizeUploadFileName)(font.fileName),
      ),
      path = runtime.DESIGN_SYSTEM_PATHS.fontsDir + filename;
    if ((0, runtime.isTextFilePath)(path)) {
      return content;
    }
    let withFile = (0, runtime.setDesignSystemFile)(content, path, font.value);
    if (withFile === content) {
      return content;
    }
    if (
      font.record !== undefined &&
      (0, runtime.parseStoragePointer)(font.value) !== null
    ) {
      withFile = (0, runtime.setFileStorageRecord)(withFile, path, font.record);
    }
    let withFont = (0, runtime.updateTokens)(withFile, (input): boolean => {
      let state: Model.FontFace = {
        family: family,
        file: path,
        weight: font.weight.trim() || "400",
        style: font.style,
      };
      input.type.fonts.push(state);
      return true;
    });
    if (withFont === withFile) {
      return content;
    } else {
      return withFont;
    }
  }
  function deleteFontFace(
    content: Model.DesignSystemContent,
    path: string,
  ): Model.DesignSystemContent {
    let withoutFile = (0, runtime.deleteDesignSystemFiles)(content, [path]),
      withoutFont = (0, runtime.updateTokens)(withoutFile, (input): boolean => {
        let length = input.type.fonts.length;
        input.type.fonts = input.type.fonts.filter(
          (input2): boolean => input2.file !== path,
        );
        if (input.type.fonts.length === length) {
          return false;
        }
        (0, runtime.pruneUnusedFontFamilies)(input);
        return true;
      });
    if (withoutFont === content) {
      return content;
    } else {
      return withoutFont;
    }
  }
  function removeMissingFontReferences(
    content: Model.DesignSystemContent,
  ): Model.DesignSystemContent {
    return (0, runtime.updateTokens)(content, (input): boolean => {
      let length = input.type.fonts.length;
      input.type.fonts = input.type.fonts.filter((input2) =>
        Object.hasOwn(content.files, input2.file),
      );
      if (input.type.fonts.length === length) {
        return false;
      }
      (0, runtime.pruneUnusedFontFamilies)(input);
      return true;
    });
  }
  bindRuntimeValue(
    runtime,
    "componentGuidelinesPath",
    () => componentGuidelinesPath,
  );
  bindRuntimeValue(
    runtime,
    "setComponentGuidelines",
    () => setComponentGuidelines,
  );
  bindRuntimeValue(runtime, "addFontFace", () => addFontFace);
  bindRuntimeValue(runtime, "deleteFontFace", () => deleteFontFace);
  bindRuntimeValue(
    runtime,
    "removeMissingFontReferences",
    () => removeMissingFontReferences,
  );
  return () => {};
}
