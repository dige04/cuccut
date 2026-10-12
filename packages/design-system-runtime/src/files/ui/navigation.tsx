/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as JsxRuntime from "react/jsx-runtime";
import type {
  NavigationRuntime,
  NavigationProps,
  FloatingNavigationProps,
  NavigationRowsProps,
  PendingSectionRowProps,
  NavigationSearch,
  NavigationSearchState,
  SectionSearchFieldProps,
  NavigationPillActivity,
  SearchEntry,
  SectionRow,
} from "../../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiNavigation(
  runtime: RuntimeBindings & NavigationRuntime,
): () => void {
  var jsxSectionNavigation: typeof JsxRuntime;
  var SIDEBAR_MEDIA_QUERY: string;
  var SECTION_ICON_NAMES: Record<string, string>;
  var NAV_SEARCH_BROWSER_FIND_HINT: string;
  var NAV_SECTION_LIST_CLASS: string;
  var handleNavigationRowKey: React.KeyboardEventHandler<HTMLElement>;
  var NAV_ESCAPE_COMPOSITION_GRACE_MS: number;
  var NAV_PILL_ACTIVITY_MS: number;
  var NAV_PILL_INITIAL_ACTIVITY_MS: number;
  var navigationPillInitialHintShown: boolean;
  function sectionIconName(id: string): string {
    return SECTION_ICON_NAMES[id] ?? "Token";
  }
  function initialSectionFromHash(
    sections: string[] | ((section: string) => boolean),
    fallback: string,
  ) {
    let hash =
      typeof window === "undefined" ? "" : window.location.hash.slice(1);
    if (
      typeof sections === "function" ? sections(hash) : sections.includes(hash)
    ) {
      return hash;
    } else {
      return fallback;
    }
  }
  function replaceSectionHash(section: string): void {
    try {
      let { location: value, history: value2 } = window;
      if (value.protocol !== "about:" && value.hash !== "#" + section) {
        value2.replaceState(null, "", "#" + section);
      }
    } catch {}
  }
  function NavigationConflictMark() {
    return (
      <span
        className={
          "ds-navmark ml-auto inline-flex items-center gap-1 text-caption text-warning"
        }
        data-testid={"ds-navmark"}
        title={
          "A file here was changed by someone else while you were editing it. Choose theirs or yours at the top of the page."
        }
      >
        {[
          <span
            aria-hidden={"true"}
            className={"inline-block size-2 rounded-full bg-warning"}
          />,
          <span className={"sr-only"}>{"needs your choice"}</span>,
        ]}
      </span>
    );
  }
  function PendingSectionRow({
    row: row,
    tip: tip,
    tipId: tipId,
    panel: panel,
  }: PendingSectionRowProps) {
    let [value, value2] = runtime.reactSectionNavigation.useState(false),
      ref = runtime.reactSectionNavigation.useRef(false);
    return (
      <div className={"relative flex w-full shrink-0"}>
        <runtime.PropertyPopup
          open={value}
          onOpen={() => value2(true)}
          onClose={() => value2(false)}
          align={"left"}
          popupAttrs={runtime.UNCOMMENTABLE_PROPS}
          focusOnOpen={ref.current}
          aria-label={row.label}
          trigger={(input: React.HTMLAttributes<HTMLElement>) => (
            <runtime.TooltipWrapper
              tip={tip}
              side={"bottom"}
              align={"left"}
              className={"w-full"}
            >
              <runtime.Button
                {...input}
                variant={"ghost"}
                size={"sm"}
                icon={sectionIconName(row.id)}
                aria-describedby={tipId}
                className={"ds-navrow ds-navrow-pending w-full justify-start"}
                data-testid={"ds-pending-" + row.id}
                onClick={(input2: React.MouseEvent<HTMLElement>) => {
                  ref.current = input2.detail === 0;
                  input.onClick?.(input2);
                }}
              >
                {row.label}
              </runtime.Button>
            </runtime.TooltipWrapper>
          )}
        >
          {value ? panel(row, () => value2(false)) : null}
        </runtime.PropertyPopup>
      </div>
    );
  }
  function SectionNavigationRows({
    sections: sections,
    tail = [],
    current: current,
    onJump: onJump,
    marks: marks,
    hits: hits,
    pending: pending,
  }: NavigationRowsProps) {
    let items = [...sections, ...tail],
      value =
        hits === undefined
          ? items.map((input) => ({
              section: input.id,
              hits: [],
            }))
          : hits.result.groups,
      value2 = runtime.reactSectionNavigation.useId();
    return (
      <jsxSectionNavigation.Fragment>
        {value.map((input) => {
          let value3 = items.find((input2) => input2.id === input.section);
          if (value3 === undefined) {
            return null;
          } else {
            return (() => {
              const _Element3 = jsxSectionNavigation.Fragment;
              const _elementProps3 = {
                children: [
                  value3 === tail[0] && input !== value[0] ? (
                    <div
                      aria-hidden={"true"}
                      className={"my-1 shrink-0 border-t border-border-line"}
                      data-testid={"ds-nav-rule"}
                    />
                  ) : null,
                  <runtime.Button
                    variant={"ghost"}
                    size={"sm"}
                    icon={sectionIconName(value3.id)}
                    aria-current={
                      value3.id === current ? "location" : undefined
                    }
                    aria-label={
                      value3.count !== undefined && value3.count > 0
                        ? value3.label +
                          ", " +
                          value3.count.toLocaleString("en-US")
                        : undefined
                    }
                    className={"ds-navrow w-full justify-start"}
                    data-testid={"ds-jump-" + value3.id}
                    onClick={() => onJump(value3.id)}
                  >
                    {[
                      value3.label,
                      marks?.has(value3.id) === true ? (
                        <NavigationConflictMark />
                      ) : null,
                      value3.count !== undefined && value3.count > 0 ? (
                        <span
                          className={
                            "pl-xs text-caption tabular-nums text-muted"
                          }
                          title={value3.countLabel}
                          data-testid={"ds-nav-count"}
                        >
                          {value3.count.toLocaleString("en-US")}
                        </span>
                      ) : null,
                    ]}
                  </runtime.Button>,
                  input.hits.map((input2, options) =>
                    (() => {
                      const _Element = runtime.Button;
                      const _elementProps = {
                        variant: "ghost" as const,
                        size: "sm" as const,
                        "aria-label":
                          input2.detail !== undefined
                            ? input2.entry.label + ", " + input2.detail
                            : undefined,
                        className: "ds-navrow ds-navhit w-full justify-start",
                        "data-testid": "ds-search-hit",
                        onClick: () => hits?.onPick(input2.entry),
                        children: [
                          <span className={"max-w-full shrink-0 truncate"}>
                            {input2.entry.label}
                          </span>,
                          input2.detail !== undefined ? (
                            <span
                              className={
                                "min-w-0 truncate pl-xs text-caption text-muted"
                              }
                            >
                              {input2.detail}
                            </span>
                          ) : null,
                        ],
                      };
                      const _elementKey = options;
                      return <_Element key={_elementKey} {..._elementProps} />;
                    })(),
                  ),
                  hits === undefined &&
                  value3 === sections[sections.length - 1] &&
                  pending !== undefined ? (
                    <runtime.TooltipProvider>
                      {[
                        <span id={value2} hidden={true}>
                          {pending.tip}
                        </span>,
                        pending.rows.map((input2) =>
                          (() => {
                            const _Element2 = PendingSectionRow;
                            const _elementProps2 = {
                              row: input2,
                              tip: pending.tip,
                              tipId: value2,
                              panel: pending.panel,
                            };
                            const _elementKey2 = input2.id;
                            return (
                              <_Element2
                                key={_elementKey2}
                                {..._elementProps2}
                              />
                            );
                          })(),
                        ),
                      ]}
                    </runtime.TooltipProvider>
                  ) : null,
                ],
              };
              const _elementKey3 = value3.id;
              return <_Element3 key={_elementKey3} {..._elementProps3} />;
            })();
          }
        })}
      </jsxSectionNavigation.Fragment>
    );
  }
  function focusAndSelectSearchInput(input: HTMLInputElement | null): boolean {
    if (input === null || input.ownerDocument.activeElement === input) {
      return false;
    }
    input.focus();
    input.select();
    return input.ownerDocument.activeElement === input;
  }
  function hasOtherOpenOverlay(searchInput: HTMLInputElement | null): boolean {
    return Array.from(
      document.querySelectorAll(runtime.OPEN_OVERLAY_SELECTOR),
    ).some(
      (input) =>
        !input.contains(searchInput) &&
        !input.hasAttribute("data-mc-scrim") &&
        !(0, runtime.isOverlayClosed)(input),
    );
  }
  function useSectionNavigationSearch(
    search: NavigationSearch | undefined,
    focusSearch: (input: HTMLInputElement | null) => boolean,
  ): NavigationSearchState {
    let [query, setQuery] = runtime.reactSectionNavigation.useState(""),
      index = search?.index,
      fileEntries = search?.tail,
      result = runtime.reactSectionNavigation.useMemo(
        () =>
          index === undefined || query.trim() === ""
            ? null
            : (0, runtime.searchSectionsAndFiles)(index, fileEntries, query),
        [index, fileEntries, query],
      ),
      box = runtime.reactSectionNavigation.useRef<HTMLSpanElement | null>(null),
      focusRef = runtime.reactSectionNavigation.useRef(focusSearch);
    focusRef.current = focusSearch;
    let enabled = search !== undefined;
    runtime.reactSectionNavigation.useEffect(() => {
      if (!enabled) {
        return;
      }
      let flag = false,
        callback = (event: KeyboardEvent) => {
          if (
            !(0, runtime.isFindShortcut)(event) ||
            event.defaultPrevented ||
            (0, runtime.isComposingEvent)(event)
          ) {
            return;
          }
          if (!event.repeat) {
            flag = focusRef.current(
              box.current?.querySelector("input") ?? null,
            );
          }
          if (flag) {
            event.preventDefault();
          }
        };
      window.addEventListener("keydown", callback, true);
      return () => window.removeEventListener("keydown", callback, true);
    }, [enabled]);
    return {
      query: query,
      setQuery: setQuery,
      result: result,
      box: box,
    };
  }
  function useSearchEscapeToRow() {
    let ref = runtime.reactSectionNavigation.useRef(-1 / 0);
    return {
      onCompositionEnd: (input: React.CompositionEvent) => {
        ref.current = input.timeStamp;
      },
      onKeyDown: (event: React.KeyboardEvent) => {
        let target = event.target;
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.repeat ||
          event.shiftKey ||
          event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          (0, runtime.isComposingEvent)(event) ||
          event.timeStamp - ref.current < NAV_ESCAPE_COMPOSITION_GRACE_MS
        ) {
          return;
        }
        if (!(target instanceof HTMLInputElement) || target.value !== "") {
          return;
        }
        event.preventDefault();
        let ancestor = target.closest("nav");
        (
          ancestor?.querySelector<HTMLElement>(".ds-navrow[aria-current]") ??
          ancestor?.querySelector<HTMLElement>(".ds-navrow")
        )?.focus();
        if (target.ownerDocument.activeElement === target) {
          target.blur();
        }
      },
    };
  }
  function SectionSearchField({
    query: query,
    setQuery: setQuery,
    result: result,
    box: box,
    escapeToRow = false,
  }: SectionSearchFieldProps) {
    let value = useSearchEscapeToRow(),
      value2 = runtime.reactSectionNavigation.useId();
    runtime.reactSectionNavigation.useEffect(() => {
      let value3 = box.current?.querySelector("input");
      value3?.setAttribute("aria-describedby", value2);
      return () => value3?.removeAttribute("aria-describedby");
    }, [box, value2]);
    return (
      <runtime.CdsRoot
        density={"compact"}
        className={"contents"}
        render={escapeToRow ? <div {...value} /> : undefined}
      >
        <span ref={box} className={"contents"}>
          {[
            <runtime.OptionList
              value={query}
              onChange={setQuery}
              label={"Search"}
              rowSelector={".ds-navrow"}
              onEnterIndex={() => result?.bestRow ?? 0}
              className={"mb-sm w-0 min-w-full"}
              data-testid={"ds-search"}
            />,
            <span id={value2} hidden={true}>
              {NAV_SEARCH_BROWSER_FIND_HINT}
            </span>,
          ]}
        </span>
      </runtime.CdsRoot>
    );
  }
  function SectionSearchStatus({
    query: query,
    result: result,
  }: Pick<NavigationSearchState, "query" | "result">) {
    let value =
        result === null
          ? null
          : result.total === 0
            ? "No matches for “" + query.trim() + "”"
            : result.hidden > 0
              ? "Showing " +
                String(result.total - result.hidden) +
                " of " +
                String(result.total) +
                " matches. Keep typing to narrow it down."
              : null,
      value2 =
        result === null
          ? ""
          : String(result.total) + (result.total === 1 ? " match" : " matches");
    return (
      <p
        className={
          value !== null
            ? "break-words px-1.5 py-xs text-footnote text-muted"
            : "sr-only"
        }
        role={"status"}
        data-testid={"ds-search-note"}
      >
        {value ?? value2}
      </p>
    );
  }
  function SidebarSectionNavigation({
    sections: sections,
    tail: tail,
    current: current,
    onJump: onJump,
    dropProps: dropProps,
    footer: footer,
    navRef: navRef,
    marks: marks,
    search: search,
    pending: pending,
  }: NavigationProps) {
    let value = useSectionNavigationSearch(
      search,
      (input) =>
        !(0, runtime.hasOpenOverlay)() && focusAndSelectSearchInput(input),
    );
    return (
      <nav
        className={
          "ds-section-nav flex h-full w-60 shrink-0 flex-col border-r border-border-line bg-surface-1 p-2"
        }
        aria-label={"Sections"}
        data-testid={"ds-section-nav"}
        data-search-scope={search !== undefined ? "" : undefined}
        onKeyDown={search !== undefined ? handleNavigationRowKey : undefined}
        ref={navRef}
        {...runtime.UNCOMMENTABLE_PROPS}
        {...dropProps}
      >
        {[
          search !== undefined ? (
            <SectionSearchField {...value} escapeToRow={true} />
          ) : null,
          <div className={NAV_SECTION_LIST_CLASS}>
            {[
              <SectionNavigationRows
                sections={sections}
                tail={tail}
                current={current}
                onJump={onJump}
                marks={marks}
                pending={pending}
                hits={
                  value.result !== null && search !== undefined
                    ? {
                        result: value.result,
                        onPick: search.onPick,
                      }
                    : undefined
                }
              />,
              search !== undefined ? (
                <SectionSearchStatus
                  query={value.query}
                  result={value.result}
                />
              ) : null,
            ]}
          </div>,
          footer !== undefined ? (
            <div
              className={"ds-nav-foot flex items-center gap-xs pt-sm"}
              data-testid={"ds-nav-foot"}
            >
              {footer}
            </div>
          ) : null,
        ]}
      </nav>
    );
  }
  function useNavigationPillActivity(
    port: HTMLElement | null | undefined,
    held: boolean,
  ): boolean {
    let [active, setActive] = runtime.reactSectionNavigation.useState(false),
      activity =
        runtime.reactSectionNavigation.useRef<NavigationPillActivity | null>(
          null,
        );
    if (activity.current === null) {
      activity.current = (0, runtime.createNavigationPillActivity)(
        NAV_PILL_ACTIVITY_MS,
        setActive,
      );
    }
    runtime.reactSectionNavigation.useEffect(
      () => () => activity.current?.dispose(),
      [],
    );
    runtime.reactSectionNavigation.useEffect(() => {
      if (!navigationPillInitialHintShown) {
        navigationPillInitialHintShown = true;
        activity.current?.bump(NAV_PILL_INITIAL_ACTIVITY_MS);
      }
    }, []);
    runtime.reactSectionNavigation.useEffect(
      () => activity.current?.hold(held),
      [held],
    );
    runtime.reactSectionNavigation.useEffect(() => {
      if (port === null || port === undefined) {
        return;
      }
      let callback = () => activity.current?.bump();
      port.addEventListener("scroll", callback, {
        passive: true,
      });
      return () => port.removeEventListener("scroll", callback);
    }, [port]);
    return active;
  }
  function assignReactRef<T>(
    ref: React.Ref<T> | undefined,
    element: T | null,
  ): void {
    if (typeof ref === "function") {
      ref(element);
    } else if (ref !== undefined && ref !== null) {
      ref.current = element;
    }
  }
  function isFocusVisible(element: Element | null): boolean {
    try {
      return element instanceof Element && element.matches(":focus-visible");
    } catch {
      return false;
    }
  }
  function FloatingSectionNavigation({
    sections: sections,
    tail: tail,
    current: current,
    onJump: onJump,
    footer: footer,
    status: status,
    navRef: navRef,
    edgeRef: edgeRef,
    port: port,
    marks: marks,
    search: search,
    pending: pending,
  }: FloatingNavigationProps) {
    let [value, value2] = runtime.reactSectionNavigation.useState(false),
      [value3, value4] = runtime.reactSectionNavigation.useState(false),
      [value5, value6] = runtime.reactSectionNavigation.useState(false),
      ref = runtime.reactSectionNavigation.useRef(false),
      ref2 = runtime.reactSectionNavigation.useRef<HTMLDivElement | null>(null),
      value7 = useSectionNavigationSearch(search, (input) => {
        if (value) {
          return (
            !hasOtherOpenOverlay(input) && focusAndSelectSearchInput(input)
          );
        }
        if (
          (0, runtime.hasOpenOverlay)() ||
          ref2.current === null ||
          ref2.current.closest("[inert]") !== null
        ) {
          return false;
        }
        ref2.current.querySelector<HTMLElement>(".ds-nav-fab-btn")?.focus();
        ref.current = true;
        value2(true);
        return true;
      }),
      callback = () => {
        value2(false);
        value7.setQuery("");
      },
      value8 = pending && {
        ...pending,
        panel: (input: SectionRow, options: () => void) =>
          pending.panel(input, () => {
            options();
            callback();
          }),
      },
      callback2 = (input: SearchEntry) => {
        callback();
        window.setTimeout(() => {
          let activeElement = document.activeElement;
          if (
            activeElement instanceof HTMLElement &&
            activeElement.closest(".ds-nav-fab") !== null
          ) {
            activeElement.blur();
          }
          search?.onPick(input);
        }, 0);
      },
      value9 = runtime.reactSectionNavigation.useId(),
      value10 = sections.findIndex((input) => input.id === current),
      value11 = value10 >= 0 ? sections[value10] : undefined,
      value12 =
        useNavigationPillActivity(port, value || value3 || value5) &&
        value11 !== undefined;
    return (
      <div
        ref={(input: HTMLDivElement | null) => {
          ref2.current = input;
          assignReactRef(edgeRef, input);
          assignReactRef(navRef, input);
        }}
        className={"ds-nav-fab"}
        data-testid={"ds-nav-fab"}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        <span
          className={
            "ds-nav-fab-live relative inline-flex max-w-full items-center gap-xs"
          }
        >
          {[
            <runtime.PropertyPopup
              open={value}
              onOpen={() => value2(true)}
              onClose={callback}
              trigger={
                <runtime.Button
                  variant={"secondary"}
                  icon={value12 ? sectionIconName(current) : "Menu"}
                  aria-label={"Sections"}
                  aria-describedby={
                    value11 === undefined
                      ? undefined
                      : value9 + "-n " + value9 + "-c"
                  }
                  className={"ds-nav-fab-btn"}
                  data-wide={value12 ? "" : undefined}
                  data-testid={"ds-section-menu"}
                  onPointerMove={(input: React.PointerEvent) => {
                    if (input.pointerType === "mouse") {
                      value4(true);
                    }
                  }}
                  onPointerLeave={() => value4(false)}
                  onFocus={(input: React.FocusEvent<HTMLElement>) =>
                    value6(isFocusVisible(input.currentTarget))
                  }
                  onBlur={() => value6(false)}
                  onClick={(input: React.MouseEvent) => {
                    ref.current = input.detail === 0;
                  }}
                >
                  <span className={"ds-nav-fab-label"} aria-hidden={"true"}>
                    <span className={"ds-nav-fab-text"}>
                      {[
                        <span
                          className={"truncate"}
                          id={value9 + "-n"}
                          data-testid={"ds-section-pill-name"}
                        >
                          {value11?.label ?? ""}
                        </span>,
                        <span
                          className={"text-caption tabular-nums text-muted"}
                          id={value9 + "-c"}
                          data-testid={"ds-section-pill-at"}
                        >
                          {value11 === undefined
                            ? ""
                            : String(value10 + 1) +
                              " of " +
                              String(sections.length)}
                        </span>,
                      ]}
                    </span>
                  </span>
                </runtime.Button>
              }
              align={"left"}
              aria-label={"Sections"}
              popupAttrs={runtime.UNCOMMENTABLE_PROPS}
              focusOnOpen={ref.current}
            >
              {value ? (
                <nav
                  className={
                    "ds-section-nav ds-section-pop flex max-h-[min(70vh,32rem)] w-60 flex-col p-2"
                  }
                  aria-label={"Sections"}
                  data-testid={"ds-section-nav"}
                  data-search-scope={search !== undefined ? "" : undefined}
                  onKeyDown={
                    search !== undefined ? handleNavigationRowKey : undefined
                  }
                  {...runtime.UNCOMMENTABLE_PROPS}
                >
                  {[
                    search !== undefined ? (
                      <SectionSearchField {...value7} />
                    ) : null,
                    <div className={NAV_SECTION_LIST_CLASS}>
                      {[
                        <SectionNavigationRows
                          sections={sections}
                          tail={tail}
                          current={current}
                          onJump={(input: string) => {
                            callback();
                            window.setTimeout(() => onJump(input), 0);
                          }}
                          marks={marks}
                          pending={value8}
                          hits={
                            value7.result !== null && search !== undefined
                              ? {
                                  result: value7.result,
                                  onPick: callback2,
                                }
                              : undefined
                          }
                        />,
                        search !== undefined ? (
                          <SectionSearchStatus
                            query={value7.query}
                            result={value7.result}
                          />
                        ) : null,
                      ]}
                    </div>,
                    footer !== undefined ? (
                      <div
                        className={
                          "ds-nav-foot mt-sm flex items-center gap-xs border-t border-alpha-2 pt-sm"
                        }
                        data-testid={"ds-nav-foot"}
                      >
                        {footer}
                      </div>
                    ) : null,
                  ]}
                </nav>
              ) : null}
            </runtime.PropertyPopup>,
            status,
          ]}
        </span>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxSectionNavigation",
    () => jsxSectionNavigation,
    (value) => {
      jsxSectionNavigation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SIDEBAR_MEDIA_QUERY",
    () => SIDEBAR_MEDIA_QUERY,
    (value) => {
      SIDEBAR_MEDIA_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_ICON_NAMES",
    () => SECTION_ICON_NAMES,
    (value) => {
      SECTION_ICON_NAMES = value;
    },
  );
  bindRuntimeValue(runtime, "sectionIconName", () => sectionIconName);
  bindRuntimeValue(
    runtime,
    "initialSectionFromHash",
    () => initialSectionFromHash,
  );
  bindRuntimeValue(runtime, "replaceSectionHash", () => replaceSectionHash);
  bindRuntimeValue(
    runtime,
    "NavigationConflictMark",
    () => NavigationConflictMark,
  );
  bindRuntimeValue(runtime, "PendingSectionRow", () => PendingSectionRow);
  bindRuntimeValue(
    runtime,
    "SectionNavigationRows",
    () => SectionNavigationRows,
  );
  bindRuntimeValue(
    runtime,
    "focusAndSelectSearchInput",
    () => focusAndSelectSearchInput,
  );
  bindRuntimeValue(runtime, "hasOtherOpenOverlay", () => hasOtherOpenOverlay);
  bindRuntimeValue(
    runtime,
    "useSectionNavigationSearch",
    () => useSectionNavigationSearch,
  );
  bindRuntimeValue(
    runtime,
    "NAV_SEARCH_BROWSER_FIND_HINT",
    () => NAV_SEARCH_BROWSER_FIND_HINT,
    (value) => {
      NAV_SEARCH_BROWSER_FIND_HINT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NAV_SECTION_LIST_CLASS",
    () => NAV_SECTION_LIST_CLASS,
    (value) => {
      NAV_SECTION_LIST_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "handleNavigationRowKey",
    () => handleNavigationRowKey,
    (value) => {
      handleNavigationRowKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NAV_ESCAPE_COMPOSITION_GRACE_MS",
    () => NAV_ESCAPE_COMPOSITION_GRACE_MS,
    (value) => {
      NAV_ESCAPE_COMPOSITION_GRACE_MS = value;
    },
  );
  bindRuntimeValue(runtime, "useSearchEscapeToRow", () => useSearchEscapeToRow);
  bindRuntimeValue(runtime, "SectionSearchField", () => SectionSearchField);
  bindRuntimeValue(runtime, "SectionSearchStatus", () => SectionSearchStatus);
  bindRuntimeValue(
    runtime,
    "SidebarSectionNavigation",
    () => SidebarSectionNavigation,
  );
  bindRuntimeValue(
    runtime,
    "NAV_PILL_ACTIVITY_MS",
    () => NAV_PILL_ACTIVITY_MS,
    (value) => {
      NAV_PILL_ACTIVITY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NAV_PILL_INITIAL_ACTIVITY_MS",
    () => NAV_PILL_INITIAL_ACTIVITY_MS,
    (value) => {
      NAV_PILL_INITIAL_ACTIVITY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "navigationPillInitialHintShown",
    () => navigationPillInitialHintShown,
    (value) => {
      navigationPillInitialHintShown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useNavigationPillActivity",
    () => useNavigationPillActivity,
  );
  bindRuntimeValue(runtime, "assignReactRef", () => assignReactRef);
  bindRuntimeValue(runtime, "isFocusVisible", () => isFocusVisible);
  bindRuntimeValue(
    runtime,
    "FloatingSectionNavigation",
    () => FloatingSectionNavigation,
  );
  return () => {
    jsxSectionNavigation = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    SIDEBAR_MEDIA_QUERY =
      "(min-width: " + String(runtime.TOOLBAR_WIDE_BREAKPOINT) + "px)";
    SECTION_ICON_NAMES = {
      readme: "BookText",
      colors: "Palette",
      type: "TextAa",
      spacing: "ArrowsOut",
      corners: "Frame",
      shadows: "Copy",
      components: "Box",
      assets: "Image",
      files: "Folder",
    };
    NAV_SEARCH_BROWSER_FIND_HINT =
      "Press " +
      ((0, runtime.isApplePlatform)() ? "Command+F" : "Ctrl+F") +
      " in this field to find text on the page instead.";
    NAV_SECTION_LIST_CLASS =
      "-mx-2 -my-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-0.5";
    handleNavigationRowKey = (0, runtime.createOptionListKeyHandler)(
      ".ds-navrow",
    );
    NAV_ESCAPE_COMPOSITION_GRACE_MS = 500;
    NAV_PILL_ACTIVITY_MS = 1000;
    NAV_PILL_INITIAL_ACTIVITY_MS = 2500;
    navigationPillInitialHintShown = false;
  };
}
