/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCommentsLabels(runtime: RuntimeBindings): () => void {
  var commentLabelTextEncoder: Dynamic;
  var commentLabelByteLength: Dynamic;
  var quoteCommentLabelText: Dynamic;
  var commentBreadcrumbSeparator: Dynamic;
  var commentElementDetail: Dynamic;
  var commentElementsDetail: Dynamic;
  var commentAreaPartLabel: Dynamic;
  var commentAnnotationKindLabels: Dynamic;
  var commentAnnotationKindLabel: Dynamic;
  var formatCommentPercent: Dynamic;
  var commentObjectTransformSuffix: Dynamic;
  var commentObjectDetail: Dynamic;
  var commentAnchorInsetPixels: Dynamic;
  var commentAnchorInsetFraction: Dynamic;
  function replaceUnpairedSurrogates(value?: Dynamic): Dynamic {
    return value.replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      "\uFFFD",
    );
  }
  function shortenCommentLabelText(
    value?: Dynamic,
    limit: Dynamic = 40,
  ): Dynamic {
    let value2: Dynamic = Array.from(
      replaceUnpairedSurrogates(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/"/g, "\u2019"),
    );
    return value2.length <= limit
      ? value2.join("")
      : value2
          .slice(0, Math.max(0, limit - 1))
          .join("")
          .trimEnd() + "\u2026";
  }
  function truncateCommentLabelBytes(
    value?: Dynamic,
    maxBytes?: Dynamic,
  ): Dynamic {
    if (commentLabelByteLength(value) <= maxBytes) return value;
    let value2: Dynamic = Array.from(value),
      length: Dynamic = value2.length;
    for (
      ;
      length > 0 &&
      commentLabelByteLength(
        value2.slice(0, length).join("").trimEnd() + "\u2026",
      ) > maxBytes;

    )
      length--;
    return value2.slice(0, length).join("").trimEnd() + "\u2026";
  }
  function fitCommentDetailToByteBudget(format?: Dynamic): Dynamic {
    for (let value of [40, 16, null] as Dynamic) {
      let value2: Dynamic = format(value);
      if (commentLabelByteLength(value2) <= 512) return value2;
    }
    return truncateCommentLabelBytes(format(null), 512);
  }
  function commentArtboardTitle(artboard?: Dynamic): Dynamic {
    return replaceUnpairedSurrogates(
      artboard.title?.trim() || artboard.file.replace(/\.dc\.html$/, ""),
    );
  }
  function commentElementKindLabel(kind?: Dynamic): Dynamic {
    return kind === "box" || kind === "shape"
      ? "shape"
      : kind == null || kind === "other"
        ? "element"
        : kind;
  }
  function commentObjectShortLabel(
    kind?: Dynamic,
    text?: Dynamic,
    reservedBytes: Dynamic = 0,
  ): Dynamic {
    for (let count: Dynamic = 40; count >= 8; count -= 8) {
      let value: Dynamic =
        kind + quoteCommentLabelText(shortenCommentLabelText(text, count));
      if (commentLabelByteLength(value) <= 128 - reservedBytes) return value;
    }
    return truncateCommentLabelBytes(kind, 128 - reservedBytes);
  }
  function describeCommentElement(model?: Dynamic, target?: Dynamic): Dynamic {
    let value: Dynamic =
      target.tid != null ? model?.viewEntries([target.tid])[0] : undefined;
    return value
      ? {
          kind: value.kind,
          text: value.words(),
        }
      : {
          kind: target.tag
            ? (0, runtime.classifyElementStyleKind)(target.tag)
            : null,
          text: target.text,
        };
  }
  function commentAnchorShortLabel(anchor?: Dynamic): Dynamic {
    if (anchor.kind === "canvas") {
      let value2: Dynamic = anchor.pages ?? [],
        value3: Dynamic =
          value2.length > 1
            ? anchor.pageKey
              ? value2.find(
                  (input?: Dynamic): Dynamic => input.id === anchor.pageKey,
                )
              : value2[0]
            : undefined,
        text: Dynamic = " \xB7 canvas";
      return value3
        ? truncateCommentLabelBytes(
            replaceUnpairedSurrogates(value3.name),
            128 - commentLabelByteLength(text),
          ) + text
        : "Canvas";
    }
    if (anchor.kind === "note")
      return commentObjectShortLabel(
        commentAnnotationKindLabel(anchor.note.kind),
        (anchor.note.text ?? "").trim().split(`
`)[0],
      );
    let value: Dynamic = commentArtboardTitle(anchor.board);
    return anchor.kind === "artboard"
      ? truncateCommentLabelBytes(value, 128)
      : commentObjectShortLabel(
          truncateCommentLabelBytes(value, 128) +
            commentBreadcrumbSeparator +
            commentElementKindLabel(anchor.el.kind),
          anchor.el.text,
        );
  }
  function commentFileLabel(file?: Dynamic): Dynamic {
    return (
      (0, runtime.encodeArtboardSelectionPath)(file) ??
      replaceUnpairedSurrogates(file)
    );
  }
  function commentArtboardAreaShortLabel(artboards?: Dynamic): Dynamic {
    if (artboards.length === 1) {
      let value2: Dynamic = artboards[0],
        value3: Dynamic =
          value2.cov < 0.85 ? (value2.total ?? value2.els?.length ?? 0) : 0,
        value4: Dynamic =
          value3 === 0
            ? ""
            : " \xB7 " +
              String(value3) +
              (value3 === 1 ? " element" : " elements"),
        value5: Dynamic =
          (value2.cov < 0.85 ? commentAreaPartLabel(value2.part) : "") + value4;
      return (
        truncateCommentLabelBytes(
          commentArtboardTitle(value2.board),
          128 - commentLabelByteLength(value5),
        ) + value5
      );
    }
    let value: Dynamic = artboards.map(
      (input?: Dynamic): Dynamic =>
        commentArtboardTitle(input.board) +
        (input.cov < 0.85 ? commentAreaPartLabel(input.part) : ""),
    );
    for (let length: Dynamic = value.length; length >= 1; length--) {
      let value2: Dynamic =
          length < value.length
            ? " +" + String(value.length - length) + " more"
            : "",
        value3: Dynamic =
          "Artboards: " + value.slice(0, length).join(", ") + value2;
      if (commentLabelByteLength(value3) <= 128) return value3;
      if (length === 1) {
        let value4: Dynamic = artboards[0],
          value5: Dynamic =
            value4.cov < 0.85 ? commentAreaPartLabel(value4.part) : "";
        return (
          truncateCommentLabelBytes(
            "Artboards: " + commentArtboardTitle(value4.board),
            128 - commentLabelByteLength(value5 + value2),
          ) +
          value5 +
          value2
        );
      }
    }
    return "Artboards";
  }
  function commentObjectPointDetail(
    object?: Dynamic,
    point?: Dynamic,
  ): Dynamic {
    let value: Dynamic = point
      ? object.kind === "line" || object.kind === "arrow"
        ? " at " + formatCommentPercent(point.fx) + " along from its start"
        : " at " +
          formatCommentPercent(point.fx) +
          " across, " +
          formatCommentPercent(point.fy) +
          " down" +
          commentObjectTransformSuffix(object)
      : "";
    return fitCommentDetailToByteBudget(
      (input?: Dynamic): Dynamic => commentObjectDetail(object, input) + value,
    );
  }
  function commentObjectAreaShortLabel(
    object?: Dynamic,
    area?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.describeCommentAreaLocation)(
        area,
        (area.x1 - area.x0) * (area.y1 - area.y0),
      ),
      value2: Dynamic = value ? " (" + value + ")" : "";
    return (
      commentObjectShortLabel(
        commentAnnotationKindLabel(object.kind),
        (object.text ?? "").trim().split(`
`)[0],
        commentLabelByteLength(value2),
      ) + value2
    );
  }
  function commentObjectAreaDetail(object?: Dynamic, area?: Dynamic): Dynamic {
    let value: Dynamic =
      (area.x1 - area.x0) * (area.y1 - area.y0) >= 0.85
        ? " (whole)"
        : ": " +
          formatCommentPercent(area.x0) +
          " to " +
          formatCommentPercent(area.x1) +
          " across, " +
          formatCommentPercent(area.y0) +
          " to " +
          formatCommentPercent(area.y1) +
          " down" +
          commentObjectTransformSuffix(object);
    return fitCommentDetailToByteBudget(
      (input?: Dynamic): Dynamic =>
        "area over " + commentObjectDetail(object, input) + value,
    );
  }
  function commentCanvasPointDetail(x?: Dynamic, y?: Dynamic): Dynamic {
    return "canvas " + String(Math.round(x)) + "," + String(Math.round(y));
  }
  function commentArtboardElementDetail(
    artboard?: Dynamic,
    element?: Dynamic,
  ): Dynamic {
    let value: Dynamic = commentFileLabel(artboard.file);
    return fitCommentDetailToByteBudget(
      (input?: Dynamic): Dynamic =>
        element ? value + ": " + commentElementDetail(element, input) : value,
    );
  }
  function commentArtboardAreaDetail(artboards?: Dynamic): Dynamic {
    let callback: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value?: Dynamic,
      ): Dynamic => {
        let value2: Dynamic = artboards
            .slice(0, value)
            .map((input2?: Dynamic): Dynamic => {
              let value4: Dynamic =
                  commentFileLabel(input2.board.file) +
                  " (" +
                  (input2.cov >= 0.85 ? "whole" : input2.part || "part") +
                  ")",
                value5: Dynamic =
                  context && input2.cov < 0.85 && (input2.els?.length ?? 0) > 0
                    ? ": " + commentElementsDetail(input2, options, input)
                    : "";
              return value4 + value5;
            }),
          value3: Dynamic = artboards.length - value;
        return (
          "Area over " +
          value2.join("; ") +
          (value3 > 0
            ? "; +" + String(value3) + (value3 === 1 ? " board" : " boards")
            : "")
        );
      },
      items: Dynamic = [
        [40, 8, true],
        [16, 8, true],
        [null, 8, true],
        [null, 4, true],
        [null, 2, true],
        [null, 0, false],
      ];
    for (let [value, value2, value3] of items as Dynamic) {
      let value4: Dynamic = callback(value, value2, value3, artboards.length);
      if (commentLabelByteLength(value4) <= 512) return value4;
    }
    for (let value: Dynamic = artboards.length - 1; value >= 1; value--) {
      let value2: Dynamic = callback(null, 0, false, value);
      if (commentLabelByteLength(value2) <= 512) return value2;
    }
    return fitCommentDetailToByteBudget(
      (): Dynamic => callback(null, 0, false, 1),
    );
  }
  function defaultArtboardCommentPoint(
    box?: Dynamic,
    scale?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Number.isFinite(scale) && scale > 0 ? scale : 1,
      value2: Dynamic = Math.max(0, box.w) || 1,
      value3: Dynamic = Math.max(0, box.h) || 1,
      value4: Dynamic = Math.min(
        commentAnchorInsetPixels / value,
        value2 * commentAnchorInsetFraction,
        value3 * commentAnchorInsetFraction,
      );
    return {
      fx: 1 - value4 / value2,
      fy: value4 / value3,
    };
  }
  function commentSurfaceAriaLabel(surface?: Dynamic): Dynamic {
    if (surface.kind === "artboard")
      return "Comment on artboard " + commentAnchorShortLabel(surface);
    let value: Dynamic = surface.pages ?? [],
      value2: Dynamic =
        value.length > 1
          ? surface.pageKey
            ? value.find(
                (input?: Dynamic): Dynamic => input.id === surface.pageKey,
              )
            : value[0]
          : undefined;
    return "Comment on the canvas" + (value2 ? ", page " + value2.name : "");
  }
  function commentTargetKeyboardHint(target?: Dynamic): Dynamic {
    return [
      "Enter or Space comments on " +
        (target.canvas ? "the canvas" : "this artboard"),
      ...(target.several ? ["Tab moves between artboards"] : []),
      "Escape leaves comment mode",
    ].join("; ");
  }
  function isCommentTargetEvent(event?: Dynamic): Dynamic {
    return (
      event.target instanceof Element &&
      event.target.hasAttribute("data-mega-comment-target")
    );
  }
  function clampCommentAreaToViewport(
    area?: Dynamic,
    viewportWidth?: Dynamic,
    viewportHeight?: Dynamic,
    minSize: Dynamic = 8,
  ): Dynamic {
    let callback: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => Math.max(options, Math.min(context, input)),
      value: Dynamic = callback(
        area.x,
        0,
        Math.max(0, viewportWidth - minSize),
      ),
      value2: Dynamic = callback(
        area.y,
        0,
        Math.max(0, viewportHeight - minSize),
      ),
      value3: Dynamic = callback(
        area.x + area.w,
        value + minSize,
        Math.max(viewportWidth, value + minSize),
      ),
      value4: Dynamic = callback(
        area.y + area.h,
        value2 + minSize,
        Math.max(viewportHeight, value2 + minSize),
      );
    return {
      x: value,
      y: value2,
      w: value3 - value,
      h: value4 - value2,
    };
  }
  bindRuntimeValue(
    runtime,
    "commentLabelTextEncoder",
    () => commentLabelTextEncoder,
    (value) => {
      commentLabelTextEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentLabelByteLength",
    () => commentLabelByteLength,
    (value) => {
      commentLabelByteLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "replaceUnpairedSurrogates",
    () => replaceUnpairedSurrogates,
  );
  bindRuntimeValue(
    runtime,
    "shortenCommentLabelText",
    () => shortenCommentLabelText,
  );
  bindRuntimeValue(
    runtime,
    "quoteCommentLabelText",
    () => quoteCommentLabelText,
    (value) => {
      quoteCommentLabelText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "truncateCommentLabelBytes",
    () => truncateCommentLabelBytes,
  );
  bindRuntimeValue(
    runtime,
    "fitCommentDetailToByteBudget",
    () => fitCommentDetailToByteBudget,
  );
  bindRuntimeValue(runtime, "commentArtboardTitle", () => commentArtboardTitle);
  bindRuntimeValue(
    runtime,
    "commentElementKindLabel",
    () => commentElementKindLabel,
  );
  bindRuntimeValue(
    runtime,
    "commentBreadcrumbSeparator",
    () => commentBreadcrumbSeparator,
    (value) => {
      commentBreadcrumbSeparator = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentObjectShortLabel",
    () => commentObjectShortLabel,
  );
  bindRuntimeValue(
    runtime,
    "describeCommentElement",
    () => describeCommentElement,
  );
  bindRuntimeValue(
    runtime,
    "commentAnchorShortLabel",
    () => commentAnchorShortLabel,
  );
  bindRuntimeValue(runtime, "commentFileLabel", () => commentFileLabel);
  bindRuntimeValue(
    runtime,
    "commentElementDetail",
    () => commentElementDetail,
    (value) => {
      commentElementDetail = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentElementsDetail",
    () => commentElementsDetail,
    (value) => {
      commentElementsDetail = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentAreaPartLabel",
    () => commentAreaPartLabel,
    (value) => {
      commentAreaPartLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentArtboardAreaShortLabel",
    () => commentArtboardAreaShortLabel,
  );
  bindRuntimeValue(
    runtime,
    "commentAnnotationKindLabels",
    () => commentAnnotationKindLabels,
    (value) => {
      commentAnnotationKindLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentAnnotationKindLabel",
    () => commentAnnotationKindLabel,
    (value) => {
      commentAnnotationKindLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatCommentPercent",
    () => formatCommentPercent,
    (value) => {
      formatCommentPercent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentObjectTransformSuffix",
    () => commentObjectTransformSuffix,
    (value) => {
      commentObjectTransformSuffix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentObjectDetail",
    () => commentObjectDetail,
    (value) => {
      commentObjectDetail = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentObjectPointDetail",
    () => commentObjectPointDetail,
  );
  bindRuntimeValue(
    runtime,
    "commentObjectAreaShortLabel",
    () => commentObjectAreaShortLabel,
  );
  bindRuntimeValue(
    runtime,
    "commentObjectAreaDetail",
    () => commentObjectAreaDetail,
  );
  bindRuntimeValue(
    runtime,
    "commentCanvasPointDetail",
    () => commentCanvasPointDetail,
  );
  bindRuntimeValue(
    runtime,
    "commentArtboardElementDetail",
    () => commentArtboardElementDetail,
  );
  bindRuntimeValue(
    runtime,
    "commentArtboardAreaDetail",
    () => commentArtboardAreaDetail,
  );
  bindRuntimeValue(
    runtime,
    "commentAnchorInsetPixels",
    () => commentAnchorInsetPixels,
    (value) => {
      commentAnchorInsetPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentAnchorInsetFraction",
    () => commentAnchorInsetFraction,
    (value) => {
      commentAnchorInsetFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultArtboardCommentPoint",
    () => defaultArtboardCommentPoint,
  );
  bindRuntimeValue(
    runtime,
    "commentSurfaceAriaLabel",
    () => commentSurfaceAriaLabel,
  );
  bindRuntimeValue(
    runtime,
    "commentTargetKeyboardHint",
    () => commentTargetKeyboardHint,
  );
  bindRuntimeValue(runtime, "isCommentTargetEvent", () => isCommentTargetEvent);
  bindRuntimeValue(
    runtime,
    "clampCommentAreaToViewport",
    () => clampCommentAreaToViewport,
  );
  return () => {
    commentLabelTextEncoder = new TextEncoder();
    commentLabelByteLength = (input?: Dynamic): Dynamic =>
      commentLabelTextEncoder.encode(input).length;
    quoteCommentLabelText = (input?: Dynamic): Dynamic =>
      input ? ' "' + input + '"' : "";
    commentBreadcrumbSeparator = " \u203A ";
    commentElementDetail = (source?: Dynamic, options?: Dynamic): Dynamic =>
      "#" +
      source.path +
      " " +
      (source.kind === "box" ? "shape" : source.kind) +
      (options == null
        ? ""
        : quoteCommentLabelText(shortenCommentLabelText(source.text, options)));
    commentElementsDetail = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      let value: Dynamic = input.els ?? [],
        value2: Dynamic = value.slice(0, options),
        value3: Dynamic = (input.total ?? value.length) - value2.length,
        value4: Dynamic = value2.map(
          (input2?: Dynamic): Dynamic => commentElementDetail(input2, context),
        );
      value3 > 0 && value4.push("+" + String(value3) + " more");
      return value4.join(", ");
    };
    commentAreaPartLabel = (input?: Dynamic): Dynamic =>
      input ? " (" + input + ")" : "";
    commentAnnotationKindLabels = {
      title1: "Title",
      rect: "Rectangle",
      oval: "Oval",
      line: "Line",
      arrow: "Arrow",
      pen: "Drawing",
      image: "Picture",
    };
    commentAnnotationKindLabel = (input?: Dynamic): Dynamic =>
      input === undefined ? "Note" : commentAnnotationKindLabels[input];
    formatCommentPercent = (input?: Dynamic): Dynamic =>
      String(Math.round(input * 100)) + "%";
    commentObjectTransformSuffix = (input?: Dynamic): Dynamic => {
      let value: Dynamic = [
        input.rotate ? "turn" : "",
        input.flipX || input.flipY ? "flip" : "",
      ]
        .filter(Boolean)
        .join(" and ");
      return " from its top left" + (value ? ", before its " + value : "");
    };
    commentObjectDetail = (source?: Dynamic, options?: Dynamic): Dynamic =>
      commentAnnotationKindLabel(source.kind).toLowerCase() +
      (options == null || source.text == null
        ? ""
        : quoteCommentLabelText(
            shortenCommentLabelText(
              source.text.trim().split(`
`)[0],
              options,
            ),
          ));
    commentAnchorInsetPixels = 16;
    commentAnchorInsetFraction = 0.25;
  };
}
