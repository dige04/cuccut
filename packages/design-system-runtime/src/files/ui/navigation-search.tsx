/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type {
  NavigationSearchRuntime,
  NavigationPillActivity,
  NavigationPillClock,
  RankedSearchEntry,
  SearchEntry,
  SearchRankGroup,
  SearchResult,
  SearchSnapshot,
  SectionRow,
  EditorScale,
} from "../../contracts/application";
import type { ScalarToken, TokenFamily } from "../../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiNavigationSearch(
  runtime: RuntimeBindings & NavigationSearchRuntime,
): () => void {
  var reactSectionNavigation: typeof React;
  var FIND_BAR_ATTRIBUTE: string;
  var FIND_BAR_EDIT_SHORTCUTS: string[];
  var findBarKeyHandlers: WeakMap<Element, (event: KeyboardEvent) => boolean>;
  var findBarGuardedWindows: WeakSet<Window>;
  var NAV_SEARCH_MATCH_LIMIT: number;
  var searchEntryWords: (...words: (string | number | undefined)[]) => string[];
  var FILE_SEARCH_MATCH_LIMIT: number;
  function matchesLatinShortcut(
    event: Pick<KeyboardEvent, "key" | "code">,
    letter: string,
  ): boolean {
    if (event.key.toLowerCase() === letter) {
      return true;
    }
    return (
      event.code === "Key" + letter.toUpperCase() &&
      /^[\p{L}\p{M}]$/u.test(event.key) &&
      !/\p{Script=Latin}/u.test(event.key)
    );
  }
  function captureFindBarKey(event: KeyboardEvent): void {
    let target = event.target as
        | (EventTarget & Partial<Pick<Element, "closest" | "tagName">>)
        | null,
      value =
        typeof target?.closest === "function"
          ? target.closest("[" + FIND_BAR_ATTRIBUTE + "]")
          : null;
    if (value === null || target === null || event.key === "F6") {
      return;
    }
    let flag = false;
    try {
      flag =
        event.type === "keydown" &&
        findBarKeyHandlers.get(value)?.(event) === true;
    } catch {
      flag = false;
    }
    if (
      flag === false &&
      (target.tagName === "INPUT" ||
        (matchesLatinShortcut(event, "s") &&
          isPrimaryShortcutModifier(event, (0, runtime.isApplePlatform)())))
    ) {
      return;
    }
    event.stopImmediatePropagation();
    let value2 =
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !/^F\d+$/.test(event.key) &&
        event.key !== "Tab" &&
        event.key !== "Enter" &&
        event.key !== " ",
      value3 =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        FIND_BAR_EDIT_SHORTCUTS.some((input) =>
          matchesLatinShortcut(event, input),
        );
    if (!flag && event.type === "keydown" && (value2 || value3)) {
      event.preventDefault();
    }
  }
  function captureFindBarClipboard(event: ClipboardEvent): void {
    let target = event.target as
      | (EventTarget & Partial<Pick<Element, "closest" | "tagName">>)
      | null;
    if (
      target === null ||
      typeof target.closest !== "function" ||
      target.tagName === "INPUT"
    ) {
      return;
    }
    if (target.closest("[" + FIND_BAR_ATTRIBUTE + "]") === null) {
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
  }
  function installFindBarEventGuards(input: Window): void {
    if (findBarGuardedWindows.has(input)) {
      return;
    }
    findBarGuardedWindows.add(input);
    for (let value of ["keydown", "keyup", "keypress"] as const) {
      input.addEventListener(value, captureFindBarKey, true);
    }
    for (let value of ["cut", "copy", "paste"] as const) {
      input.addEventListener(value, captureFindBarClipboard, true);
    }
  }
  function isPrimaryShortcutModifier(
    event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey">,
    mac: boolean,
  ): boolean {
    return (
      !event.altKey &&
      (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey)
    );
  }
  function isFindShortcut(
    event: KeyboardEvent,
    mac: boolean = (0, runtime.isApplePlatform)(),
  ) {
    return (
      isPrimaryShortcutModifier(event, mac) &&
      !event.shiftKey &&
      matchesLatinShortcut(event, "f")
    );
  }
  function tokenSearchEntries(
    section: string,
    scale: EditorScale,
  ): SearchEntry[] {
    return scale.tokens.map((input) => ({
      section: section,
      label: input.name,
      words: searchEntryWords(input.value, input.usage),
      target: (0, runtime.commentTargetId)("token", input.name),
    }));
  }
  function buildSectionSearchIndex(
    snapshot: SearchSnapshot,
    sections: SectionRow[],
    sectionTitles: Readonly<Record<string, string>> = {},
  ) {
    let entriesBySection: Record<string, SearchEntry[]> = {
      readme: snapshot.docs.map((input) => ({
        section: "readme",
        label: input.title,
        words: searchEntryWords(input.path),
        target: (0, runtime.commentTargetId)("doc", input.path),
      })),
      colors: snapshot.colorGroups.flatMap((input) =>
        input.tokens.map((input2) => ({
          section: "colors",
          label: input2.name,
          words: searchEntryWords(
            ...Object.values(input2.value),
            ...Object.values(input2.alias ?? {}).map((input3) => input3.css),
            input2.usage,
          ),
          target: (0, runtime.commentTargetId)("token", input2.name),
        })),
      ),
      type: snapshot.typeGroups.flatMap((input) => [
        {
          section: "type",
          label: input.name,
          words: searchEntryWords(
            snapshot.familyNames[input.family],
            input.note,
          ),
          target: (0, runtime.commentTargetId)("tset", input.name),
        },
        ...input.styles.map((input2) => ({
          section: "type",
          label: input2.name,
          words: searchEntryWords(
            input2.fontSize,
            input2.fontWeight,
            snapshot.familyNames[input2.familyKey ?? input.family],
            input2.usage,
          ),
          target: (0, runtime.commentTargetId)("style", input2.name),
        })),
      ]),
      spacing: tokenSearchEntries("spacing", snapshot.spacing),
      corners: tokenSearchEntries("corners", snapshot.corners),
      shadows: snapshot.shadows.tokens.map((input) => ({
        section: "shadows",
        label: input.name,
        words: searchEntryWords(input.usage, ...Object.values(input.value)),
        target: (0, runtime.commentTargetId)("token", input.name),
      })),
      components: snapshot.components.map((input) => ({
        section: "components",
        label: input.name,
        words: [],
        target: (0, runtime.commentTargetId)("comp", input.name),
      })),
      assets: snapshot.assetGroups.flatMap((input) => [
        {
          section: "assets",
          label:
            sectionTitles["assets:" + input.name] ??
            (0, runtime.assetGroupDisplayName)(input.name),
          words: searchEntryWords(input.folder),
          target: (0, runtime.commentTargetId)("agroup", input.name),
        },
        ...input.assets.map((input2) => ({
          section: "assets",
          label: input2.name,
          words: searchEntryWords(input2.path),
          target: (0, runtime.commentTargetId)("asset", input2.path),
          asset: input2.path,
        })),
      ]),
    };
    for (let value of snapshot.extras) {
      entriesBySection[(0, runtime.extraTokenFamilySectionId)(value.key)] =
        tokenSearchEntries(
          (0, runtime.extraTokenFamilySectionId)(value.key),
          value.scale,
        );
    }
    return sections.flatMap((input) => [
      {
        section: input.id,
        label: input.label,
        words: [],
      },
      ...(entriesBySection[input.id] ?? []),
    ]);
  }
  function rankSectionSearchResults(
    index: SearchEntry[],
    query: string,
    limit: number = NAV_SEARCH_MATCH_LIMIT,
  ): SearchResult {
    let terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((input) => input !== ""),
      phrase = terms.join(" "),
      ranked: RankedSearchEntry[] = [];
    for (let value of terms.length === 0 ? [] : index) {
      if (
        !terms.every((input) =>
          (0, runtime.optionMatchesQuery)(input, value.label, ...value.words),
        )
      ) {
        continue;
      }
      let value2 = value.label.toLowerCase();
      ranked.push({
        entry: value,
        rank:
          value2 === phrase
            ? 0
            : value2.startsWith(phrase)
              ? 1
              : terms.every((input) =>
                    (0, runtime.optionMatchesQuery)(input, value.label),
                  )
                ? 2
                : 3,
      });
    }
    let targeted = ranked.filter((input) => input.entry.target !== undefined),
      shown = new Set(
        [...targeted]
          .sort((input, options) => input.rank - options.rank)
          .slice(0, limit),
      ),
      groups: SearchRankGroup[] = [];
    for (let value of ranked) {
      if (value.entry.target !== undefined && !shown.has(value)) {
        continue;
      }
      let value2 = groups[groups.length - 1];
      if (value2 === undefined || value2.section !== value.entry.section) {
        groups.push(
          (value2 = {
            section: value.entry.section,
            named: [],
            other: [],
          }),
        );
      }
      if (value.entry.target === undefined) {
        value2.head = value.rank;
      } else {
        (value.rank < 3 ? value2.named : value2.other).push(value);
      }
    }
    let row = 0,
      best = {
        rank: 4,
        row: 0,
      },
      considerBest = (input: number, options: number) => {
        if (input < best.rank) {
          best = {
            rank: input,
            row: options,
          };
        }
      };
    return {
      groups: groups.map((input) => {
        if (input.head !== undefined) {
          considerBest(input.head, row);
        }
        row++;
        let value = [...input.named, ...input.other].map((input2) => {
          considerBest(input2.rank, row++);
          return {
            entry: input2.entry,
            detail:
              input2.rank < 3
                ? undefined
                : input2.entry.words.find((input3) =>
                    terms.some((input4) =>
                      (0, runtime.optionMatchesQuery)(input4, input3),
                    ),
                  ),
          };
        });
        return {
          section: input.section,
          hits: value,
        };
      }),
      total: ranked.length,
      hidden: targeted.length - shown.size,
      bestRow: best.row,
    };
  }
  function searchSectionsAndFiles(
    index: SearchEntry[],
    files: SearchEntry[] | undefined,
    query: string,
  ): SearchResult {
    let result = rankSectionSearchResults(index, query);
    if (files === undefined || files.length === 0) {
      return result;
    }
    let fileResult = rankSectionSearchResults(
        files,
        query,
        FILE_SEARCH_MATCH_LIMIT,
      ),
      rowOffset = result.groups.reduce(
        (input, options) => input + 1 + options.hits.length,
        0,
      );
    return {
      groups: [...result.groups, ...fileResult.groups],
      total: result.total + fileResult.total,
      hidden: result.hidden + fileResult.hidden,
      bestRow:
        result.total > 0 || fileResult.total === 0
          ? result.bestRow
          : rowOffset + fileResult.bestRow,
    };
  }
  function createNavigationPillActivity(
    holdMs: number,
    onChange: (active: boolean) => void,
    timers: NavigationPillClock = runtime.markdownCommitClock,
  ): NavigationPillActivity {
    let active = false,
      held = false,
      holdUntil = 0,
      timer: ReturnType<NavigationPillClock["setTimeout"]> | undefined,
      setActive = (input: boolean) => {
        if (input === active) {
          return;
        }
        active = input;
        onChange(input);
      },
      check = () => {
        timer = undefined;
        if (held) {
          return;
        }
        let value = holdUntil - timers.now();
        if (value <= 0) {
          setActive(false);
        } else {
          timer = timers.setTimeout(check, value);
        }
      },
      extend = (input: number) => {
        holdUntil = Math.max(holdUntil, timers.now() + input);
        setActive(true);
        if (timer === undefined) {
          timer = timers.setTimeout(check, input);
        }
      };
    return {
      bump(input = holdMs) {
        extend(input);
      },
      hold(input: boolean) {
        if (input === held) {
          return;
        }
        held = input;
        if (input) {
          setActive(true);
        } else {
          extend(holdMs);
        }
      },
      dispose() {
        if (timer !== undefined) {
          timers.clearTimeout(timer);
        }
        timer = undefined;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "reactSectionNavigation",
    () => reactSectionNavigation,
    (value) => {
      reactSectionNavigation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIND_BAR_ATTRIBUTE",
    () => FIND_BAR_ATTRIBUTE,
    (value) => {
      FIND_BAR_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(runtime, "matchesLatinShortcut", () => matchesLatinShortcut);
  bindRuntimeValue(
    runtime,
    "FIND_BAR_EDIT_SHORTCUTS",
    () => FIND_BAR_EDIT_SHORTCUTS,
    (value) => {
      FIND_BAR_EDIT_SHORTCUTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findBarKeyHandlers",
    () => findBarKeyHandlers,
    (value) => {
      findBarKeyHandlers = value;
    },
  );
  bindRuntimeValue(runtime, "captureFindBarKey", () => captureFindBarKey);
  bindRuntimeValue(
    runtime,
    "captureFindBarClipboard",
    () => captureFindBarClipboard,
  );
  bindRuntimeValue(
    runtime,
    "findBarGuardedWindows",
    () => findBarGuardedWindows,
    (value) => {
      findBarGuardedWindows = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installFindBarEventGuards",
    () => installFindBarEventGuards,
  );
  bindRuntimeValue(
    runtime,
    "isPrimaryShortcutModifier",
    () => isPrimaryShortcutModifier,
  );
  bindRuntimeValue(runtime, "isFindShortcut", () => isFindShortcut);
  bindRuntimeValue(
    runtime,
    "NAV_SEARCH_MATCH_LIMIT",
    () => NAV_SEARCH_MATCH_LIMIT,
    (value) => {
      NAV_SEARCH_MATCH_LIMIT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "searchEntryWords",
    () => searchEntryWords,
    (value) => {
      searchEntryWords = value;
    },
  );
  bindRuntimeValue(runtime, "tokenSearchEntries", () => tokenSearchEntries);
  bindRuntimeValue(
    runtime,
    "buildSectionSearchIndex",
    () => buildSectionSearchIndex,
  );
  bindRuntimeValue(
    runtime,
    "rankSectionSearchResults",
    () => rankSectionSearchResults,
  );
  bindRuntimeValue(
    runtime,
    "FILE_SEARCH_MATCH_LIMIT",
    () => FILE_SEARCH_MATCH_LIMIT,
    (value) => {
      FILE_SEARCH_MATCH_LIMIT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "searchSectionsAndFiles",
    () => searchSectionsAndFiles,
  );
  bindRuntimeValue(
    runtime,
    "createNavigationPillActivity",
    () => createNavigationPillActivity,
  );
  return () => {
    reactSectionNavigation = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    FIND_BAR_ATTRIBUTE = "data-mc-find";
    FIND_BAR_EDIT_SHORTCUTS = ["x", "c", "v", "z", "y", "a", "d"];
    findBarKeyHandlers = new WeakMap();
    findBarGuardedWindows = new WeakSet();
    if (typeof window !== "undefined") {
      installFindBarEventGuards(window);
    }
    NAV_SEARCH_MATCH_LIMIT = 100;
    searchEntryWords = (...input) =>
      input
        .filter((input2) => input2 !== undefined && input2 !== "")
        .map(String);
    FILE_SEARCH_MATCH_LIMIT = 20;
  };
}
