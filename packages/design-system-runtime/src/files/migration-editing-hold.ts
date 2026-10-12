import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesMigrationEditingHold(
  runtime: RuntimeBindings,
): () => void {
  var MIGRATION_HOLD_BLOCKED_EVENTS: string[];
  var REOPEN_FOCUS_HOLD_MS: number;
  function migrationHoldAllowsKey(event: { key?: string }): boolean {
    let key = event.key ?? "";
    return key === "Escape" || key === "Tab" || /^F\d{1,2}$/.test(key);
  }
  function restoreReopenedFocus(host: Window, focusId?: string): void {
    let focusTarget = (): void => {
      let value2 = focusId !== undefined && focusId !== "",
        value3 =
          (value2 ? host.document.getElementById(focusId as string) : null) ??
          host.document.querySelector<HTMLElement>("main h1, main h2, main");
      if (value3 === null) {
        return;
      }
      if (!value3.hasAttribute("tabindex")) {
        value3.setAttribute("tabindex", "-1");
      }
      value3.focus({
        preventScroll: !value2,
      });
    };
    if (host.document.hasFocus()) {
      return focusTarget();
    }
    let flag: boolean = true,
      value: number | undefined,
      callback = (): void => {
        if (!flag) {
          return;
        }
        flag = false;
        host.clearTimeout(value);
        host.document.removeEventListener("visibilitychange", callback3);
        host.removeEventListener("focus", callback2, false);
        for (let value2 of ["keydown", "pointerdown"]) {
          host.removeEventListener(value2, callback, true);
        }
      },
      callback2 = (): void => {
        if (!flag) {
          return;
        }
        callback();
        focusTarget();
      },
      callback3 = (): void => {
        host.clearTimeout(value);
        value =
          host.document.visibilityState === "visible"
            ? host.setTimeout(callback, REOPEN_FOCUS_HOLD_MS)
            : undefined;
      };
    host.addEventListener("focus", callback2, false);
    for (let value2 of ["keydown", "pointerdown"]) {
      host.addEventListener(value2, callback, true);
    }
    host.document.addEventListener("visibilitychange", callback3);
    callback3();
  }
  function createMigrationEditingHold(host: Window): Boot.EditingHold {
    let banner: HTMLDivElement | undefined,
      madeInert: (Element & { inert?: boolean })[] = [],
      blockEvent = (event: Event & { key?: string }): void => {
        if (event.type.startsWith("key") && migrationHoldAllowsKey(event)) {
          return;
        }
        event.stopImmediatePropagation();
        event.preventDefault();
      };
    return {
      held: (): boolean => banner !== undefined,
      hold(input): void {
        if (banner !== undefined) {
          return;
        }
        let body = host.document.body;
        madeInert = Array.from(body.children).filter(
          (input2: Element & { inert?: boolean }): boolean =>
            input2.inert !== true,
        );
        for (let value2 of madeInert) {
          value2.inert = true;
        }
        for (let value2 of MIGRATION_HOLD_BLOCKED_EVENTS) {
          host.addEventListener(value2, blockEvent, true);
        }
        let value = (banner = host.document.createElement("div"));
        value.setAttribute("role", "status");
        value.style.cssText =
          "position:fixed;inset:0 0 auto 0;z-index:2147483647;padding:10px 16px;background:#1f1e1d;color:#faf9f5;font:14px/1.4 system-ui,sans-serif;text-align:center";
        body.appendChild(value);
        host.setTimeout((): void => {
          if (banner === value) {
            value.textContent = input;
          }
        }, 60);
      },
      release(): void {
        if (banner === undefined) {
          return;
        }
        banner.remove();
        banner = undefined;
        for (let value of MIGRATION_HOLD_BLOCKED_EVENTS) {
          host.removeEventListener(value, blockEvent, true);
        }
        for (let value of madeInert) {
          value.inert = false;
        }
        madeInert = [];
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "migrationHoldAllowsKey",
    () => migrationHoldAllowsKey,
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_HOLD_BLOCKED_EVENTS",
    () => MIGRATION_HOLD_BLOCKED_EVENTS,
    (value) => {
      MIGRATION_HOLD_BLOCKED_EVENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REOPEN_FOCUS_HOLD_MS",
    () => REOPEN_FOCUS_HOLD_MS,
    (value) => {
      REOPEN_FOCUS_HOLD_MS = value;
    },
  );
  bindRuntimeValue(runtime, "restoreReopenedFocus", () => restoreReopenedFocus);
  bindRuntimeValue(
    runtime,
    "createMigrationEditingHold",
    () => createMigrationEditingHold,
  );
  return () => {
    MIGRATION_HOLD_BLOCKED_EVENTS = [
      "keydown",
      "keyup",
      "keypress",
      "beforeinput",
      "paste",
      "cut",
      "drop",
      "dragstart",
      "pointerdown",
      "pointermove",
      "pointerup",
      "mousedown",
      "mouseup",
      "click",
      "touchstart",
    ];
    REOPEN_FOCUS_HOLD_MS = 5000;
  };
}
