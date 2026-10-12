/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorInspectorArtboard(
  runtime: RuntimeBindings,
): () => void {
  function ArtboardInspector({
    settings: settings,
    readOnly = false,
    pngFollowsPrint = true,
  }: Dynamic): Dynamic {
    let value: Dynamic = readOnly
        ? {
            ...settings,
            onSetPrint: (): Dynamic => {},
            onSetPaper: (): Dynamic => {},
            onSetSize: (): Dynamic => {},
            onSetFill: (): Dynamic => {},
            onSetRadius: (): Dynamic => {},
            onFitHeight: undefined,
          }
        : settings,
      value2: Dynamic = value.print === "flow",
      value3: Dynamic = value2 || value.fillPaginates === true,
      fill: Dynamic = value.fill,
      value4: Dynamic = readOnly
        ? runtime.ViewOnlyYouCanInspectThisMessage
        : undefined,
      value5: Dynamic = (0, runtime.useInspectorContext)(),
      value6: Dynamic = (0, runtime.reactCanvasShape_2.useMemo)(
        (): Dynamic => ({
          ...value5,
          iframeDefinedVars: runtime.InspectorEditorSubscribers,
          artboardColors: runtime.InspectorEditorItems_2,
          editsAreUndoSteps: false,
        }),
        [value5],
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        (input && fill?.vars[input]) || input || null;
    return value.frameless ? (
      <div
        data-testid={"dc-artboard-settings"}
        className={"[--pp-label-w:84px]"}
      >
        <runtime.PropertySection title={value.label ?? "Artboard"}>
          {["w", "h"].map(
            (input?: Dynamic): Dynamic => (
              <runtime.PropertyRow
                key={input}
                label={input === "w" ? "Width" : "Height"}
                data-testid={"dc-artboard-" + input}
                title={runtime.InspectorEditorLabel_4}
                disabled={true}
              >
                <runtime.NumericInput
                  aria-label={input === "w" ? "Width" : "Height"}
                  value={Math.round(value[input])}
                  unit={"px"}
                  refuseLetters={true}
                  disabled={true}
                  smallStep={1}
                  onValue={(): Dynamic => {}}
                />
              </runtime.PropertyRow>
            ),
          )}
        </runtime.PropertySection>
      </div>
    ) : (
      <div
        data-testid={"dc-artboard-settings"}
        className={"[--pp-label-w:84px]"}
      >
        <runtime.PropertySection title={"Artboard"}>
          {["w", "h"].map(
            (input?: Dynamic): Dynamic => (
              <runtime.PropertyRow
                key={input}
                label={input === "w" ? "Width" : "Height"}
                data-testid={"dc-artboard-" + input}
                title={value4}
                {...(input === "h" && value.onFitHeight
                  ? {
                      actions: [
                        {
                          label: "Fit to content",
                          onSelect: value.onFitHeight,
                        },
                      ],
                      actionsLabel: "Height actions",
                    }
                  : {})}
              >
                <runtime.NumericInput
                  aria-label={
                    input === "w" ? "Artboard width" : "Artboard height"
                  }
                  value={Math.round(value[input])}
                  unit={"px"}
                  refuseLetters={true}
                  disabled={readOnly}
                  min={120}
                  max={8e3}
                  smallStep={1}
                  onValue={(input2?: Dynamic): Dynamic =>
                    input2 !== undefined &&
                    value.onSetSize(
                      {
                        [input]: input2,
                      },
                      true,
                    )
                  }
                  onScrub={(input2?: Dynamic): Dynamic =>
                    value.onSetSize(
                      {
                        [input]: input2,
                      },
                      false,
                    )
                  }
                  onScrubEnd={(): Dynamic => value.onSetSize({}, true)}
                />
              </runtime.PropertyRow>
            ),
          )}
          <runtime.PropertyRow
            label={"Print mode"}
            data-testid={"dc-artboard-print"}
            title={value4}
          >
            <runtime.SegmentedControl
              aria-label={"Print mode"}
              fullWidth={true}
              value={value.print}
              segments={[
                {
                  value: "flow",
                  label: "Flow",
                  tooltip:
                    "Content flows onto Letter/A4 pages (up to 100)" +
                    (pngFollowsPrint
                      ? ", and a PNG keeps its full length"
                      : "") +
                    "\u2014for document-like artboards (memos, reports)",
                  disabled: readOnly,
                  disabledReason: value4,
                },
                {
                  value: "fixed",
                  label: "Fixed",
                  tooltip: value.fillPaginates
                    ? runtime.inspectorSingleSelectionMessage
                    : "Exactly one page at the frame\u2019s size" +
                      (pngFollowsPrint
                        ? ", and a PNG stops at the frame"
                        : "") +
                      "\u2014for single-page layouts (posters, brochure pages)",
                  disabled: readOnly,
                  disabledReason: value4,
                },
              ]}
              onChange={(input?: Dynamic): Dynamic => {
                value.print !== input && value.onSetPrint(input);
              }}
            />
          </runtime.PropertyRow>
          <runtime.PropertyRow
            label={"Paper"}
            data-testid={"dc-artboard-paper"}
            title={
              value4 ??
              (value3
                ? value.paperSet === undefined
                  ? "Not set \u2014 currently " +
                    runtime.paperSizes[value.paper].label +
                    " (from the frame\u2019s shape or your locale)"
                  : undefined
                : "Applies to Flow\u2014Fixed exports one page at the frame\u2019s size")
            }
          >
            <runtime.SegmentedControl
              aria-label={"Paper"}
              fullWidth={true}
              value={value3 ? (value.paperSet ?? "") : ""}
              segments={["letter", "a4"].map(
                (input?: Dynamic): Dynamic => ({
                  value: input,
                  label: runtime.paperSizes[input].label,
                  tooltip: value3
                    ? (value2
                        ? "Export PDF paginates onto "
                        : "When Export PDF paginates, it uses ") +
                      runtime.paperSizes[input].label +
                      " pages" +
                      (value.paperSet === undefined && value.paper === input
                        ? " (the current default)"
                        : "")
                    : undefined,
                  disabled: !value3 || readOnly,
                  disabledReason: value4,
                }),
              )}
              onChange={(input?: Dynamic): Dynamic => {
                input && value.onSetPaper(input);
              }}
            />
          </runtime.PropertyRow>
        </runtime.PropertySection>
        <runtime.PropertySection title={"Appearance"} iconColumn={true}>
          <runtime.InspectorContext.Provider value={value6}>
            <runtime.PropertyInspectorField
              state={{
                ...runtime.InspectorEditorPropLabelSpecConfig,
                value: callback(fill?.background),
                companionValue: callback(fill?.backgroundColor),
                varSource: fill?.vars[fill.background]
                  ? fill.background
                  : undefined,
                companionVarSource: fill?.vars[fill.backgroundColor]
                  ? fill.backgroundColor
                  : undefined,
                fallback: "#ffffff",
                disabled: fill == null || readOnly,
                whyDisabled: value4,
              }}
              onCommit={(input?: Dynamic, options?: Dynamic): Dynamic =>
                value.onSetFill([
                  {
                    prop: input,
                    value: options,
                  },
                ])
              }
              onCommitMany={value.onSetFill}
            />
          </runtime.InspectorContext.Provider>
          {(() => {
            const _Component = runtime.ArtboardRadiusRow;
            const _props = {
              radius: value.radius,
              readOnly: readOnly,
              onSetRadius: value.onSetRadius,
            } as const;
            const _key = value.file;
            return <_Component key={_key} {..._props} />;
          })()}
        </runtime.PropertySection>
      </div>
    );
  }
  bindRuntimeValue(runtime, "ArtboardInspector", () => ArtboardInspector);
  return () => {};
}
