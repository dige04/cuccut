/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { BuildEffectName, SlideTransition } from "../deck-contracts";

/** One build animation played when a slide moves to a build step. */
export interface DeckPageBuildEvent {
  /** Id of the frame that animates. */
  id: string;
  /** Whether the frame enters or leaves. */
  dir: "in" | "out";
  effect: BuildEffectName;
}

/** One build step of a slide. */
export interface DeckPageStep {
  /** Ids of the frames hidden while this step is showing. */
  hidden: string[];
  events: DeckPageBuildEvent[];
  /** Whether the step advances by itself. */
  auto: boolean;
}

/** A live web embed of a slide. */
export interface DeckPageEmbed {
  /** Id of the frame holding the embed. */
  id: string;
  /** Document the embed's sandboxed iframe loads. */
  srcdoc: string;
}

/** What the exported page needs to know about one slide. */
export interface DeckPageSlide {
  /** Transition into the next slide; absent for a plain cut. */
  transition?: SlideTransition;
  /** Resolved background colour. */
  bg: string;
  /** Build steps; the first is the slide before any build. */
  steps: DeckPageStep[];
  embeds: DeckPageEmbed[];
}

/** How a frame enters during a build animation. */
export interface DeckPageEffect {
  /** CSS transform the frame starts from (empty for none). */
  transform: string;
  easing: string;
}

/** Configuration the exported page hands to `deckPageRuntime` as inline JSON. */
export interface DeckPageConfig {
  /** Slide canvas size. */
  w: number;
  h: number;
  /** Duration of a build animation. */
  buildMs: number;
  exitEasing: string;
  /** Entry animation per build effect name. */
  effects: Record<string, DeckPageEffect>;
  /** Transition duration per transition kind. */
  transMs: Partial<Record<SlideTransition, number>>;
  transEase: string;
  /** Whether web embeds run live in the page (otherwise they stay pictures). */
  live: boolean;
  slides: DeckPageSlide[];
}

/** The slide and build step currently showing. */
interface DeckPagePosition {
  index: number;
  step: number;
}

/** A transition request; empty for a plain cut. */
interface DeckPageTransitionRequest {
  kind?: SlideTransition;
  /** Whether the slides are travelled backwards. */
  back?: boolean;
  /** Where the transition starts from. */
  from?: DeckPagePosition;
}

/** A transition that is still running. */
interface DeckPageTransitionHandle {
  cleanup: () => void;
}

/** A live embed: its sandboxed iframe and the frame element hosting it. */
interface DeckPageEmbedMount {
  iframe: HTMLIFrameElement;
  host: Element;
}

/** Position and size relative to a slide, in canvas pixels. */
interface DeckPageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What an embed posts to its parent page. */
interface DeckPageEmbedMessage {
  type?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** The script that drives an exported deck page (stringified into the page by `deckPageRuntimeSource`). */
    deckPageRuntime: (config: DeckPageConfig) => void;
    deckPageRuntimeSource: () => string;
  }
}

