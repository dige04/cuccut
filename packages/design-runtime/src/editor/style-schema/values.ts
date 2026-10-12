/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorStyleSchemaValues(
  runtime: RuntimeBindings,
): () => void {
  var StyleSchemaValuesSansSerifMonoConfig: Dynamic;
  var StyleSchemaValuesHandler: Dynamic;
  var StyleSchemaValuesHandler_2: Dynamic;
  var StyleSchemaValuesHandler_3: Dynamic;
  var StyleSchemaValuesHandler_4: Dynamic;
  var StyleSchemaValuesKindConfig: Dynamic;
  var StyleSchemaValuesLimit: Dynamic;
  var StyleSchemaValuesClosestSideClosestCornerFarthestSideValues: Dynamic;
  var StyleSchemaValuesItems: Dynamic;
  var StyleSchemaValuesItems_2: Dynamic;
  var StyleSchemaValuesItems_3: Dynamic;
  var StyleSchemaValuesBoxShadowTextShadowFilterValues: Dynamic;
  var StyleSchemaValuesTransformOpacityColorValues: Dynamic;
  var StyleSchemaValuesColorBackgroundColorBackgroundGradientValues: Dynamic;
  var StyleSchemaValuesSubscribers: Dynamic;
  var StyleSchemaValuesSubscribers_2: Dynamic;
  var StyleSchemaValuesSubscribers_3: Dynamic;
  var StyleSchemaValuesSubscribers_4: Dynamic;
  var StyleSchemaValuesRegistry: Dynamic;

  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesSansSerifMonoConfig",
    () => StyleSchemaValuesSansSerifMonoConfig,
    (value) => {
      StyleSchemaValuesSansSerifMonoConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandler",
    () => StyleSchemaValuesHandler,
    (value) => {
      StyleSchemaValuesHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandler_2",
    () => StyleSchemaValuesHandler_2,
    (value) => {
      StyleSchemaValuesHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandler_3",
    () => StyleSchemaValuesHandler_3,
    (value) => {
      StyleSchemaValuesHandler_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandler_4",
    () => StyleSchemaValuesHandler_4,
    (value) => {
      StyleSchemaValuesHandler_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesKindConfig",
    () => StyleSchemaValuesKindConfig,
    (value) => {
      StyleSchemaValuesKindConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesLimit",
    () => StyleSchemaValuesLimit,
    (value) => {
      StyleSchemaValuesLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesClosestSideClosestCornerFarthestSideValues",
    () => StyleSchemaValuesClosestSideClosestCornerFarthestSideValues,
    (value) => {
      StyleSchemaValuesClosestSideClosestCornerFarthestSideValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesItems",
    () => StyleSchemaValuesItems,
    (value) => {
      StyleSchemaValuesItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesItems_2",
    () => StyleSchemaValuesItems_2,
    (value) => {
      StyleSchemaValuesItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesItems_3",
    () => StyleSchemaValuesItems_3,
    (value) => {
      StyleSchemaValuesItems_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesBoxShadowTextShadowFilterValues",
    () => StyleSchemaValuesBoxShadowTextShadowFilterValues,
    (value) => {
      StyleSchemaValuesBoxShadowTextShadowFilterValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesTransformOpacityColorValues",
    () => StyleSchemaValuesTransformOpacityColorValues,
    (value) => {
      StyleSchemaValuesTransformOpacityColorValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesColorBackgroundColorBackgroundGradientValues",
    () => StyleSchemaValuesColorBackgroundColorBackgroundGradientValues,
    (value) => {
      StyleSchemaValuesColorBackgroundColorBackgroundGradientValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesSubscribers",
    () => StyleSchemaValuesSubscribers,
    (value) => {
      StyleSchemaValuesSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesSubscribers_2",
    () => StyleSchemaValuesSubscribers_2,
    (value) => {
      StyleSchemaValuesSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesSubscribers_3",
    () => StyleSchemaValuesSubscribers_3,
    (value) => {
      StyleSchemaValuesSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesSubscribers_4",
    () => StyleSchemaValuesSubscribers_4,
    (value) => {
      StyleSchemaValuesSubscribers_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesRegistry",
    () => StyleSchemaValuesRegistry,
    (value) => {
      StyleSchemaValuesRegistry = value;
    },
  );
  return () => {
    StyleSchemaValuesSansSerifMonoConfig = {
      sans: "ui-sans-serif, system-ui, sans-serif",
      serif: "ui-serif, Georgia, serif",
      mono: "ui-monospace, Menlo, Consolas, monospace",
      helvetica: "Helvetica Neue, Helvetica, Arial, sans-serif",
    };
    StyleSchemaValuesHandler = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => ({
      kind: "len",
      lo: input,
      hi: options,
    });
    StyleSchemaValuesHandler_2 = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => ({
      kind: "num",
      lo: input,
      hi: options,
    });
    StyleSchemaValuesHandler_3 = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => ({
      kind: "int",
      lo: input,
      hi: options,
      step: context,
    });
    StyleSchemaValuesHandler_4 = (input?: Dynamic): Dynamic => ({
      kind: "enum",
      values: input,
    });
    StyleSchemaValuesKindConfig = {
      kind: "color",
    };
    StyleSchemaValuesLimit = 8;
    StyleSchemaValuesClosestSideClosestCornerFarthestSideValues = [
      "closest-side",
      "closest-corner",
      "farthest-side",
    ];
    StyleSchemaValuesItems = [
      {
        field: "blur",
        cls: StyleSchemaValuesHandler(0, 20),
        fn: "blur",
        unit: "px",
      },
      {
        field: "brightness",
        cls: StyleSchemaValuesHandler_2(0, 2),
        fn: "brightness",
        unit: "",
      },
      {
        field: "contrast",
        cls: StyleSchemaValuesHandler_2(0, 2),
        fn: "contrast",
        unit: "",
      },
      {
        field: "saturate",
        cls: StyleSchemaValuesHandler_2(0, 3),
        fn: "saturate",
        unit: "",
      },
      {
        field: "grayscale",
        cls: StyleSchemaValuesHandler_2(0, 1),
        fn: "grayscale",
        unit: "",
      },
      {
        field: "sepia",
        cls: StyleSchemaValuesHandler_2(0, 1),
        fn: "sepia",
        unit: "",
      },
      {
        field: "invert",
        cls: StyleSchemaValuesHandler_2(0, 1),
        fn: "invert",
        unit: "",
      },
      {
        field: "hueRotate",
        cls: StyleSchemaValuesHandler_2(0, 360),
        fn: "hue-rotate",
        unit: "deg",
      },
    ];
    StyleSchemaValuesItems_2 = [
      {
        field: "translateX",
        cls: StyleSchemaValuesHandler(-4096, 4096),
      },
      {
        field: "translateY",
        cls: StyleSchemaValuesHandler(-4096, 4096),
      },
      {
        field: "rotate",
        cls: StyleSchemaValuesHandler_2(-180, 180),
      },
      {
        field: "scale",
        cls: StyleSchemaValuesHandler_2(0.5, 2),
      },
      {
        field: "skewX",
        cls: StyleSchemaValuesHandler_2(-60, 60),
      },
      {
        field: "skewY",
        cls: StyleSchemaValuesHandler_2(-60, 60),
      },
    ];
    StyleSchemaValuesItems_3 = [
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "textAlign",
      "textTransform",
      "textDecorationLine",
      "textDecorationStyle",
      "textDecorationColor",
      "fontFamily",
      "fontVariantNumeric",
      "color",
      "backgroundColor",
      "backgroundGradient",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderWidth",
      "borderStyle",
      "borderColor",
      "borderSides",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "borderRadius",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
      "opacity",
      "boxShadow",
      "textShadow",
      "textStrokeWidth",
      "textStrokeColor",
      "filter",
      "backdropFilter",
      "transform",
      "mixBlendMode",
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "zIndex",
      "float",
      "display",
      "visibility",
      "overflow",
      "pointerEvents",
      "cursor",
      "width",
      "height",
      "minWidth",
      "minHeight",
      "maxWidth",
      "maxHeight",
      "transition",
      "animation",
    ];
    StyleSchemaValuesBoxShadowTextShadowFilterValues = [
      "boxShadow",
      "textShadow",
      "filter",
      "backdropFilter",
      "mixBlendMode",
    ];
    StyleSchemaValuesTransformOpacityColorValues = [
      "transform",
      "opacity",
      "color",
      "backgroundColor",
      "filter",
      "boxShadow",
    ];
    StyleSchemaValuesColorBackgroundColorBackgroundGradientValues = [
      "color",
      "backgroundColor",
      "backgroundGradient",
      "borderColor",
      "textDecorationLine",
      "textDecorationStyle",
      "textDecorationColor",
      "opacity",
      "boxShadow",
      "textShadow",
      "filter",
      "cursor",
    ];
    StyleSchemaValuesSubscribers = new Set(StyleSchemaValuesItems_3);
    StyleSchemaValuesSubscribers_2 = new Set(
      StyleSchemaValuesBoxShadowTextShadowFilterValues,
    );
    StyleSchemaValuesSubscribers_3 = new Set(
      StyleSchemaValuesTransformOpacityColorValues,
    );
    StyleSchemaValuesSubscribers_4 = new Set(
      StyleSchemaValuesColorBackgroundColorBackgroundGradientValues,
    );
    StyleSchemaValuesRegistry = {
      fontSize: {
        v: StyleSchemaValuesHandler(8, 128),
        slides: StyleSchemaValuesHandler(8, 400),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      fontWeight: {
        v: StyleSchemaValuesHandler_3(100, 900, 100),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      fontStyle: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesNormalItalicValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      lineHeight: {
        v: StyleSchemaValuesHandler_2(0.75, 4),
        slides: StyleSchemaValuesHandler_2(0.5, 4),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      letterSpacing: {
        v: StyleSchemaValuesHandler(-4, 32),
        slides: StyleSchemaValuesHandler(-24, 32),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      textAlign: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesLeftCenterRightValues,
        ),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
        routed: runtime.StyleSchemaNodeTypesSlidesTextValues,
      },
      textTransform: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesNoneUppercaseLowercaseValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      textDecorationLine: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesNoneUnderlineLineThroughValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      textDecorationStyle: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesSolidDoubleDottedValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      textDecorationColor: {
        v: StyleSchemaValuesKindConfig,
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      fontFamily: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesSansSerifMonoValues,
        ),
        slides: {
          kind: "fontFamily",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      fontVariantNumeric: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesNormalTabularNumsValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_3,
      },
      color: {
        v: StyleSchemaValuesKindConfig,
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
        routed: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesIconValues,
        ),
      },
      backgroundColor: {
        v: StyleSchemaValuesKindConfig,
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      backgroundGradient: {
        v: {
          kind: "gradient",
        },
        slides: {
          kind: "gradient",
          repeat: true,
        },
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesImgValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      marginTop: {
        v: StyleSchemaValuesHandler(0, 256),
        on: runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
      },
      marginRight: {
        v: StyleSchemaValuesHandler(0, 256),
        on: runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
      },
      marginBottom: {
        v: StyleSchemaValuesHandler(0, 256),
        on: runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
      },
      marginLeft: {
        v: StyleSchemaValuesHandler(0, 256),
        on: runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
      },
      paddingTop: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      paddingRight: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      paddingBottom: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      paddingLeft: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      borderWidth: {
        v: StyleSchemaValuesHandler(0, 16),
        shape: StyleSchemaValuesHandler(0, 32),
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      borderStyle: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesNoneSolidDashedValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      borderColor: {
        v: StyleSchemaValuesKindConfig,
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      borderSides: {
        v: StyleSchemaValuesHandler_4(runtime.StyleSchemaNodeTypesItems),
        on: runtime.StyleSchemaNodeTypesFlatValue_2,
      },
      borderTopWidth: {
        v: StyleSchemaValuesHandler(0, 16),
        on: runtime.StyleSchemaNodeTypesFlatValue_2,
      },
      borderRightWidth: {
        v: StyleSchemaValuesHandler(0, 16),
        on: runtime.StyleSchemaNodeTypesFlatValue_2,
      },
      borderBottomWidth: {
        v: StyleSchemaValuesHandler(0, 16),
        on: runtime.StyleSchemaNodeTypesFlatValue_2,
      },
      borderLeftWidth: {
        v: StyleSchemaValuesHandler(0, 16),
        on: runtime.StyleSchemaNodeTypesFlatValue_2,
      },
      borderRadius: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesImgValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
          runtime.StyleSchemaNodeTypesSlidesShapeValues,
        ),
      },
      borderTopLeftRadius: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesImgValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
          runtime.StyleSchemaNodeTypesSlidesShapeValues,
        ),
      },
      borderTopRightRadius: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesImgValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
          runtime.StyleSchemaNodeTypesSlidesShapeValues,
        ),
      },
      borderBottomRightRadius: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesImgValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
          runtime.StyleSchemaNodeTypesSlidesShapeValues,
        ),
      },
      borderBottomLeftRadius: {
        v: StyleSchemaValuesHandler(0, 256),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesImgValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
          runtime.StyleSchemaNodeTypesSlidesShapeValues,
        ),
      },
      opacity: {
        v: StyleSchemaValuesHandler_2(0, 1),
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      boxShadow: {
        v: {
          kind: "shadow",
          spread: true,
        },
        slides: {
          kind: "shadow",
          spread: true,
          blur: StyleSchemaValuesHandler(0, 160),
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_4,
      },
      textShadow: {
        v: {
          kind: "shadow",
          spread: false,
        },
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesParagraphHeadingCodeBlockValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      textStrokeWidth: {
        v: StyleSchemaValuesHandler(0, 8),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesParagraphHeadingCodeBlockValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      textStrokeColor: {
        v: StyleSchemaValuesKindConfig,
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesParagraphHeadingCodeBlockValues,
          runtime.StyleSchemaNodeTypesSlidesTextValues,
          runtime.StyleSchemaNodeTypesSlidesTableValues,
        ),
      },
      filter: {
        v: {
          kind: "filter",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_4,
      },
      backdropFilter: {
        v: {
          kind: "filter",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_4,
      },
      transform: {
        v: {
          kind: "transform",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_2,
        routed: runtime.StyleSchemaNodeTypesSlidesShapeValues,
      },
      mixBlendMode: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesNormalMultiplyScreenValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_4,
      },
      position: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesStaticRelativeAbsoluteValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      top: {
        v: StyleSchemaValuesHandler(-4096, 4096),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      right: {
        v: StyleSchemaValuesHandler(-4096, 4096),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      bottom: {
        v: StyleSchemaValuesHandler(-4096, 4096),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      left: {
        v: StyleSchemaValuesHandler(-4096, 4096),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      zIndex: {
        v: StyleSchemaValuesHandler_3(-999, 999, 1),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      float: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesNoneLeftRightValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      display: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesBlockInlineBlockFlexValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      visibility: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesVisibleHiddenValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      overflow: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesVisibleHiddenClipValues,
        ),
        on: (0, runtime.StyleSchemaNodeTypesFlat)(
          runtime.StyleSchemaNodeTypesBlockquoteBulletListOrderedListValues,
          runtime.StyleSchemaNodeTypesTableTableCellTableHeaderValues,
          runtime.StyleSchemaNodeTypesSlidesStackValues,
        ),
      },
      pointerEvents: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesAutoNoneValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      cursor: {
        v: StyleSchemaValuesHandler_4(
          runtime.StyleSchemaNodeTypesDefaultPointerTextValues,
        ),
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      width: {
        v: {
          kind: "size",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      height: {
        v: {
          kind: "size",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      minWidth: {
        v: {
          kind: "size",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      minHeight: {
        v: {
          kind: "size",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      maxWidth: {
        v: {
          kind: "size",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      maxHeight: {
        v: {
          kind: "size",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue_5,
      },
      transition: {
        v: {
          kind: "transition",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
      animation: {
        v: {
          kind: "animation",
        },
        on: runtime.StyleSchemaNodeTypesFlatValue,
      },
    };
  };
}
