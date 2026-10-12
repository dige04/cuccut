/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportReadme(runtime: RuntimeBindings): () => void {
  function designExportReadme(
    title?: Dynamic,
    files?: Dynamic,
    scripts?: Dynamic,
    assets?: Dynamic,
  ): Dynamic {
    return [
      "# " + title + " \u2014 design reference",
      "",
      "This is a design mockup created in a visual design tool, exported as a",
      "standalone page. Treat it as a REFERENCE MOCKUP, not production code:",
      "the markup and inline styles carry the design's precise values \u2014 colors,",
      "font sizes, spacing, radii, shadows, layout \u2014 which an implementation",
      "should replicate faithfully in its own components and styling system",
      "rather than copy wholesale.",
      "",
      "## Contents",
      "",
      "- `" + files + "` \u2014 the artboard (a Design Component: an `<x-dc>`",
      "  template + a small logic class). The values to replicate live in its",
      '  inline `style="\u2026"` attributes and the `<helmet><style>` block.',
      ...scripts.map(
        (input?: Dynamic): Dynamic =>
          "- `" + input + "` \u2014 referenced resource",
      ),
      ...(assets.entries.length > 0
        ? [
            "- `assets/` \u2014 files uploaded to the design (images, fonts, media)",
          ]
        : []),
      "- `support.js`, `vendor/react*.js` \u2014 the runtime that renders the",
      "  component in a browser; not part of the design.",
      "",
      ...uploadedAssetsReadmeSection(assets),
      "## Viewing",
      "",
      "Serve the folder (e.g. `python3 -m http.server`) and open `" +
        files +
        "`;",
      "some browsers block the scripts over file://.",
      "",
    ].join(`
`);
  }
  function uploadedAssetsReadmeSection(assets?: Dynamic): Dynamic {
    if (!assets.mentionsUploads) return [];
    let items: Dynamic = [
      "## Uploaded files",
      "",
      "Images, fonts and media uploaded to the design are written once each under",
      "`assets/` \u2014 " +
        String(assets.entries.length) +
        " in this export \u2014 and the exported files refer to them there. A",
      "reference a script puts together while the page runs (for example",
      '`"/_blob/" + id`) is not rewritten and does not load from this folder.',
      "",
    ];
    assets.missing.length > 0 &&
      items.push(
        "### Missing from this export",
        "",
        "These uploaded files could not be included, so wherever the design uses",
        "them they do not load. Exporting again may pick them up.",
        "",
        ...assets.missing.map(
          (input?: Dynamic): Dynamic =>
            "- `" +
            input.ref +
            "` (used in " +
            input.usedIn
              .map((input2?: Dynamic): Dynamic => "`" + input2 + "`")
              .join(", ") +
            ") \u2014 " +
            input.why,
        ),
        "",
      );
    return items;
  }
  function missingExportAssetSuffix(missingAssets?: Dynamic): Dynamic {
    if (missingAssets.length !== 0)
      return missingAssets.length === 1
        ? "but one uploaded file could not be included. README.md in the zip names it and says why."
        : "but " +
            String(missingAssets.length) +
            " uploaded files could not be included. README.md in the zip lists them and says why.";
  }
  bindRuntimeValue(runtime, "designExportReadme", () => designExportReadme);
  bindRuntimeValue(
    runtime,
    "uploadedAssetsReadmeSection",
    () => uploadedAssetsReadmeSection,
  );
  bindRuntimeValue(
    runtime,
    "missingExportAssetSuffix",
    () => missingExportAssetSuffix,
  );
  return () => {};
}
