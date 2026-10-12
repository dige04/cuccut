/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorInspectorArtboardGuides(
  runtime: RuntimeBindings,
): () => void {
  var jsxInspectorArtboardGuides: Dynamic;
  var InspectorArtboardGuidesColumnsRowsGridConfig: Dynamic;
  var InspectorArtboardGuidesColumnsRowsConfig: Dynamic;
  var InspectorArtboardGuidesStretchStartCenterValues: Dynamic;
  var ArtboardGuidesPanel: Dynamic;
  function artboardGuideDescription(source?: Dynamic): Dynamic {
    if (source.kind === "grid") return `${source.size}px`;
    let value: Dynamic =
        InspectorArtboardGuidesColumnsRowsConfig[source.kind][source.align],
      value2: Dynamic = source.auto ? "Auto" : String(source.count);
    return source.align === "stretch"
      ? `${value2} \xB7 ${value}`
      : `${value2} \xD7 ${source.size} \xB7 ${value}`;
  }
  function defaultArtboardGuide(input?: Dynamic, options?: Dynamic): Dynamic {
    return input === "grid"
      ? {
          kind: "grid",
          size: 8,
        }
      : input === "rows"
        ? {
            kind: "rows",
            count: "auto",
            size: 8,
            gutter: 8,
          }
        : options >= 1024
          ? {
              kind: "columns",
              count: 12,
              gutter: 24,
              margin: 80,
            }
          : options >= 600
            ? {
                kind: "columns",
                count: 8,
                gutter: 16,
                margin: 32,
              }
            : {
                kind: "columns",
                count: 4,
                gutter: 12,
                margin: 16,
              };
  }
  function ArtboardGuideRow({
    index: index,
    guide: guide,
    frame: frame,
    open: open,
    onOpenChange: onOpenChange,
    onRemove: onRemove,
    ...props
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactChromeInspectorSheet.useState)(false),
      value3: Dynamic = (0, runtime.reactChromeInspectorSheet.useRef)(null),
      value4: Dynamic =
        InspectorArtboardGuidesColumnsRowsGridConfig[guide.kind],
      value5: Dynamic = guide.hidden === true,
      value6: Dynamic = (0, runtime.resolveArtboardGuide)(guide, frame);
    return (
      <runtime.PropertyRow
        label={value4}
        data-testid={"dc-guide-" + String(index)}
      >
        <span
          ref={value3}
          className={(0, runtime.joinClassNames)(
            "relative flex min-w-0 flex-1",
            value5 && "opacity-60",
          )}
        >
          <runtime.PropertyEditorPopover
            open={open}
            onOpenChange={onOpenChange}
            trigger={
              <runtime.ColorEffectButton
                label={value4 + " guide"}
                color={value6.color}
                text={artboardGuideDescription(value6)}
                onClick={(input?: Dynamic): Dynamic =>
                  value2(input.detail === 0)
                }
              />
            }
            anchor={(): Dynamic =>
              value3.current?.closest("[data-property-row]") ?? null
            }
            focusOnOpen={value}
          >
            <ArtboardGuideEditor
              guide={guide}
              r={value6}
              onClose={(): Dynamic => onOpenChange(false)}
              {...props}
            />
          </runtime.PropertyEditorPopover>
        </span>
        <runtime.Button
          variant={"ghost"}
          size={"sm"}
          iconOnly={true}
          icon={value5 ? "EyeSlash" : "Eye"}
          aria-label={"Hide " + value4.toLowerCase() + " guide"}
          aria-pressed={value5}
          tooltip={value5 ? "Show on the canvas" : "Hide on the canvas"}
          className={(0, runtime.joinClassNames)(
            "shrink-0",
            value5 && "text-muted",
          )}
          data-testid={"dc-guide-eye-" + String(index)}
          onClick={(): Dynamic => {
            let { hidden: value7, ...value8 }: Dynamic = guide;
            props.onChange(
              value5
                ? value8
                : {
                    ...value8,
                    hidden: true,
                  },
            );
          }}
        />
        <runtime.RemovePropertyButton
          label={value4 + " guide"}
          onClick={onRemove}
        />
      </runtime.PropertyRow>
    );
  }
  function ArtboardGuideEditor({
    guide: guide,
    r: r8,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    onClose: onClose,
  }: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => ({
        onValue: (input2?: Dynamic): Dynamic =>
          onChange({
            ...guide,
            [input]: options(input2),
          }),
        onScrub: (input2?: Dynamic): Dynamic =>
          onLive({
            ...guide,
            [input]: options(input2),
          }),
        onScrubEnd: onLiveEnd,
      }),
      value: Dynamic = (
        <runtime.PropertyHexRow
          label={"Color"}
          value={r8.color}
          onChange={(input?: Dynamic): Dynamic => {
            let { color: value3, ...value4 }: Dynamic = guide;
            onChange(
              input === undefined
                ? value4
                : {
                    ...value4,
                    color: input,
                  },
            );
          }}
          onLive={(input?: Dynamic): Dynamic =>
            onLive({
              ...guide,
              color: input,
            })
          }
          onLiveEnd={onLiveEnd}
        />
      );
    if (r8.kind === "grid")
      return (
        <runtime.PropertyPopupBody title={"Grid"} onClose={onClose}>
          <runtime.PropertyNumberRow
            label={"Size"}
            value={r8.size}
            {...runtime.PlatformFileContentGridSizeCountSizeConfig.gridSize}
            step={1}
            smallStep={1}
            unit={"px"}
            {...callback(
              "size",
              (input?: Dynamic): Dynamic => input ?? r8.size,
            )}
          />
          {value}
        </runtime.PropertyPopupBody>
      );
    let value2: Dynamic = r8.align === "stretch";
    return (
      <runtime.PropertyPopupBody
        title={InspectorArtboardGuidesColumnsRowsGridConfig[r8.kind]}
        onClose={onClose}
      >
        <runtime.PropertyNumberRow
          label={"Count"}
          value={r8.auto ? undefined : r8.count}
          placeholder={value2 ? undefined : "Auto"}
          emptyStepFrom={r8.count}
          clearable={!value2}
          {...runtime.PlatformFileContentGridSizeCountSizeConfig.count}
          step={1}
          smallStep={1}
          {...callback("count", (input?: Dynamic): Dynamic => input ?? "auto")}
        />
        <runtime.PropertySelectRow
          label={"Type"}
          value={r8.align}
          options={InspectorArtboardGuidesStretchStartCenterValues.map(
            (input?: Dynamic): Dynamic => ({
              value: input,
              label: InspectorArtboardGuidesColumnsRowsConfig[r8.kind][input],
            }),
          )}
          onChange={(input?: Dynamic): Dynamic =>
            onChange({
              ...guide,
              align: input,
              ...(input === "stretch" && r8.auto
                ? {
                    count: Math.min(
                      r8.count,
                      runtime.PlatformFileContentGridSizeCountSizeConfig.count
                        .max,
                    ),
                  }
                : {}),
            })
          }
        />
        {value2 ? (
          <runtime.PropertyNumberRow
            label={"Margin"}
            value={r8.margin}
            {...runtime.PlatformFileContentGridSizeCountSizeConfig.margin}
            step={1}
            smallStep={1}
            unit={"px"}
            {...callback("margin", (input?: Dynamic): Dynamic => input ?? 0)}
          />
        ) : (
          <jsxInspectorArtboardGuides.Fragment>
            <runtime.PropertyNumberRow
              label={r8.kind === "columns" ? "Width" : "Height"}
              value={r8.size}
              {...runtime.PlatformFileContentGridSizeCountSizeConfig.size}
              step={1}
              smallStep={1}
              unit={"px"}
              {...callback(
                "size",
                (input?: Dynamic): Dynamic => input ?? r8.size,
              )}
            />
            {r8.align !== "center" && (
              <runtime.PropertyNumberRow
                label={"Offset"}
                value={r8.offset}
                {...runtime.PlatformFileContentGridSizeCountSizeConfig.offset}
                step={1}
                smallStep={1}
                unit={"px"}
                {...callback(
                  "offset",
                  (input?: Dynamic): Dynamic => input ?? 0,
                )}
              />
            )}
          </jsxInspectorArtboardGuides.Fragment>
        )}
        <runtime.PropertyNumberRow
          label={"Gutter"}
          value={r8.gutter}
          {...runtime.PlatformFileContentGridSizeCountSizeConfig.gutter}
          step={1}
          smallStep={1}
          unit={"px"}
          {...callback("gutter", (input?: Dynamic): Dynamic => input ?? 0)}
        />
        {value}
      </runtime.PropertyPopupBody>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxInspectorArtboardGuides",
    () => jsxInspectorArtboardGuides,
    (value) => {
      jsxInspectorArtboardGuides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorArtboardGuidesColumnsRowsGridConfig",
    () => InspectorArtboardGuidesColumnsRowsGridConfig,
    (value) => {
      InspectorArtboardGuidesColumnsRowsGridConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorArtboardGuidesColumnsRowsConfig",
    () => InspectorArtboardGuidesColumnsRowsConfig,
    (value) => {
      InspectorArtboardGuidesColumnsRowsConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorArtboardGuidesStretchStartCenterValues",
    () => InspectorArtboardGuidesStretchStartCenterValues,
    (value) => {
      InspectorArtboardGuidesStretchStartCenterValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardGuideDescription",
    () => artboardGuideDescription,
  );
  bindRuntimeValue(runtime, "defaultArtboardGuide", () => defaultArtboardGuide);
  bindRuntimeValue(
    runtime,
    "ArtboardGuidesPanel",
    () => ArtboardGuidesPanel,
    (value) => {
      ArtboardGuidesPanel = value;
    },
  );
  bindRuntimeValue(runtime, "ArtboardGuideRow", () => ArtboardGuideRow);
  bindRuntimeValue(runtime, "ArtboardGuideEditor", () => ArtboardGuideEditor);
  return () => {
    jsxInspectorArtboardGuides = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    InspectorArtboardGuidesColumnsRowsGridConfig = {
      columns: "Columns",
      rows: "Rows",
      grid: "Grid",
    };
    InspectorArtboardGuidesColumnsRowsConfig = {
      columns: {
        stretch: "Stretch",
        start: "Left",
        center: "Center",
        end: "Right",
      },
      rows: {
        stretch: "Stretch",
        start: "Top",
        center: "Center",
        end: "Bottom",
      },
    };
    InspectorArtboardGuidesStretchStartCenterValues = [
      "stretch",
      "start",
      "center",
      "end",
    ];
    ArtboardGuidesPanel = (0, runtime.reactChromeInspectorSheet.memo)(
      function ({ settings: settings }: Dynamic): Dynamic {
        let {
            guides: value,
            onSetGuides: value2,
            onLiveGuides: value3,
            onLiveEnd: value4,
            w: value5,
            h: value6,
          }: Dynamic = settings,
          [value7, value8]: Dynamic = (0,
          runtime.reactChromeInspectorSheet.useState)(null),
          value9: Dynamic =
            value.length >= 6
              ? {
                  disabled: true,
                  description: `At most ${6} per artboard`,
                }
              : {},
          value10: Dynamic = ["columns", "rows", "grid"].map(
            (input?: Dynamic): Dynamic => ({
              label: InspectorArtboardGuidesColumnsRowsGridConfig[input],
              onSelect: (): Dynamic => {
                value8(value.length);
                value2([...value, defaultArtboardGuide(input, value5)]);
              },
              ...value9,
            }),
          ),
          callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
            value.map(
              (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                options2 === input ? options : input2,
            );
        return (
          <runtime.PropertySection
            title={"Layout guide"}
            actions={
              <runtime.PropertyActions
                aria-label={"Add layout guide"}
                items={value10}
              />
            }
          >
            {value.map(
              (input?: Dynamic, options?: Dynamic): Dynamic => (
                <ArtboardGuideRow
                  key={options}
                  index={options}
                  guide={input}
                  frame={{
                    w: value5,
                    h: value6,
                  }}
                  open={value7 === options}
                  onOpenChange={(input2?: Dynamic): Dynamic =>
                    value8(
                      (input3?: Dynamic): Dynamic =>
                        input2 ? options : input3 === options ? null : input3,
                    )
                  }
                  onChange={(input2?: Dynamic): Dynamic =>
                    value2(callback(options, input2))
                  }
                  onLive={(input2?: Dynamic): Dynamic =>
                    value3(callback(options, input2))
                  }
                  onLiveEnd={value4}
                  onRemove={(): Dynamic => {
                    value8(
                      (input2?: Dynamic): Dynamic =>
                        input2 === null || input2 === options
                          ? null
                          : input2 > options
                            ? input2 - 1
                            : input2,
                    );
                    value2(
                      value.filter(
                        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                          options2 !== options,
                      ),
                    );
                  }}
                />
              ),
            )}
          </runtime.PropertySection>
        );
      },
    );
  };
}
