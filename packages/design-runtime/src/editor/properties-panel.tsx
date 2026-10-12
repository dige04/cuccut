/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installEditorPropertiesPanel(
  runtime: RuntimeBindings,
): () => void {
  function DesignPropertiesSidebar({ children: children }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.usePanelWidth)(312);
    return (
      <div
        data-testid={"dc-edit-side-panel"}
        data-posture={"sidebar"}
        className={
          "relative flex h-full shrink-0 flex-col border-l bg-surface-panel [--pp-label-w:72px]"
        }
        style={{
          width: value.width,
        }}
      >
        {children}
        <runtime.PanelWidthGrip {...value} label={"Resize properties panel"} />
      </div>
    );
  }
  function AnchoredDesignProperties({
    settings: settings,
    readOnly = false,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useInspectorPosture)(),
      value2: Dynamic = (0, runtime.useElementById)(runtime.inspectorPanelId),
      [value3]: Dynamic = (0, runtime.useInspectorOpen)(),
      value4: Dynamic = (0, runtime.useDesignColorTokens)("appifact"),
      value5: Dynamic = (0, runtime.reactCanvasShape_2.useMemo)(
        (): Dynamic => ({
          dsColorTokens: (0, runtime.activeDesignColorTokens)(
            value4.tokens,
            value4.themes,
            undefined,
          ),
          artboardColors: runtime.InspectorEditorItems_2,
          designColorTokens: runtime.InspectorEditorItems,
          setOverlayHidden: (): Dynamic => {},
          setScrubbing: (): Dynamic => {},
          editsAreUndoSteps: true,
        }),
        [value4],
      );
    if (value2 == null || !value3) return null;
    let value6: Dynamic = (
      <runtime.InspectorContext.Provider value={value5}>
        <div
          data-testid={"dc-anchored-content"}
          className={(0, runtime.cn)(
            "flex min-h-0 flex-1 flex-col overflow-y-auto pb-3 select-none [&_input]:select-text",
            runtime.ChromeScrollbarLabel,
          )}
        >
          <runtime.AnnotationInspector
            settings={settings}
            readOnly={readOnly}
          />
        </div>
      </runtime.InspectorContext.Provider>
    );
    return (0, runtime.reactDomCanvasShape_2.createPortal)(
      <runtime.CdsIsland density={"compact"} className={"contents"}>
        {value === "wide" ? (
          <DesignPropertiesSidebar>{value6}</DesignPropertiesSidebar>
        ) : (
          <runtime.InspectorPanelShell
            posture={"sheet"}
            filled={true}
            headerAt={"top"}
            data-testid={"dc-edit-side-panel"}
          >
            {value6}
          </runtime.InspectorPanelShell>
        )}
      </runtime.CdsIsland>,
      value2,
    );
  }
  bindRuntimeValue(
    runtime,
    "DesignPropertiesSidebar",
    () => DesignPropertiesSidebar,
  );
  bindRuntimeValue(
    runtime,
    "AnchoredDesignProperties",
    () => AnchoredDesignProperties,
  );
  return () => {};
}
