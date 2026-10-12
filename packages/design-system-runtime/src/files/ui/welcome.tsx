import type * as React from "react";
import type * as Preview from "../../contracts/preview";
import type * as Model from "../../contracts";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiWelcome(runtime: RuntimeBindings): () => void {
  var reactBrandUpload: typeof import("react");
  var reactWelcome: typeof import("react");
  var jsxWelcomeIcons: typeof import("react/jsx-runtime");
  var WELCOME_ICON_PATHS: Record<"github", React.ReactElement>;
  var jsxWelcome: typeof import("react/jsx-runtime");
  var README_STARTER_TEXT: string;
  var WELCOME_TYPE_REQUIRED_MESSAGE: string;
  var WELCOME_OPTIONS: {
    github: [string, string];
    connect: [string, string, string];
    upload: [string, string, string];
  };
  var jsxBrandUpload: typeof import("react/jsx-runtime");
  var BRAND_UPLOAD_TEXT: Preview.BrandUploadText;
  var uploadedFileIdentityIds: WeakMap<File, number>;
  var nextUploadedFileIdentityId: number;
  function WelcomeIcon({
    name: name,
    size = 14,
    className: className,
  }: Preview.WelcomeIconProps): React.ReactElement {
    return (
      <svg
        viewBox={"0 0 16 16"}
        width={size}
        height={size}
        fill={"none"}
        stroke={"currentColor"}
        strokeWidth={"1.3"}
        strokeLinecap={"round"}
        strokeLinejoin={"round"}
        aria-hidden={"true"}
        className={className}
      >
        {WELCOME_ICON_PATHS[name]}
      </svg>
    );
  }
  function HandoffNotice({
    kind: kind,
    held: held,
    onCopy: onCopy,
    prompt: prompt,
  }: Preview.HandoffNoticeProps): React.ReactElement {
    return (
      <div
        className={
          "ds-door-line flex flex-col gap-xs text-footnote text-secondary"
        }
        role={"status"}
        data-testid={"ds-handoff-note"}
      >
        {[
          <p>
            {kind === "failed" ? (
              <jsxWelcome.Fragment>
                {[
                  (0, runtime.claudeDeliveryStatusMessage)("failed", held),
                  " ",
                  <runtime.TextLink
                    onClick={onCopy}
                    data-testid={"ds-handoff-copy"}
                  >
                    {"Copy it"}
                  </runtime.TextLink>,
                ]}
              </jsxWelcome.Fragment>
            ) : (
              (0, runtime.claudeDeliveryStatusMessage)(kind, held)
            )}
          </p>,
          kind === "failed" && prompt !== undefined ? (
            <runtime.Collapsible.Root>
              {[
                <runtime.Collapsible.Trigger className={"w-fit text-secondary"}>
                  {"Show the request"}
                </runtime.Collapsible.Trigger>,
                <runtime.Collapsible.Panel keepMounted={true}>
                  <pre
                    className={
                      "mt-xs max-h-48 overflow-auto rounded bg-surface-2 p-md font-mono text-caption whitespace-pre-wrap text-secondary select-all"
                    }
                    data-testid={"ds-handoff-prompt"}
                  >
                    {prompt}
                  </pre>
                </runtime.Collapsible.Panel>,
              ]}
            </runtime.Collapsible.Root>
          ) : null,
        ]}
      </div>
    );
  }
  function WelcomeSheet({
    onGithub: onGithub,
    onConnect: onConnect,
    onUpload: onUpload,
    busy: busy,
    note: note,
    panel: panel,
  }: Preview.WelcomeSheetProps): React.ReactElement {
    let ref = reactWelcome.useRef(false),
      ref2 = reactWelcome.useRef<HTMLDivElement | null>(null);
    reactWelcome.useEffect(() => {
      if (panel === undefined && ref.current) {
        ref2.current
          ?.querySelector<HTMLElement>('[data-testid="ds-welcome-upload"]')
          ?.focus();
      }
      ref.current = panel !== undefined;
    }, [panel]);
    let ref3 = reactWelcome.useRef<HTMLDivElement | null>(null),
      ref4 = reactWelcome.useRef<
        | {
            h: number;
            w: number;
          }
        | undefined
      >(undefined),
      [value, value2] = reactWelcome.useState(false);
    reactWelcome.useLayoutEffect(() => {
      if (panel === undefined && ref3.current !== null) {
        ref4.current = {
          h: ref3.current.offsetHeight,
          w: ref3.current.offsetWidth,
        };
      }
    });
    let value3 = panel !== undefined;
    reactWelcome.useEffect(() => {
      value2(false);
      let current = ref3.current,
        current2 = ref4.current;
      if (
        !value3 ||
        current === null ||
        current2 === undefined ||
        typeof ResizeObserver === "undefined"
      ) {
        return;
      }
      let observer = new ResizeObserver(() => {
        if (Math.abs(current.offsetWidth - current2.w) > 1) {
          value2(true);
        }
      });
      observer.observe(current);
      return () => observer.disconnect();
    }, [value3]);
    let callback = (
      input: string,
      options: string,
      context: React.ReactNode,
      value4: string,
      extra: string,
      detail: ((trigger: HTMLButtonElement) => void) | undefined,
      argument: boolean = true,
    ) => {
      let value5 =
        detail === undefined
          ? WELCOME_TYPE_REQUIRED_MESSAGE
          : argument && busy === true
            ? // CucCut: user-facing copy calls the agent "the agent", not Claude.
              "A request to the agent is on its way"
            : undefined;
      return (
        <runtime.DisabledReasonTooltip reason={value5}>
          <button
            type={"button"}
            className={"ds-welcome-opt"}
            disabled={value5 !== undefined}
            onClick={(input2: React.MouseEvent<HTMLButtonElement>) =>
              detail?.(input2.currentTarget)
            }
            data-testid={input}
          >
            {[
              <span
                className={"ds-welcome-icon ds-tone-" + options}
                aria-hidden={"true"}
              >
                {context}
              </span>,
              <span className={"flex min-w-0 flex-col gap-0.5 text-left"}>
                {[
                  <span className={"text-body font-medium text-primary"}>
                    {value4}
                  </span>,
                  <span className={"text-body text-secondary"}>{extra}</span>,
                ]}
              </span>,
            ]}
          </button>
        </runtime.DisabledReasonTooltip>
      );
    };
    return (
      <runtime.SectionSheet data-testid={"ds-welcome-sheet"}>
        <div
          ref={ref3}
          className={"ds-welcome flex flex-col gap-lg"}
          style={
            value3 && !value && ref4.current !== undefined
              ? {
                  minHeight: ref4.current.h,
                }
              : undefined
          }
          data-testid={"ds-welcome"}
          {...runtime.UNCOMMENTABLE_PROPS}
        >
          {[
            panel ?? (
              <jsxWelcome.Fragment>
                {[
                  <h2 className={"ds-welcome-title"}>
                    {"Not sure where to start?"}
                  </h2>,
                  <div className={"ds-welcome-options"} ref={ref2}>
                    {[
                      callback(
                        "ds-welcome-github",
                        "green",
                        <WelcomeIcon name={"github"} size={20} />,
                        WELCOME_OPTIONS.github[0],
                        WELCOME_OPTIONS.github[1],
                        onGithub,
                      ),
                      callback(
                        "ds-welcome-connect",
                        "clay",
                        <runtime.Icon
                          name={WELCOME_OPTIONS.connect[2]}
                          size={"md"}
                        />,
                        WELCOME_OPTIONS.connect[0],
                        WELCOME_OPTIONS.connect[1],
                        onConnect,
                      ),
                      callback(
                        "ds-welcome-upload",
                        "blue",
                        <runtime.Icon
                          name={WELCOME_OPTIONS.upload[2]}
                          size={"md"}
                        />,
                        WELCOME_OPTIONS.upload[0],
                        WELCOME_OPTIONS.upload[1],
                        () => onUpload(),
                        false,
                      ),
                    ]}
                  </div>,
                ]}
              </jsxWelcome.Fragment>
            ),
            note,
          ]}
        </div>
      </runtime.SectionSheet>
    );
  }
  function EmptyDesignSystem(): React.ReactElement {
    return (
      <runtime.SectionSheet>
        <div
          className={
            "ds-empty mx-auto flex max-w-md flex-col gap-sm px-lg py-16 text-center"
          }
          data-testid={"ds-empty"}
        >
          {[
            <h2 className={"ds-page-title"}>{"Just getting started"}</h2>,
            <p className={"text-body text-secondary"}>
              {
                // CucCut: user-facing copy calls the agent "the agent", not Claude.
                "Nothing has been added to this design system yet. Once the brand’s files are in, the agent drafts it from there."
              }
            </p>,
          ]}
        </div>
      </runtime.SectionSheet>
    );
  }
  function IntakeProgressDot(): React.ReactElement {
    return (
      <span
        className={
          "ds-intake-dot size-2 shrink-0 animate-pulse rounded-full bg-fill-accent"
        }
        aria-hidden={"true"}
      />
    );
  }
  function IntakeProgressStatus({
    text: text,
    quiet = false,
  }: Preview.IntakeProgressStatusProps): React.ReactElement {
    return (
      <div
        className={
          "ds-intake-status sticky bottom-3 z-[3] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-sm rounded-full bg-surface-panel px-lg py-sm text-footnote text-secondary shadow-panel" +
          (quiet ? " invisible" : "")
        }
        role={"status"}
        aria-live={"polite"}
        data-testid={"ds-intake-progress"}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        {[<IntakeProgressDot />, text]}
      </div>
    );
  }
  function brandUploadStatusText(intake: Preview.BrandUploadIntake): string {
    if (intake.busy) {
      return BRAND_UPLOAD_TEXT.adding;
    }
    if (intake.kept === 0) {
      return "None of them could be kept.";
    }
    let singular = intake.kept === 1;
    return (
      String(intake.kept) +
      (singular ? " file" : " files") +
      " added" +
      (intake.refused.length > 0
        ? " · " + String(intake.refused.length) + " couldn’t be kept"
        : "") +
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      ". Create the design system and the agent will draft from " +
      (singular ? "that file" : "them") +
      "." +
      BRAND_UPLOAD_TEXT.save[intake.save]
    );
  }
  function uploadedFileIdentityId(file: File): number {
    let id = uploadedFileIdentityIds.get(file);
    if (id === undefined) {
      id = nextUploadedFileIdentityId++;
      uploadedFileIdentityIds.set(file, id);
    }
    return id;
  }
  function BrandUploadGrid({
    files: files,
    thumb: thumb,
    onRemove: onRemove,
    removeDisabledReason: removeDisabledReason,
    testid: testid,
  }: Preview.BrandUploadGridProps): React.ReactElement {
    return (
      <ul className={"ds-upload-grid"} data-testid={testid + "-files"}>
        {files.map((input, options) =>
          (() => {
            const _Element = "li";
            const _elementProps = {
              className: "ds-upload-tile",
              title: input.name,
              children: [
                thumb(input),
                <span
                  className={
                    "w-full truncate text-center font-mono text-caption text-secondary"
                  }
                >
                  {input.name}
                </span>,
                <span className={"ds-upload-x"}>
                  <runtime.DisabledReasonTooltip reason={removeDisabledReason}>
                    <runtime.Button
                      variant={"onContent"}
                      size={"sm"}
                      iconOnly={true}
                      icon={"X"}
                      aria-label={"Remove " + input.name}
                      tooltip={"Remove"}
                      disabled={removeDisabledReason !== undefined}
                      onClick={() => onRemove(options)}
                      data-testid={testid + "-remove-" + String(options)}
                    />
                  </runtime.DisabledReasonTooltip>
                </span>,
              ],
            };
            const _elementKey = uploadedFileIdentityId(input);
            return <_Element key={_elementKey} {..._elementProps} />;
          })(),
        )}
      </ul>
    );
  }
  function BrandUploadPanel({
    files: files,
    onFiles: onFiles,
    onLeftOut: onLeftOut,
    onRemove: onRemove,
    thumb: thumb,
    intake: intake,
    handing: handing,
    onCreate: onCreate,
    onBack: onBack,
    "data-testid": dataTestid = "ds-upload",
  }: Preview.BrandUploadPanelProps): React.ReactElement {
    let value = BRAND_UPLOAD_TEXT,
      value2 = files.length > 0,
      value3 = !value2
        ? value.noFiles
        : intake.busy
          ? value.adding
          : intake.kept === 0
            ? value.noneKept
            : handing
              ? value.waiting
              : undefined,
      ref = reactBrandUpload.useRef<HTMLDivElement | null>(null),
      ref2 = reactBrandUpload.useRef<HTMLButtonElement | null>(null),
      callback = () =>
        ref2.current?.focus({
          focusVisible: true,
        } as FocusOptions & {
          focusVisible: boolean;
        });
    reactBrandUpload.useEffect(() => {
      if (value3 === undefined) {
        callback();
      } else {
        ref.current?.querySelector("button")?.focus();
      }
    }, []);
    let ref3 = reactBrandUpload.useRef(false);
    reactBrandUpload.useEffect(() => {
      let callback2 = (event: Event) =>
          event.target instanceof Node &&
          (ref.current?.contains(event.target) ?? false),
        callback3 = (input: Event) => {
          ref3.current = !callback2(input);
        },
        callback4 = (input: Event) => {
          if (!callback2(input)) {
            ref3.current = true;
          }
        },
        callback5 = () => {
          ref3.current = true;
        },
        items: [string, EventListener][] = [
          ["pointerdown", callback3],
          ["focusin", callback4],
          ["keydown", callback4],
          ["scroll", callback5],
          ["wheel", callback5],
          ["touchmove", callback5],
        ];
      for (let [value4, value5] of items) {
        document.addEventListener(value4, value5, true);
      }
      return () => {
        for (let [value4, value5] of items) {
          document.removeEventListener(value4, value5, true);
        }
      };
    }, []);
    let ref4 = reactBrandUpload.useRef(value3 !== undefined);
    reactBrandUpload.useEffect(() => {
      let value4 = ref.current?.getBoundingClientRect(),
        value5 =
          value4 !== undefined &&
          value4.bottom >= 0 &&
          value4.top < window.innerHeight;
      if (
        ref4.current &&
        value3 === undefined &&
        document.hasFocus() &&
        !ref3.current &&
        value5
      ) {
        callback();
      }
      ref4.current = value3 !== undefined;
    }, [value3]);
    return (
      <div
        ref={ref}
        className={"flex min-h-0 flex-1 flex-col gap-md"}
        data-testid={dataTestid}
      >
        {[
          <div className={"flex items-center justify-between gap-md"}>
            {[
              <h2 className={"ds-welcome-title"}>{value.title}</h2>,
              onBack !== undefined ? (
                <span className={"text-footnote text-secondary"}>
                  <runtime.TextLink
                    inheritColor={true}
                    icon={"ArrowLeft"}
                    iconPosition={"start"}
                    onClick={onBack}
                    data-testid={dataTestid + "-back"}
                  >
                    {value.back}
                  </runtime.TextLink>
                </span>
              ) : null,
            ]}
          </div>,
          <runtime.FileDropZone
            large={true}
            folder={true}
            line={value.line}
            hint={value.hint}
            onFiles={onFiles}
            onLeftOut={onLeftOut}
            testid={dataTestid}
          />,
          value2 ? (
            <BrandUploadGrid
              files={files}
              thumb={thumb}
              onRemove={onRemove}
              removeDisabledReason={intake.busy ? value.removeLater : undefined}
              testid={dataTestid}
            />
          ) : null,
          <div
            className={
              "flex flex-wrap items-center justify-between gap-md" +
              (value2 && !intake.busy ? " ds-upload-foot" : "")
            }
          >
            {[
              <p
                className={
                  "flex min-h-6 items-center gap-sm text-footnote text-secondary"
                }
                role={"status"}
                aria-live={"polite"}
                data-testid={dataTestid + "-status"}
              >
                {[
                  value2 && intake.busy ? <IntakeProgressDot /> : null,
                  value2 ? brandUploadStatusText(intake) : "",
                ]}
              </p>,
              <runtime.DisabledReasonTooltip reason={value3}>
                <runtime.Button
                  ref={ref2}
                  data-initial-focus={""}
                  variant={"primary"}
                  disabled={value3 !== undefined}
                  onClick={onCreate}
                  data-testid={dataTestid + "-create"}
                >
                  {value.create}
                </runtime.Button>
              </runtime.DisabledReasonTooltip>,
            ]}
          </div>,
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactBrandUpload",
    () => reactBrandUpload,
    (value) => {
      reactBrandUpload = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactWelcome",
    () => reactWelcome,
    (value) => {
      reactWelcome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxWelcomeIcons",
    () => jsxWelcomeIcons,
    (value) => {
      jsxWelcomeIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WELCOME_ICON_PATHS",
    () => WELCOME_ICON_PATHS,
    (value) => {
      WELCOME_ICON_PATHS = value;
    },
  );
  bindRuntimeValue(runtime, "WelcomeIcon", () => WelcomeIcon);
  bindRuntimeValue(
    runtime,
    "jsxWelcome",
    () => jsxWelcome,
    (value) => {
      jsxWelcome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "README_STARTER_TEXT",
    () => README_STARTER_TEXT,
    (value) => {
      README_STARTER_TEXT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WELCOME_TYPE_REQUIRED_MESSAGE",
    () => WELCOME_TYPE_REQUIRED_MESSAGE,
    (value) => {
      WELCOME_TYPE_REQUIRED_MESSAGE = value;
    },
  );
  bindRuntimeValue(runtime, "HandoffNotice", () => HandoffNotice);
  bindRuntimeValue(
    runtime,
    "WELCOME_OPTIONS",
    () => WELCOME_OPTIONS,
    (value) => {
      WELCOME_OPTIONS = value;
    },
  );
  bindRuntimeValue(runtime, "WelcomeSheet", () => WelcomeSheet);
  bindRuntimeValue(runtime, "EmptyDesignSystem", () => EmptyDesignSystem);
  bindRuntimeValue(runtime, "IntakeProgressDot", () => IntakeProgressDot);
  bindRuntimeValue(runtime, "IntakeProgressStatus", () => IntakeProgressStatus);
  bindRuntimeValue(
    runtime,
    "jsxBrandUpload",
    () => jsxBrandUpload,
    (value) => {
      jsxBrandUpload = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BRAND_UPLOAD_TEXT",
    () => BRAND_UPLOAD_TEXT,
    (value) => {
      BRAND_UPLOAD_TEXT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "brandUploadStatusText",
    () => brandUploadStatusText,
  );
  bindRuntimeValue(
    runtime,
    "uploadedFileIdentityIds",
    () => uploadedFileIdentityIds,
    (value) => {
      uploadedFileIdentityIds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nextUploadedFileIdentityId",
    () => nextUploadedFileIdentityId,
    (value) => {
      nextUploadedFileIdentityId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "uploadedFileIdentityId",
    () => uploadedFileIdentityId,
  );
  bindRuntimeValue(runtime, "BrandUploadGrid", () => BrandUploadGrid);
  bindRuntimeValue(runtime, "BrandUploadPanel", () => BrandUploadPanel);
  return () => {
    reactBrandUpload = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactWelcome = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxWelcomeIcons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    WELCOME_ICON_PATHS = {
      github: (
        <path
          d={
            "M8 1.8a6.3 6.3 0 0 0-2 12.3c.3.1.4-.1.4-.3v-1.1c-1.8.4-2.1-.8-2.1-.8-.3-.7-.7-.9-.7-.9-.6-.4 0-.4 0-.4.6 0 1 .6 1 .6.6 1 1.5.7 1.9.5.1-.4.2-.7.4-.9-1.4-.2-2.9-.7-2.9-3.1 0-.7.2-1.2.6-1.7-.1-.2-.3-.8.1-1.7 0 0 .5-.2 1.7.6a5.8 5.8 0 0 1 3.1 0c1.2-.8 1.7-.6 1.7-.6.4.9.1 1.5.1 1.7.4.5.6 1 .6 1.7 0 2.4-1.5 2.9-2.9 3.1.2.2.4.6.4 1.2v1.8c0 .2.1.4.4.3A6.3 6.3 0 0 0 8 1.8Z"
          }
          fill={"currentColor"}
          stroke={"none"}
        />
      ),
    };
    jsxWelcome = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    // CucCut: user-facing copy calls the agent "the agent", not Claude.
    README_STARTER_TEXT = [
      "# Your design system…",
      "",
      "This page is yours to edit. Click anywhere and write what this system is for, the rules it follows, and how to use its tokens and components — the agent reads it before it designs anything.",
      "",
      "## Principles",
      "",
      "- A short rule the whole system follows",
      "- Another one — keep each to a line",
      "",
      "## Using tokens",
      "",
      "Which colours, type and spacing to reach for, and when.",
      "",
      "## Using components",
      "",
      "Where the components come from, and the one or two that are easy to misuse.",
      "",
      "## Accessibility",
      "",
      "Which text and background pairs are guaranteed legible, the focus ring, and what never relies on colour alone.",
      "",
    ].join(`
`);
    WELCOME_TYPE_REQUIRED_MESSAGE =
      "Works in a design system made from the Design System type";
    WELCOME_OPTIONS = {
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      github: [
        "Sync from GitHub",
        "Point the agent at a repository; it imports tokens and components from code.",
      ],
      connect: [
        "Build from connectors",
        "The agent builds from your connected tools, or asks you a few questions first.",
        "Connectors",
      ],
      upload: [
        "Upload brand files",
        "Drop in logos, fonts, guidelines and token files; the agent drafts from them.",
        "FileUpload",
      ],
    };
    jsxBrandUpload = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    BRAND_UPLOAD_TEXT = {
      title: "Upload your brand’s files",
      line: "Drop logos, fonts, brand guidelines and token files here",
      hint: "Images, font files, PDFs, CSS or JSON tokens, screenshots — a folder keeps its name as a group.",
      create: "Create design system",
      back: "Back",
      noFiles: "Drop or choose the brand’s files first",
      adding: "Adding them to the page…",
      noneKept: "The page couldn’t keep any of them — try other files",
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      waiting: "A request to the agent is on its way",
      removeLater: "You can remove it once the upload finishes",
      save: {
        clean: "",
        hold: " Not saved yet; creating saves the page first.",
        saving: " The page is still saving.",
        error: " The last save failed; creating tries it again.",
      },
    };
    uploadedFileIdentityIds = new WeakMap();
    nextUploadedFileIdentityId = 0;
  };
}