export function installExportPageRuntime(runtime: RuntimeBindings): () => void {
  function deckPageRuntime(config: DeckPageConfig): void {
    var value: Document = document,
      documentElement: HTMLElement = value.documentElement;
    documentElement.classList.add("deck-js");
    var count = 1;
    function value2(): void {
      var value4 = Math.min(
        documentElement.clientWidth / config.w,
        documentElement.clientHeight / config.h,
      );
      count = value4 > 0 ? value4 : 1;
      documentElement.style.setProperty("--deck-s", String(count));
    }
    value2();
    function value3(): void {
      var value4: HTMLElement[] = Array.prototype.slice.call(
          value.querySelectorAll(".deck-slide"),
        ),
        length = value4.length;
      if (length === 0) {
        return;
      }
      var value5: HTMLElement[] = value4.map(function (
          element2: HTMLElement,
        ): HTMLElement {
          return element2.querySelector<HTMLElement>(".deck-scaler > *") || element2;
        }),
        element = value.querySelector(".deck-pager"),
        value6 =
          typeof window.matchMedia === "function"
            ? window.matchMedia("(max-aspect-ratio: 1/1)")
            : null,
        state: DeckPagePosition = {
          index: 0,
          step: 0,
        },
        flag = false,
        items: Animation[] = [],
        index = 0,
        index2 = 0,
        index3 = 0,
        value7: DeckPageTransitionHandle | null = null,
        items2: DeckPageEmbedMount[] = [],
        flag2 = false,
        flag3 = true,
        value8 = -1,
        flag4 = false;
      function value9(): boolean {
        return (
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
        );
      }
      function value10(input: number): number {
        if (config.slides[input]) {
          return config.slides[input]!.steps.length - 1;
        } else {
          return 0;
        }
      }
      function value11(input: number, options: string): HTMLElement | null {
        return value5[input]!.querySelector<HTMLElement>(
          '[data-frame-id="' + options.replace(/["\\]/g, "") + '"]',
        );
      }
      function value12(input: number): HTMLElement[] {
        return Array.prototype.slice.call(
          value5[input]!.querySelectorAll("[data-frame-id]"),
        );
      }
      function value13(input: number): void {
        try {
          window.history.replaceState(
            null,
            "",
            "#" + String(input + 1),
          );
        } catch (value37: unknown) {}
      }
      function value14(input: number): void {
        if (element === null) {
          return;
        }
        element.textContent = String(input + 1) + " / " + String(length);
        element.setAttribute("data-on", "");
        clearTimeout(index2);
        index2 = window.setTimeout(function (): void {
          if (element !== null) {
            element.removeAttribute("data-on");
          }
        }, 1600);
      }
      function value15(): number {
        var scrollTop = documentElement.scrollTop,
          index9 = 0;
        for (var count2 = 1; count2 < length; count2++)
          if (
            Math.abs(value4[count2]!.offsetTop - scrollTop) <
            Math.abs(value4[index9]!.offsetTop - scrollTop)
          ) {
            index9 = count2;
          }
        return index9;
      }
      function value16(input: number): void {
        input = Math.max(0, Math.min(length - 1, input));
        state = {
          index: input,
          step: 0,
        };
        value4[input]!.scrollIntoView();
        value13(input);
        value14(input);
      }
      function value17(input: number, options: number): void {
        var value37 = config.slides[input],
          value38: string[] =
            value37 && value37.steps[options]
              ? value37.steps[options]!.hidden
              : [],
          value39 = value12(input);
        for (var index9 = 0; index9 < value39.length; index9++) {
          var value40 =
            value39[index9]!.getAttribute("data-frame-id") || "";
          if (value38.indexOf(value40) >= 0) {
            value39[index9]!.setAttribute("data-build-hidden", "");
          } else {
            value39[index9]!.removeAttribute("data-build-hidden");
          }
        }
      }
      function value18(): void {
        for (var index9 = 0; index9 < items.length; index9++)
          items[index9]!.cancel();
        items = [];
      }
      function value19(input: number, options: number): void {
        var value37 = config.slides[input],
          value38: DeckPageBuildEvent[] =
            value37 && value37.steps[options]
              ? value37.steps[options]!.events
              : [];
        for (var index9 = 0; index9 < value38.length; index9++) {
          var value39 = value38[index9]!,
            value40 = value11(input, value39.id),
            value41 = config.effects[value39.effect];
          if (
            value40 === null ||
            value41 === undefined ||
            typeof value40.animate !== "function"
          ) {
            continue;
          }
          var value42 =
              value40.style.transform !== "" &&
              value40.style.transform !== "none"
                ? value40.style.transform
                : "",
            state2 = {
              transform: (value42 + " " + value41.transform).trim() || "none",
              opacity: 0,
            },
            state3 = {
              transform: value42 === "" ? "none" : value42,
              opacity: 1,
            };
          value40.removeAttribute("data-build-hidden");
          if (value39.dir === "in") {
            items.push(
              value40.animate([state2, state3], {
                duration: config.buildMs,
                easing: value41.easing,
                fill: "none",
              }),
            );
          } else {
            var value43 = value40.animate([state3, state2], {
              duration: config.buildMs,
              easing: config.exitEasing,
              fill: "none",
            });
            (function (input2: HTMLElement, options2: Animation): void {
              options2.finished.then(
                function (): void {
                  input2.setAttribute("data-build-hidden", "");
                },
                function (): void {},
              );
            })(value40, value43);
            items.push(value43);
          }
        }
      }
      var text =
          "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;pointer-events:none;background:transparent",
        text2 =
          "position:absolute;inset:0;box-sizing:border-box;align-items:center;justify-content:center;text-align:center;background:rgba(115,114,108,0.12);border:2px dashed rgba(115,114,108,0.4);color:#73726C;font:24px system-ui,sans-serif";
      function value20(input: DeckPageEmbedMount, options: string): void {
        if (input.iframe.parentNode !== null) {
          input.iframe.parentNode.removeChild(input.iframe);
        }
        input.host.setAttribute("data-embed-dead", "");
        var value37 = value.createElement("div");
        value37.setAttribute("data-embed-dead-label", "");
        value37.setAttribute("style", text2);
        value37.textContent = options;
        input.host.appendChild(value37);
      }
      function value21(input: string): void {
        flag2 = true;
        var value37 = items2;
        items2 = [];
        for (var index9 = 0; index9 < value37.length; index9++)
          value20(value37[index9]!, input);
      }
      function value22(): void {
        var value37 = items2;
        items2 = [];
        for (var index9 = 0; index9 < value37.length; index9++) {
          if (value37[index9]!.iframe.parentNode !== null) {
            value37[index9]!.iframe.parentNode!.removeChild(
              value37[index9]!.iframe,
            );
          }
          var element2 =
            value37[index9]!.host.querySelector("[data-embed-under]");
          if (element2 !== null) {
            element2.removeAttribute("data-embed-under");
          }
        }
      }
      function value23(input: number): void {
        if (!config.live || flag2) {
          return;
        }
        var value37: DeckPageEmbed[] = config.slides[input]
          ? config.slides[input]!.embeds
          : [];
        for (var index9 = 0; index9 < value37.length; index9++) {
          var value38 = value11(input, value37[index9]!.id);
          if (value38 === null || value38.hasAttribute("data-embed-dead")) {
            continue;
          }
          var firstElementChild = value38.firstElementChild;
          if (firstElementChild !== null) {
            firstElementChild.setAttribute("data-embed-under", "");
            firstElementChild.setAttribute("data-embed-pic", "");
          }
          var value39 = value.createElement("iframe");
          value39.setAttribute("sandbox", "allow-scripts");
          value39.setAttribute("inert", "");
          value39.setAttribute("tabindex", "-1");
          value39.setAttribute("referrerpolicy", "no-referrer");
          value39.setAttribute("title", "Embedded web content (sandboxed)");
          value39.setAttribute("style", text);
          var state2: DeckPageEmbedMount = {
            iframe: value39,
            host: value38,
          };
          (function (input2: DeckPageEmbedMount): void {
            var index10 = 0;
            input2.iframe.addEventListener("load", function (): void {
              index10 += 1;
              if (index10 > 1) {
                items2 = items2.filter(function (
                  input3: DeckPageEmbedMount,
                ): boolean {
                  return input3 !== input2;
                });
                value20(
                  input2,
                  "Web embed disabled. It navigated away from its content.",
                );
              }
            });
          })(state2);
          value39.srcdoc = value37[index9]!.srcdoc;
          items2.push(state2);
          value38.appendChild(value39);
        }
      }
      function value24(): void {
        flag4 = true;
      }
      window.addEventListener("beforeunload", value24);
      window.addEventListener("pagehide", value24);
      window.addEventListener(
        "pageshow",
        function (input: PageTransitionEvent): void {
          flag4 = false;
          if (input.persisted && flag) {
            value22();
            value23(state.index);
          }
        },
      );
      window.addEventListener(
        "message",
        function (dataset: MessageEvent): void {
          if (flag4) {
            return;
          }
          var value37: DeckPageEmbedMount | null = null;
          for (var index9 = 0; index9 < items2.length; index9++)
            if (
              dataset.source !== null &&
              items2[index9]!.iframe.contentWindow === dataset.source
            ) {
              value37 = items2[index9]!;
            }
          if (value37 === null || dataset.origin !== "null") {
            return;
          }
          var data: DeckPageEmbedMessage | null = dataset.data;
          if (typeof data !== "object" || data === null) {
            return;
          }
          if (data.type === "appifact-embed:navigating") {
            items2 = items2.filter(function (
              input: DeckPageEmbedMount,
            ): boolean {
              return input !== value37;
            });
            value20(
              value37,
              "Web embed disabled. It navigated away from its content.",
            );
          } else if (
            data.type === "appifact-embed:ready" &&
            value37.iframe.contentWindow !== null
          ) {
            value37.iframe.contentWindow.postMessage(
              {
                type: "appifact-embed:update",
                t: 0,
                playing: false,
                selected: false,
                props: {},
              },
              "*",
            );
          }
        },
      );
      window.addEventListener("blur", function (): void {
        window.setTimeout(function (): void {
          var activeElement = value.activeElement as HTMLElement | null;
          if (
            items2.length > 0 &&
            (value.hasFocus() ||
              (activeElement !== null && activeElement.tagName === "IFRAME"))
          ) {
            value21("Web embed disabled. It tried to take keyboard focus.");
            if (activeElement !== null && activeElement.tagName === "IFRAME") {
              activeElement.blur();
            }
            window.focus();
          }
        }, 0);
      });
      function value25(input: Element, options: DOMRect): DeckPageBox {
        var bounds = input.getBoundingClientRect();
        return {
          x: (bounds.left - options.left) / count,
          y: (bounds.top - options.top) / count,
          w: bounds.width / count,
          h: bounds.height / count,
        };
      }
      function value26(input: DeckPageBox): Record<string, string> {
        return {
          left: String(input.x) + "px",
          top: String(input.y) + "px",
          right: "auto",
          bottom: "auto",
          width: String(input.w) + "px",
          height: String(input.h) + "px",
          transform: "none",
        };
      }
      function value27(input: DeckPageBox, options: DeckPageBox): boolean {
        return (
          Math.abs(input.x - options.x) < 0.5 &&
          Math.abs(input.y - options.y) < 0.5 &&
          Math.abs(input.w - options.w) < 0.5 &&
          Math.abs(input.h - options.h) < 0.5
        );
      }
      function value28(input: number): string[] {
        return (config.slides[input] ? config.slides[input]!.embeds : []).map(
          function (input2: DeckPageEmbed): string {
            return input2.id;
          },
        );
      }
      function value29(
        input: SlideTransition,
        options: boolean,
        context: DeckPagePosition,
        value37: DeckPagePosition,
      ): void {
        var value38 = value4[context.index]!,
          value39 = value5[context.index]!,
          value40 = value5[value37.index]!,
          value41 = config.transMs[input] || 0,
          state2: KeyframeAnimationOptions = {
            duration: value41,
            easing: config.transEase,
            fill: "forwards",
          },
          items3: Animation[] = [],
          value42: HTMLElement | null = null,
          items4: Element[] = [],
          background = value39.style.background;
        value38.removeAttribute("data-off");
        value38.setAttribute("data-leaving", "");
        var value43: string[] = config.slides[context.index]!.steps[context.step]
            ? config.slides[context.index]!.steps[context.step]!.hidden
            : [],
          value44: string[] = config.slides[value37.index]!.steps[value37.step]
            ? config.slides[value37.index]!.steps[value37.step]!.hidden
            : [],
          value45 = value28(context.index),
          value46 = value12(context.index);
        for (var index9 = 0; index9 < value46.length; index9++) {
          var value47 =
            value46[index9]!.getAttribute("data-frame-id") || "";
          if (value45.indexOf(value47) >= 0) {
            value46[index9]!.setAttribute("data-magic-hidden", "");
            items4.push(value46[index9]!);
          }
        }
        var value48 = typeof value38.animate === "function";
        if (value48 && input === "fade") {
          items3.push(
            value38.animate(
              [
                {
                  opacity: 1,
                },
                {
                  opacity: 0,
                },
              ],
              state2,
            ),
          );
        } else if (value48 && input === "push") {
          var value49 = options ? -config.w : config.w;
          items3.push(
            value39.animate(
              [
                {
                  transform: "translateX(0px)",
                },
                {
                  transform: "translateX(" + String(-value49) + "px)",
                },
              ],
              state2,
            ),
          );
          items3.push(
            value40.animate(
              [
                {
                  transform: "translateX(" + String(value49) + "px)",
                },
                {
                  transform: "translateX(0px)",
                },
              ],
              state2,
            ),
          );
        } else if (value48) {
          value39.style.background = "transparent";
          if (
            config.slides[context.index]!.bg !== config.slides[value37.index]!.bg
          ) {
            value42 = value.createElement("div");
            value42.setAttribute(
              "style",
              "position:absolute;inset:0;background:" +
                config.slides[context.index]!.bg,
            );
            value40.insertBefore(value42, value40.firstChild);
            items3.push(
              value42.animate(
                [
                  {
                    opacity: 1,
                  },
                  {
                    opacity: 0,
                  },
                ],
                state2,
              ),
            );
          }
          var bounds = value39.getBoundingClientRect(),
            bounds2 = value40.getBoundingClientRect(),
            items5: string[] = [];
          for (var index10 = 0; index10 < value46.length; index10++) {
            var value50 = value46[index10]!,
              value51 = value50.getAttribute("data-frame-id") || "";
            if (value43.indexOf(value51) >= 0) {
              continue;
            }
            var value52 =
              value44.indexOf(value51) >= 0
                ? null
                : value11(value37.index, value51);
            if (value52 === null) {
              if (value45.indexOf(value51) < 0) {
                items3.push(
                  value50.animate(
                    [
                      {
                        opacity: 1,
                      },
                      {
                        opacity: 0,
                      },
                    ],
                    state2,
                  ),
                );
              }
              continue;
            }
            items5.push(value51);
            value50.setAttribute("data-magic-hidden", "");
            items4.push(value50);
            var value53 = value25(value50, bounds),
              value54 = value25(value52, bounds2);
            if (!value27(value53, value54)) {
              items3.push(
                value52.animate([value26(value53), value26(value54)], state2),
              );
            }
          }
          var value55 = value12(value37.index);
          for (var index11 = 0; index11 < value55.length; index11++) {
            var value56 =
              value55[index11]!.getAttribute("data-frame-id") || "";
            if (items5.indexOf(value56) >= 0 || value44.indexOf(value56) >= 0) {
              continue;
            }
            items3.push(
              value55[index11]!.animate(
                [
                  {
                    opacity: 0,
                  },
                  {
                    opacity: 1,
                  },
                ],
                state2,
              ),
            );
          }
        }
        var flag6 = false;
        function value57(): void {
          if (flag6) {
            return;
          }
          flag6 = true;
          clearTimeout(value58);
          value7 = null;
          value38.setAttribute("data-off", "");
          value38.removeAttribute("data-leaving");
          for (var index12 = 0; index12 < items3.length; index12++)
            items3[index12]!.cancel();
          if (value42 !== null && value42.parentNode !== null) {
            value42.parentNode.removeChild(value42);
          }
          value39.style.background = background;
          for (var index13 = 0; index13 < items4.length; index13++)
            items4[index13]!.removeAttribute("data-magic-hidden");
        }
        var value58: number = window.setTimeout(
          value57,
          value41 + 250,
        );
        Promise.all(
          items3.map(function (input2: Animation): Promise<null> {
            return input2.finished.then(
              function (): null {
                return null;
              },
              function (): null {
                return null;
              },
            );
          }),
        ).then(value57);
        value7 = {
          cleanup: value57,
        };
      }
      function value30(
        input: DeckPagePosition,
        source: DeckPageTransitionRequest,
      ): void {
        var value37 = state;
        state = input;
        value18();
        clearTimeout(index);
        if (input.index !== value37.index) {
          value22();
          for (var index9 = 0; index9 < length; index9++)
            if (index9 === input.index) {
              value4[index9]!.removeAttribute("data-off");
              value4[index9]!.removeAttribute("aria-hidden");
              value4[index9]!.removeAttribute("inert");
            } else {
              value4[index9]!.setAttribute("data-off", "");
              value4[index9]!.setAttribute("aria-hidden", "true");
              value4[index9]!.setAttribute("inert", "");
            }
          if (value37.index >= 0 && value37.index < length) {
            value17(value37.index, value37.step);
          }
          value17(input.index, input.step);
          if (source.kind !== undefined && source.from !== undefined) {
            value29(source.kind, source.back === true, source.from, input);
          }
          value23(input.index);
          if (value37.index >= 0) {
            value13(input.index);
          }
          value14(input.index);
        } else if (
          (value17(input.index, input.step),
          input.step === value37.step + 1 && !value9())
        ) {
          value19(input.index, input.step);
        }
        var value38 =
            input.index === value37.index && input.step < value37.step,
          value39 = input.step + 1,
          value40 = config.slides[input.index];
        if (
          !value38 &&
          value40 !== undefined &&
          value39 <= value10(input.index) &&
          value40.steps[value39]!.auto
        ) {
          var value41 =
              input.index === value37.index ? config.buildMs + 140 : 600,
            value42 = input;
          index = window.setTimeout(function (): void {
            if (
              flag &&
              state.index === value42.index &&
              state.step === value42.step
            ) {
              value30(
                {
                  index: value42.index,
                  step: value39,
                },
                {},
              );
            }
          }, value41);
        }
      }
      function value31(input: number): void {
        if (!flag) {
          value16(value15() + (input > 0 ? 1 : -1));
          return;
        }
        if (value7 !== null) {
          value7.cleanup();
        }
        var value37 = state;
        if (input > 0) {
          if (value37.step < value10(value37.index)) {
            value30(
              {
                index: value37.index,
                step: value37.step + 1,
              },
              {},
            );
            return;
          }
          if (value37.index >= length - 1) {
            return;
          }
          var value38: SlideTransition | undefined = config.slides[value37.index]
            ? config.slides[value37.index]!.transition
            : undefined;
          value30(
            {
              index: value37.index + 1,
              step: 0,
            },
            value38 !== undefined && !value9()
              ? {
                  kind: value38,
                  back: false,
                  from: value37,
                }
              : {},
          );
        } else {
          if (value37.step > 0) {
            value30(
              {
                index: value37.index,
                step: value37.step - 1,
              },
              {},
            );
            return;
          }
          if (value37.index <= 0) {
            return;
          }
          var value39: SlideTransition | undefined = config.slides[value37.index - 1]
            ? config.slides[value37.index - 1]!.transition
            : undefined;
          value30(
            {
              index: value37.index - 1,
              step: value10(value37.index - 1),
            },
            value39 !== undefined && !value9()
              ? {
                  kind: value39,
                  back: true,
                  from: value37,
                }
              : {},
          );
        }
      }
      function value32(input: number): void {
        input = Math.max(0, Math.min(length - 1, input));
        if (!flag) {
          value16(input);
          return;
        }
        if (value7 !== null) {
          value7.cleanup();
        }
        if (state.index === input && state.step === 0) {
          value14(input);
          return;
        }
        value30(
          {
            index: input,
            step: 0,
          },
          {},
        );
      }
      function value33(input: boolean): void {
        if (input === flag) {
          return;
        }
        flag = input;
        if (input) {
          var value37 =
            flag3 || state.index < 0 ? value15() : state.index;
          documentElement.classList.add("deck-stage");
          documentElement.scrollTop = 0;
          state = {
            index: -1,
            step: 0,
          };
          value30(
            {
              index: value37,
              step: 0,
            },
            {},
          );
        } else {
          if (value7 !== null) {
            value7.cleanup();
          }
          value18();
          clearTimeout(index);
          value22();
          for (var index9 = 0; index9 < length; index9++) {
            value4[index9]!.removeAttribute("data-off");
            value4[index9]!.removeAttribute("aria-hidden");
            var value38 = value12(index9);
            for (var index10 = 0; index10 < value38.length; index10++)
              value38[index10]!.removeAttribute("data-build-hidden");
          }
          for (var index11 = 0; index11 < length; index11++)
            value4[index11]!.removeAttribute("inert");
          documentElement.classList.remove("deck-stage");
          value4[Math.max(0, state.index)]!.scrollIntoView();
          value8 = documentElement.scrollTop;
          flag3 = false;
        }
      }
      function value34(): void {
        value2();
        value33(value6 === null || !value6.matches);
      }
      window.addEventListener("resize", value34);
      window.addEventListener("beforeprint", function (): void {
        value22();
      });
      window.addEventListener("afterprint", function (): void {
        if (flag) {
          value23(state.index);
        }
      });
      window.addEventListener(
        "scroll",
        function (): void {
          if (flag) {
            return;
          }
          var value37 = value15();
          if (Math.abs(documentElement.scrollTop - value8) > 2) {
            flag3 = true;
          }
          value14(value37);
          clearTimeout(index3);
          index3 = window.setTimeout(function (): void {
            value13(value37);
          }, 150);
        },
        {
          passive: true,
        },
      );
      var index4 = 0,
        index5 = 0,
        flag5 = false;
      window.addEventListener(
        "wheel",
        function (event: WheelEvent): void {
          if (
            event.ctrlKey ||
            !flag ||
            Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ) {
            return;
          }
          event.preventDefault();
          clearTimeout(index5);
          index5 = window.setTimeout(function (): void {
            flag5 = false;
            index4 = 0;
          }, 250);
          if (flag5) {
            return;
          }
          index4 += event.deltaMode
            ? event.deltaY > 0
              ? 60
              : event.deltaY < 0
                ? -60
                : 0
            : event.deltaY;
          if (Math.abs(index4) >= 60) {
            flag5 = true;
            value31(index4 > 0 ? 1 : -1);
            index4 = 0;
          }
        },
        {
          passive: false,
        },
      );
      value.addEventListener("click", function (event: MouseEvent): void {
        var target = event.target as Element | null,
          value37 = value.getSelection();
        if (
          event.button !== 0 ||
          !flag ||
          target === null ||
          target.closest("a,[data-text-path],[data-cell]") !== null ||
          (value37 !== null && String(value37) !== "")
        ) {
          return;
        }
        value31(event.clientX < documentElement.clientWidth / 2 ? -1 : 1);
      });
      var index6 = 0,
        index7 = 0,
        index8 = 0;
      value.addEventListener(
        "touchstart",
        function (input: TouchEvent): void {
          if (input.touches.length !== 1) {
            index8 = 0;
            return;
          }
          index6 = input.touches[0]!.clientX;
          index7 = input.touches[0]!.clientY;
          index8 = Date.now();
        },
        {
          passive: true,
        },
      );
      value.addEventListener("touchcancel", function (): void {
        index8 = 0;
      });
      value.addEventListener(
        "touchend",
        function (input: TouchEvent): void {
          if (!flag || input.changedTouches.length !== 1) {
            return;
          }
          var value37 = input.changedTouches[0]!.clientX - index6,
            value38 = input.changedTouches[0]!.clientY - index7;
          if (
            Date.now() - index8 > 700 ||
            Math.abs(value37) < 40 ||
            Math.abs(value37) < Math.abs(value38) * 1.2
          ) {
            return;
          }
          value31(value37 < 0 ? 1 : -1);
        },
        {
          passive: true,
        },
      );
      window.addEventListener(
        "keydown",
        function (event: KeyboardEvent): void {
          if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
          }
          var key = event.key;
          if (
            (key === " " && event.shiftKey) ||
            key === "ArrowLeft" ||
            key === "ArrowUp" ||
            key === "PageUp"
          ) {
            event.preventDefault();
            value31(-1);
          } else if (
            key === "ArrowRight" ||
            key === "ArrowDown" ||
            key === "PageDown" ||
            key === " "
          ) {
            event.preventDefault();
            value31(1);
          } else if (key === "Home") {
            event.preventDefault();
            value32(0);
          } else if (key === "End") {
            event.preventDefault();
            value32(length - 1);
          } else if (/^[1-9]$/.test(key) && Number(key) <= length) {
            value32(Number(key) - 1);
          } else if (key === "f" || key === "F") {
            if (value.fullscreenElement) {
              value.exitFullscreen();
            } else if (documentElement.requestFullscreen) {
              documentElement.requestFullscreen();
            }
          }
        },
      );
      window.addEventListener("hashchange", function (): void {
        var value37 = /^#(\d+)$/.exec(
          window.location.hash,
        );
        if (value37 !== null && Number(value37[1]) - 1 !== state.index) {
          value32(Number(value37[1]) - 1);
        }
      });
      var value35 = /^#(\d+)$/.exec(window.location.hash),
        value36 =
          value35 !== null
            ? Math.max(0, Math.min(length - 1, Number(value35[1]) - 1))
            : 0;
      value34();
      if (flag) {
        if (value36 !== state.index) {
          value32(value36);
        } else {
          value14(value36);
        }
      } else if (value35 !== null) {
        value16(value36);
      } else {
        value14(value15());
      }
    }
    if (value.readyState === "loading") {
      value.addEventListener("DOMContentLoaded", value3);
    } else {
      value3();
    }
  }
  function deckPageRuntimeSource(): string {
    return deckPageRuntime.toString();
  }
  bindRuntimeValue(runtime, "deckPageRuntime", () => deckPageRuntime);
  bindRuntimeValue(
    runtime,
    "deckPageRuntimeSource",
    () => deckPageRuntimeSource,
  );
  return () => {};
}
