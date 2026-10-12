/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installEditorTools(runtime: RuntimeBindings): () => void {
  var isHostOnlyDesignTool: Dynamic;
  var runtimeDesignTool: Dynamic;
  var shapeDesignTools: Dynamic;
  var insertDesignTools: Dynamic;
  var designToolLabels: Dynamic;
  var ShapeToolGlyph: Dynamic;
  var shapesMenuIcon: Dynamic;
  var insertMenuIcon: Dynamic;
  var designToolIcons: Dynamic;
  var defaultRectangleSize: Dynamic;
  var defaultOvalSize: Dynamic;
  var defaultLineLength: Dynamic;
  var drawToolExitGracePeriodMs: Dynamic;
  var defaultToolTemplates: Dynamic;
  var passiveEditorEvents: Dynamic;
  var clickPlacementTools: Dynamic;
  var defaultClickPlacementSizes: Dynamic;
  function DesignToolToolbar({ tool: tool, onTool: onTool }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.toolbarDensity)(),
      value2: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic =>
          onTool(input === tool && input !== "select" ? "select" : input),
      );
    (0, runtime.npm_useEventListener_bc)(
      "keydown",
      (event?: Dynamic): Dynamic => {
        if (
          event.defaultPrevented ||
          event.repeat ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey
        )
          return;
        let value3: Dynamic =
          event.target instanceof HTMLElement ? event.target : null;
        if (
          value3 !== null &&
          (/^(INPUT|TEXTAREA|SELECT)$/.test(value3.tagName) ||
            value3.isContentEditable)
        )
          return;
        if (event.key === "Escape") {
          if (tool === "select" || (0, runtime.hasBlockingEditorOverlay)())
            return;
          event.preventDefault();
          onTool("select");
          return;
        }
        if (
          (0, runtime.isPropertyEditorTarget)(value3) ||
          value3?.closest("[data-mega-selection-strip]") != null ||
          (0, runtime.shouldKeepLocalKeyboardEvent)(event) ||
          (0, runtime.hasBlockingEditorOverlay)()
        )
          return;
        let value4: Dynamic = designToolForShortcut(event.key, event.shiftKey);
        value4 !== null && (event.preventDefault(), value2(value4));
      },
    );
    return (
      <runtime.CdsIsland density={value} className={"contents"}>
        <runtime.CanvasToolSelector tool={tool} onPick={value2} />
      </runtime.CdsIsland>
    );
  }
  function designToolForShortcut(key?: Dynamic, shiftKey?: Dynamic): Dynamic {
    let value: Dynamic = key.toLowerCase();
    if (shiftKey) return value === "l" ? "arrow" : null;
    switch (value) {
      case "h":
        return "hand";
      case "r":
        return "rect";
      case "a":
        return "frame";
      case "n":
        return "note";
      case "o":
        return "oval";
      case "t":
        return "text";
      case "l":
        return "line";
      case "p":
        return "draw";
      default:
        return null;
    }
  }
  function supportsClickPlacement(tool?: Dynamic): Dynamic {
    return tool != null && clickPlacementTools.has(tool);
  }
  function focusProModeButton(editorRoot?: Dynamic): Dynamic {
    (document as Dynamic).hasFocus() &&
      editorRoot?.querySelector('[data-testid="dc-mode-pro"]')?.focus({
        preventScroll: true,
      });
  }
  bindRuntimeValue(runtime, "DesignToolToolbar", () => DesignToolToolbar);
  bindRuntimeValue(
    runtime,
    "designToolForShortcut",
    () => designToolForShortcut,
  );
  bindRuntimeValue(
    runtime,
    "isHostOnlyDesignTool",
    () => isHostOnlyDesignTool,
    (value) => {
      isHostOnlyDesignTool = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "runtimeDesignTool",
    () => runtimeDesignTool,
    (value) => {
      runtimeDesignTool = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapeDesignTools",
    () => shapeDesignTools,
    (value) => {
      shapeDesignTools = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "insertDesignTools",
    () => insertDesignTools,
    (value) => {
      insertDesignTools = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designToolLabels",
    () => designToolLabels,
    (value) => {
      designToolLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ShapeToolGlyph",
    () => ShapeToolGlyph,
    (value) => {
      ShapeToolGlyph = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shapesMenuIcon",
    () => shapesMenuIcon,
    (value) => {
      shapesMenuIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "insertMenuIcon",
    () => insertMenuIcon,
    (value) => {
      insertMenuIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designToolIcons",
    () => designToolIcons,
    (value) => {
      designToolIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultRectangleSize",
    () => defaultRectangleSize,
    (value) => {
      defaultRectangleSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultOvalSize",
    () => defaultOvalSize,
    (value) => {
      defaultOvalSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultLineLength",
    () => defaultLineLength,
    (value) => {
      defaultLineLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "drawToolExitGracePeriodMs",
    () => drawToolExitGracePeriodMs,
    (value) => {
      drawToolExitGracePeriodMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultToolTemplates",
    () => defaultToolTemplates,
    (value) => {
      defaultToolTemplates = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "passiveEditorEvents",
    () => passiveEditorEvents,
    (value) => {
      passiveEditorEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clickPlacementTools",
    () => clickPlacementTools,
    (value) => {
      clickPlacementTools = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsClickPlacement",
    () => supportsClickPlacement,
  );
  bindRuntimeValue(
    runtime,
    "defaultClickPlacementSizes",
    () => defaultClickPlacementSizes,
    (value) => {
      defaultClickPlacementSizes = value;
    },
  );
  bindRuntimeValue(runtime, "focusProModeButton", () => focusProModeButton);
  return () => {
    isHostOnlyDesignTool = (input?: Dynamic): Dynamic =>
      input === "frame" || input === "note" || input === "hand";
    runtimeDesignTool = (input?: Dynamic): Dynamic =>
      input === "note" || input === "hand" ? "select" : input;
    shapeDesignTools = ["rect", "oval", "arrow", "line"];
    insertDesignTools = [
      "hand",
      "text",
      "frame",
      "note",
      "draw",
      ...shapeDesignTools,
    ];
    designToolLabels = {
      hand: "Hand",
      text: "Text",
      frame: "Artboard",
      note: "Note",
      draw: "Draw",
      rect: "Rectangle",
      oval: "Oval",
      arrow: "Arrow",
      line: "Line",
    };
    ShapeToolGlyph = (input?: Dynamic): Dynamic => (
      <runtime.Icon customIcon={input} size={"auto"} className={"shrink-0"} />
    );
    shapesMenuIcon = {
      icon: "Shapes",
    };
    insertMenuIcon = {
      icon: "Add",
    };
    designToolIcons = {
      hand: {
        icon: "Hand",
      },
      text: {
        glyph: runtime.SessionTouchAndHistoryJsxValue,
      },
      frame: {
        glyph: runtime.SessionTouchAndHistoryJsxValue_2,
      },
      note: {
        icon: "Note",
      },
      draw: {
        icon: "Edit",
      },
      rect: {
        glyph: (
          <runtime.Icon
            customIcon={runtime.ChromeToolIconsRectOvalConfig.rect}
            size={"auto"}
          />
        ),
      },
      oval: {
        glyph: (
          <runtime.Icon
            customIcon={runtime.ChromeToolIconsRectOvalConfig.oval}
            size={"auto"}
          />
        ),
      },
      arrow: {
        icon: "ArrowLine",
      },
      line: {
        icon: "LineSegment",
      },
    };
    defaultRectangleSize = 120;
    defaultOvalSize = 96;
    defaultLineLength = 160;
    drawToolExitGracePeriodMs = 5e3;
    defaultToolTemplates = {
      rect: `<div style="box-sizing: border-box; display: flex; flex-direction: column; width: ${defaultRectangleSize}px; height: ${defaultRectangleSize}px; background-color: ${runtime.B6b0a7Value}; border-radius: 8px"></div>`,
      frame:
        '<div style="box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; padding: 16px; background-color: #ffffff; border-radius: 2px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)"></div>',
      grid: '<div style="box-sizing: border-box; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px; background-color: #ffffff; border-radius: 2px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)"></div>',
      oval: `<div style="box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; width: ${defaultOvalSize}px; height: ${defaultOvalSize}px; background-color: ${runtime.B6b0a7Value}; border-radius: 50%"></div>`,
      text: `<div style="font-size: 16px; line-height: 1">${runtime.TextPlaceholderLabel}</div>`,
      arrow: "",
      line: (0, runtime.lineDrawingHtml)(
        defaultLineLength,
        0,
        1,
        1,
        "",
        runtime.defaultAnnotationStrokeColor,
      ),
      draw: "",
      note: "",
      interact: "",
      vector: "",
    };
    passiveEditorEvents = new Set([
      "select",
      "chrome",
      "directiveState",
      "zoom",
      "panZoom",
      "pointerPresence",
      "pointerAt",
      "dragState",
      "canvasPointerDown",
      "contextMenu",
    ]);
    clickPlacementTools = new Set(["text", "rect", "oval", "arrow", "line"]);
    defaultClickPlacementSizes = {
      text: [0, 0],
      rect: [defaultRectangleSize, defaultRectangleSize],
      oval: [defaultOvalSize, defaultOvalSize],
      arrow: [defaultLineLength, 0],
      line: [defaultLineLength, 0],
    };
  };
}
