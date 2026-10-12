import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorPreviewPool(runtime: RuntimeBindings): () => void {
  var PREVIEW_POOL_IDLE_TTL_MS: number;
  var PreviewFramePool: new (
    maxLive?: number,
    now?: () => number,
  ) => Editor.PreviewFramePool;
  var sharedPreviewFramePool: Editor.PreviewFramePool | null;
  function getPreviewFramePool(): Editor.PreviewFramePool {
    if (sharedPreviewFramePool === null) {
      sharedPreviewFramePool = new PreviewFramePool();
    }
    return sharedPreviewFramePool;
  }
  bindRuntimeValue(
    runtime,
    "PREVIEW_POOL_IDLE_TTL_MS",
    () => PREVIEW_POOL_IDLE_TTL_MS,
    (value) => {
      PREVIEW_POOL_IDLE_TTL_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewFramePool",
    () => PreviewFramePool,
    (value) => {
      PreviewFramePool = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sharedPreviewFramePool",
    () => sharedPreviewFramePool,
    (value) => {
      sharedPreviewFramePool = value;
    },
  );
  bindRuntimeValue(runtime, "getPreviewFramePool", () => getPreviewFramePool);
  return () => {
    PREVIEW_POOL_IDLE_TTL_MS = 6000;
    PreviewFramePool = class PreviewFramePool {
      maxLive: number;
      now: () => number;
      entries = new Map<string, Editor.PreviewPoolEntry>();
      queue: string[] = [];
      listeners = new Set<() => void>();
      clock = 0;
      constructor(
        input: number = 8,
        options: () => number = (): number => Date.now(),
      ) {
        this.maxLive = input;
        this.now = options;
      }
      phase(input: string): Editor.PreviewPoolPhase {
        return this.entries.get(input)?.phase ?? "idle";
      }
      subscribe(input: () => void) {
        this.listeners.add(input);
        return () => this.listeners.delete(input);
      }
      snapshot(): Editor.PreviewPoolSnapshot {
        let items: string[] = [],
          value: string | null = null;
        for (let [value2, value3] of this.entries) {
          if (value3.phase === "live") {
            items.push(value2);
          }
          if (value3.booting) {
            value = value2;
          }
        }
        return {
          live: items,
          queued: [...this.queue],
          booting: value,
        };
      }
      visible(input: string, options: boolean): void {
        let value = this.entry(input);
        if (
          value.visible === options &&
          (options ? value.phase !== "idle" : true)
        ) {
          if (options) {
            value.lastVisible = ++this.clock;
          }
          return;
        }
        value.visible = options;
        if (options) {
          value.lastVisible = ++this.clock;
          if (value.phase === "idle") {
            value.phase = "queued";
            this.queue.push(input);
          }
        } else if (value.phase === "queued") {
          value.phase = "idle";
          let value2 = this.queue.indexOf(input);
          if (value2 >= 0) {
            this.queue.splice(value2, 1);
          }
        }
        this.pump();
      }
      booted(input: string): void {
        let entry = this.entries.get(input);
        if (entry === undefined || !entry.booting) {
          return;
        }
        entry.booting = false;
        this.pump();
      }
      remove(input: string): void {
        if (this.entries.get(input) === undefined) {
          return;
        }
        this.entries.delete(input);
        let value = this.queue.indexOf(input);
        if (value >= 0) {
          this.queue.splice(value, 1);
        }
        this.pump();
      }
      tick(): void {
        let value = this.now(),
          flag: boolean = false;
        for (let value2 of this.entries.values()) {
          if (value2.booting && value - value2.bootStartedAt >= 6000) {
            value2.booting = false;
            flag = true;
          }
        }
        if (flag) {
          this.pump();
        }
      }
      entry(input: string): Editor.PreviewPoolEntry {
        let entry = this.entries.get(input);
        if (entry === undefined) {
          entry = {
            phase: "idle",
            visible: false,
            lastVisible: 0,
            booting: false,
            bootStartedAt: 0,
          };
          this.entries.set(input, entry);
        }
        return entry;
      }
      liveCount(): number {
        let index: number = 0;
        for (let value of this.entries.values()) {
          if (value.phase === "live") {
            index++;
          }
        }
        return index;
      }
      anyBooting(): boolean {
        for (let value of this.entries.values()) {
          if (value.booting) {
            return true;
          }
        }
        return false;
      }
      pump(): void {
        for (;;) {
          while (
            this.queue.length > 0 &&
            this.entries.get(this.queue[0])?.phase !== "queued"
          ) {
            this.queue.shift();
          }
          if (this.queue.length === 0 || this.anyBooting()) {
            break;
          }
          if (this.liveCount() >= this.maxLive && !this.evictOne()) {
            break;
          }
          let value = this.queue.shift()!,
            entry = this.entries.get(value)!;
          entry.phase = "live";
          entry.booting = true;
          entry.bootStartedAt = this.now();
        }
        for (let value of this.listeners) {
          value();
        }
      }
      evictOne(): boolean {
        let value: string | null = null,
          value2 = 1 / 0;
        for (let [value3, value4] of this.entries) {
          if (
            value4.phase === "live" &&
            !value4.visible &&
            !value4.booting &&
            value4.lastVisible < value2
          ) {
            value2 = value4.lastVisible;
            value = value3;
          }
        }
        if (value === null) {
          return false;
        }
        let entry = this.entries.get(value)!;
        entry.phase = "idle";
        entry.booting = false;
        return true;
      }
    };
    sharedPreviewFramePool = null;
  };
}
