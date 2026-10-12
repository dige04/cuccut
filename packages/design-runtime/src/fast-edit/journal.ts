/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditJournal(runtime: RuntimeBindings): () => void {
  var MAX_JOURNAL_CHANGE_LINES: Dynamic;
  var MAX_JOURNAL_TEXT_CHARS: Dynamic;
  var MAX_JOURNAL_ATTRIBUTE_CHARS: Dynamic;
  var MAX_JOURNAL_ELEMENT_LABEL_CHARS: Dynamic;
  var MAX_JOURNAL_DIFF_CHARS: Dynamic;
  var MAX_JOURNAL_LINE_CHARS: Dynamic;
  var NEW_ARTBOARD_JOURNAL_LABEL: Dynamic;
  var REMOVED_ARTBOARD_JOURNAL_LABEL: Dynamic;
  var UNTRUSTED_TEXT_PATTERN: Dynamic;
  var sanitizeJournalText: Dynamic;
  var normalizeJournalWhitespace: Dynamic;
  var normalizeJournalText: Dynamic;
  var truncateJournalText: Dynamic;
  var journalUtf8Size: Dynamic;
  var immediateElementText: Dynamic;
  var normalizeJournalTagName: Dynamic;
  var describeJournalElement: Dynamic;
  var MAX_DECORATIVE_ELEMENT_COUNT: Dynamic;
  var NON_DECORATIVE_ELEMENT_SELECTOR: Dynamic;
  var hasBackgroundImage: Dynamic;
  var relativeElementIndexPath: Dynamic;
  var hashElementStructure: Dynamic;
  var hashHtmlStructure: Dynamic;
  var equalElementAttributes: Dynamic;
  var journalElementAttributes: Dynamic;
  var MAX_REORDER_TRACKING_ITEMS: Dynamic;
  var longestIncreasingSubsequenceLength: Dynamic;
  var allJournalArtboards: Dynamic;
  var formatJournalTime: Dynamic;
  var createFastEditJournalState: Dynamic;
  var MAX_FAST_EDIT_JOURNAL_ENTRIES: Dynamic;
  var HISTORY_TURN_COMPLETION_MESSAGES: Dynamic;
  var FAST_EDIT_TURN_STATUS_LABELS: Dynamic;
  function parseJournalRoot(html?: Dynamic): Dynamic {
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild;
  }
  function createElementTextSummarizer(root?: Dynamic): Dynamic {
    let text: Dynamic = root.textContent ?? "";
    if (/\p{Cf}/u.test(text) || UNTRUSTED_TEXT_PATTERN.test(text)) {
      let entries: Dynamic = new Map();
      return (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value: Dynamic = input.textContent ?? "",
          entry: Dynamic = entries.get(value);
        entry === undefined &&
          entries.set(value, (entry = normalizeJournalText(value)));
        return truncateJournalText(entry, options);
      };
    }
    return (input?: Dynamic, options?: Dynamic): Dynamic => {
      let text2: Dynamic = "",
        callback: Dynamic = (input2?: Dynamic): Dynamic => {
          for (let value of Array.from(input2.childNodes) as Dynamic) {
            if (value.nodeType === 1 && !callback(value)) return false;
            if (value.nodeType !== 3 && value.nodeType !== 4) continue;
            let value2: Dynamic = value.textContent ?? "";
            for (let index: Dynamic = 0; index < value2.length; index += 1024)
              if (
                ((text2 = normalizeJournalWhitespace(
                  text2 + value2.slice(index, index + 1024),
                ).trimStart()),
                text2.trimEnd().length > options)
              )
                return false;
          }
          return true;
        };
      callback(input);
      return truncateJournalText(text2.trimEnd(), options);
    };
  }
  function isDecorativeElement(element?: Dynamic): Dynamic {
    let descendantCount: Dynamic = element.querySelectorAll("*").length;
    return descendantCount === 0 ||
      element.parentElement?.parentElement == null ||
      /^sc-(?!raw-)/.test(element.localName) ||
      element.querySelector(NON_DECORATIVE_ELEMENT_SELECTOR) !== null ||
      hasBackgroundImage(element) ||
      Array.from(element.querySelectorAll("[style]")).some(hasBackgroundImage)
      ? false
      : element.localName === "svg" ||
          ((element.textContent ?? "").trim() === "" &&
            descendantCount <= MAX_DECORATIVE_ELEMENT_COUNT);
  }
  function parseJournalStyle(style?: Dynamic): Dynamic {
    let properties: Dynamic = new Map();
    for (let value of (0, runtime.splitCssDeclarations_2)(
      style ?? "",
    ) as Dynamic) {
      let value2: Dynamic = value.indexOf(":");
      if (value2 > 0) {
        let value3: Dynamic = value.slice(0, value2).trim().toLowerCase();
        properties.delete(value3);
        properties.set(value3, normalizeJournalText(value.slice(value2 + 1)));
      }
    }
    return properties;
  }
  function describeStyleChanges(before?: Dynamic, after?: Dynamic): Dynamic {
    let changes: Dynamic = [];
    for (let [value, value2] of after as Dynamic) {
      let entry: Dynamic = before.get(value);
      entry !== value2 &&
        changes.push(
          value +
            ": " +
            truncateJournalText(
              (0, runtime.truncateLargeDataUris)(value2),
              100,
            ) +
            " (was " +
            (entry === undefined
              ? "not set"
              : truncateJournalText(
                  (0, runtime.truncateLargeDataUris)(entry),
                  40,
                )) +
            ")",
        );
    }
    for (let [value, value2] of before as Dynamic)
      after.has(value) ||
        changes.push(
          value +
            ": removed (was " +
            truncateJournalText(
              (0, runtime.truncateLargeDataUris)(value2),
              40,
            ) +
            ")",
        );
    return changes;
  }
  function matchJournalElements(
    before?: Dynamic,
    after?: Dynamic,
    elementKey?: Dynamic,
  ): Dynamic {
    let describe: Dynamic = (input?: Dynamic): Dynamic =>
        input.localName + "|" + elementKey(input),
      beforeKeys: Dynamic = before.map(describe),
      afterKeys: Dynamic = after.map(describe),
      beforeCount: Dynamic = beforeKeys.length,
      afterCount: Dynamic = afterKeys.length,
      matches: Dynamic = [];
    if (beforeCount * afterCount <= 25e4) {
      let value: Dynamic = Array.from(
        {
          length: beforeCount + 1,
        },
        (): Dynamic => new Array(afterCount + 1).fill(0),
      );
      for (let value2: Dynamic = beforeCount - 1; value2 >= 0; value2--)
        for (let value3: Dynamic = afterCount - 1; value3 >= 0; value3--)
          value[value2][value3] =
            beforeKeys[value2] === afterKeys[value3]
              ? value[value2 + 1][value3 + 1] + 1
              : Math.max(value[value2 + 1][value3], value[value2][value3 + 1]);
      for (
        let index3: Dynamic = 0, index4: Dynamic = 0;
        index3 < beforeCount && index4 < afterCount;

      )
        beforeKeys[index3] === afterKeys[index4]
          ? (matches.push([index3, index4]), index3++, index4++)
          : value[index3 + 1][index4] >= value[index3][index4 + 1]
            ? index3++
            : index4++;
    }
    let items: Dynamic = [],
      callback: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value?: Dynamic,
      ): Dynamic => {
        let value2: Dynamic = context;
        for (let value3: Dynamic = input; value3 < options; value3++)
          for (let value4: Dynamic = value2; value4 < value; value4++)
            if (before[value3].localName === after[value4].localName) {
              items.push([value3, value4]);
              value2 = value4 + 1;
              break;
            }
      },
      index: Dynamic = 0,
      index2: Dynamic = 0;
    for (let [value, value2] of matches as Dynamic) {
      callback(index, value, index2, value2);
      items.push([value, value2]);
      index = value + 1;
      index2 = value2 + 1;
    }
    callback(index, beforeCount, index2, afterCount);
    return items;
  }
  function detectMovedJournalElements(
    indices?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let subsequenceLength: Dynamic =
        longestIncreasingSubsequenceLength(indices),
      moved: Dynamic = new Set();
    if (
      subsequenceLength === indices.length ||
      indices.length > MAX_REORDER_TRACKING_ITEMS
    )
      return {
        moved: moved,
      };
    let items: Dynamic = [...indices];
    for (let value3 of [...indices].sort(
      (input?: Dynamic, options2?: Dynamic): Dynamic =>
        options(input) - options(options2),
    ) as Dynamic) {
      if (items.length === subsequenceLength) break;
      let value4: Dynamic = items.filter(
        (input?: Dynamic): Dynamic => input !== value3,
      );
      longestIncreasingSubsequenceLength(value4) === subsequenceLength &&
        ((items = value4), moved.add(value3));
    }
    let [value]: Dynamic = moved,
      value2: Dynamic =
        moved.size !== 1
          ? undefined
          : indices.find(
              (input?: Dynamic): Dynamic =>
                input !== value &&
                options(input) === options(value) &&
                longestIncreasingSubsequenceLength(
                  indices.filter(
                    (input2?: Dynamic): Dynamic => input2 !== input,
                  ),
                ) === subsequenceLength,
            );
    return {
      moved: moved,
      ...(value2 !== undefined
        ? {
            other: value2,
          }
        : {}),
    };
  }
  function describeArtboardHtmlChanges(
    beforeHtml?: Dynamic,
    afterHtml?: Dynamic,
    options?: Dynamic,
    limits?: Dynamic,
  ): Dynamic {
    if (beforeHtml === afterHtml) return [];
    let beforeRoot: Dynamic = parseJournalRoot(beforeHtml),
      afterRoot: Dynamic = parseJournalRoot(afterHtml);
    if (beforeRoot === null || afterRoot === null)
      return ["the artboard changed"];
    let value: Dynamic =
        options !== undefined && /^[a-z]{1,8}$/.test(options)
          ? new RegExp("^" + options + "\\d{1,6}$")
          : null,
      callback: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value9: Dynamic = parseJournalRoot(options2),
          value10: Dynamic = Array.from(input.querySelectorAll("*")),
          value11: Dynamic =
            value9 === null ? [] : Array.from(value9.querySelectorAll("*"));
        return value9 === null ||
          value10.length !== value11.length ||
          value10.some(
            (input2?: Dynamic, options3?: Dynamic): Dynamic =>
              input2.localName !== value11[options3].localName,
          ) ||
          normalizeJournalWhitespace(input.textContent ?? "") !==
            normalizeJournalWhitespace(value9.textContent ?? "")
          ? null
          : new Map(
              value10.flatMap(
                (input2?: Dynamic, options3?: Dynamic): Dynamic => {
                  let value12: Dynamic =
                    value11[options3].getAttribute("id") ?? "";
                  return context.test(value12) ? [[input2, value12]] : [];
                },
              ),
            );
      },
      value2: Dynamic =
        limits !== undefined && /^[a-z]{1,8}$/.test(limits.prefix)
          ? new RegExp("^" + limits.prefix + "\\d{1,6}$")
          : null,
      value3: Dynamic =
        value2 === null ? null : callback(beforeRoot, limits.before, value2),
      value4: Dynamic =
        value2 === null ? null : callback(afterRoot, limits.after, value2),
      entries: Dynamic = new Map(
        (limits?.acted ?? [])
          .map(
            (input?: Dynamic, options2?: Dynamic): Dynamic => [input, options2],
          )
          .reverse(),
      ),
      value5: Dynamic = value3 !== null && value4 !== null,
      entries2: Dynamic = new Map(
        value5
          ? Array.from(
              value3,
              ([input, input2]: Dynamic): Dynamic => [input2, input],
            )
          : [],
      ),
      entries3: Dynamic = new Map(
        value5
          ? Array.from(
              value4,
              ([input, input2]: Dynamic): Dynamic => [input2, input],
            )
          : [],
      ),
      items: Dynamic = [],
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        items.push(
          items.length < MAX_JOURNAL_CHANGE_LINES
            ? truncateJournalText(input(), MAX_JOURNAL_ATTRIBUTE_CHARS)
            : "",
        );
      },
      entries4: Dynamic = new Map(),
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let entry: Dynamic = entries4.get(input);
        entry === undefined &&
          entries4.set(input, (entry = immediateElementText(input)));
        return entry;
      },
      value6: Dynamic = createElementTextSummarizer(beforeRoot),
      value7: Dynamic = createElementTextSummarizer(afterRoot),
      callback4: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic =>
        describeJournalElement(
          options2.localName,
          input(options2, MAX_JOURNAL_ELEMENT_LABEL_CHARS),
          context,
        ) +
        (input === value7 &&
        value7(options2, 1) === "" &&
        options2 !== afterRoot
          ? " @" + relativeElementIndexPath(options2, afterRoot)
          : ""),
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        let length: Dynamic = input.querySelectorAll("*").length;
        return isDecorativeElement(input)
          ? "drawing @" +
              relativeElementIndexPath(input, afterRoot) +
              " (" +
              String(length) +
              (length === 1 ? " part)" : " parts)")
          : callback4(value7, input, "");
      },
      callback6: Dynamic = (
        element?: Dynamic,
        element2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value9: Dynamic = callback3(element),
          value10: Dynamic = callback3(element2),
          value11: Dynamic = equalElementAttributes(element, element2)
            ? []
            : [
                ...describeStyleChanges(
                  parseJournalStyle(element.getAttribute("style")),
                  parseJournalStyle(element2.getAttribute("style")),
                ),
                ...describeStyleChanges(
                  journalElementAttributes(element, value),
                  journalElementAttributes(element2, value),
                ),
              ].map(
                (input?: Dynamic): Dynamic =>
                  truncateJournalText(input, MAX_JOURNAL_ATTRIBUTE_CHARS),
              );
        value9 !== value10 &&
          value11.push(
            truncateJournalText(
              "text: " +
                (value10 === ""
                  ? "removed"
                  : '"' +
                    truncateJournalText(
                      value10,
                      MAX_JOURNAL_ELEMENT_LABEL_CHARS,
                    ) +
                    '"') +
                ' (was "' +
                truncateJournalText(value9, MAX_JOURNAL_DIFF_CHARS) +
                '")',
              MAX_JOURNAL_LINE_CHARS,
            ),
          );
        value11.length > 0 &&
          (callback2(
            (): Dynamic =>
              context ? "the artboard:" : callback4(value7, element2) + ":",
          ),
          items.push(
            ...value11.map((input?: Dynamic): Dynamic => "  " + input),
          ));
        let value12: Dynamic = Array.from(element.children),
          value13: Dynamic = Array.from(element2.children);
        if (value12.length === 0 && value13.length === 0) return;
        let value14: Dynamic =
            value5 &&
            value12.every((input?: Dynamic): Dynamic => value3.has(input)) &&
            value13.every((input?: Dynamic): Dynamic => value4.has(input)),
          entries5: Dynamic = new Map(
            value14
              ? value13.map(
                  (input?: Dynamic, options2?: Dynamic): Dynamic => [
                    value4.get(input),
                    options2,
                  ],
                )
              : [],
          ),
          value15: Dynamic = value14
            ? value12.flatMap(
                (input?: Dynamic, options2?: Dynamic): Dynamic => {
                  let entry: Dynamic = entries5.get(value3.get(input));
                  return entry === undefined ? [] : [[options2, entry]];
                },
              )
            : matchJournalElements(value12, value13, callback3).filter(
                ([input, input2]: Dynamic): Dynamic => {
                  let value18: Dynamic = value3?.get(value12[input]),
                    value19: Dynamic = value4?.get(value13[input2]);
                  return (
                    value18 === undefined ||
                    value19 === undefined ||
                    value18 === value19
                  );
                },
              );
        if (!value14) {
          let values2: Dynamic = new Set(
              value15.map((input?: Dynamic): Dynamic => input[0]),
            ),
            values3: Dynamic = new Set(
              value15.map((input?: Dynamic): Dynamic => input[1]),
            ),
            entries7: Dynamic = new Map();
          for (
            let value18: Dynamic = value12.length - 1;
            value18 >= 0;
            value18--
          )
            if (!values2.has(value18)) {
              let outerHTML: Dynamic = value12[value18].outerHTML,
                entry: Dynamic = entries7.get(outerHTML);
              entry === undefined
                ? entries7.set(outerHTML, [value18])
                : entry.push(value18);
            }
          entries7.size > 0 &&
            value13.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
              let value18: Dynamic = values3.has(options2)
                ? undefined
                : entries7.get(input.outerHTML)?.pop();
              value18 !== undefined && value15.push([value18, options2]);
            });
          value15.sort(
            (input?: Dynamic, options2?: Dynamic): Dynamic =>
              input[0] - options2[0],
          );
        }
        let callback7: Dynamic = (input?: Dynamic): Dynamic =>
            (value14 ? entries.get(value4.get(value13[input])) : undefined) ??
            1 / 0,
          { moved: value16, other: value17 }: Dynamic =
            detectMovedJournalElements(
              value15.map((input?: Dynamic): Dynamic => input[1]),
              callback7,
            ),
          values: Dynamic = new Set(
            value15.map((input?: Dynamic): Dynamic => input[0]),
          ),
          entries6: Dynamic = new Map(
            value15.map((input?: Dynamic): Dynamic => [input[1], input[0]]),
          ),
          callback8: Dynamic = (input?: Dynamic): Dynamic => {
            let value18: Dynamic = value13[input - 1],
              value19: Dynamic = value13[input + 1];
            return value18 !== undefined
              ? " after " + callback4(value7, value18)
              : value19 !== undefined
                ? " before " + callback4(value7, value19)
                : context
                  ? " in the artboard"
                  : " in " + callback4(value7, element2);
          };
        value12.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
          !values.has(options2) &&
            !(value5 && entries3.has(value3.get(input) ?? "")) &&
            callback2((): Dynamic => "removed " + callback4(value6, input));
        });
        value13.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
          let entry: Dynamic = entries6.get(options2),
            value18: Dynamic =
              entry !== undefined
                ? value12[entry]
                : value5
                  ? entries2.get(value4.get(input) ?? "")
                  : undefined;
          if (value18 === undefined)
            return callback2(
              (): Dynamic => "new " + callback5(input) + callback8(options2),
            );
          (entry === undefined || value16.has(options2)) &&
            callback2(
              (): Dynamic =>
                entry !== undefined && value17 !== undefined
                  ? callback4(value7, input) +
                    " and " +
                    callback4(value7, value13[value17]) +
                    " changed places"
                  : "moved " + callback4(value7, input) + callback8(options2),
            );
          callback6(value18, input, false);
        });
      };
    callback6(beforeRoot, afterRoot, true);
    if (items.length === 0) return ["the artboard changed"];
    let value8: Dynamic = items.slice(0, MAX_JOURNAL_CHANGE_LINES);
    return items.length > MAX_JOURNAL_CHANGE_LINES
      ? [
          ...value8,
          "and " + String(items.length - MAX_JOURNAL_CHANGE_LINES) + " more",
        ]
      : value8;
  }
  function classifyJournalChangeSource(
    before?: Dynamic,
    expected?: Dynamic,
    after?: Dynamic,
    other?: Dynamic,
  ): Dynamic {
    return before === undefined || before === after
      ? "nothing"
      : expected !== undefined && expected === after
        ? "undone"
        : other
          ? "other"
          : "hand";
  }
  function normalizeJournalChanges(changes?: Dynamic): Dynamic {
    let result: Dynamic = [],
      remainingChars: Dynamic = 1e3;
    for (let value of changes
      .slice(0, MAX_JOURNAL_CHANGE_LINES + 1)
      .map(
        (input?: Dynamic): Dynamic =>
          (input.startsWith("  ") ? "  " : "") +
          truncateJournalText(
            normalizeJournalText(input),
            MAX_JOURNAL_LINE_CHARS,
          ),
      )
      .filter((input?: Dynamic): Dynamic => input.trim() !== "") as Dynamic) {
      if ((remainingChars -= journalUtf8Size(value)) < 0) {
        result.push("and more");
        break;
      }
      result.push(value);
    }
    return result;
  }
  function appendTurnJournalEntry(
    journal?: Dynamic,
    entry?: Dynamic,
    now: Dynamic = new Date(),
  ): Dynamic {
    let otherBoards: Dynamic =
      entry.end !== "done"
        ? []
        : (entry.also ?? [])
            .map(
              (input?: Dynamic): Dynamic => ({
                ...input,
                changes: normalizeJournalChanges(input.changes),
              }),
            )
            .filter((input?: Dynamic): Dynamic => input.changes.length > 0);
    journal.push({
      ...(entry.shape !== undefined
        ? {
            shape: entry.shape,
          }
        : {}),
      ...(otherBoards.length > 0
        ? {
            also: otherBoards,
          }
        : {}),
      kind: "comment",
      at: formatJournalTime(now),
      file: entry.file,
      changes:
        entry.end === "done" ? normalizeJournalChanges(entry.changes) : [],
    });
  }
  function appendExternalJournalEntry(
    journal?: Dynamic,
    entry?: Dynamic,
    now: Dynamic = new Date(),
  ): Dynamic {
    let otherBoards: Dynamic = (entry.also ?? []).map(
      (input?: Dynamic): Dynamic => ({
        ...input,
        changes:
          entry.who === "undone" ? [] : normalizeJournalChanges(input.changes),
      }),
    );
    journal.push({
      ...(entry.shape !== undefined
        ? {
            shape: entry.shape,
          }
        : {}),
      ...(otherBoards.length > 0
        ? {
            also: otherBoards,
          }
        : {}),
      ...(entry.opened === true
        ? {
            opened: true,
          }
        : {}),
      kind: "between",
      at: formatJournalTime(now),
      file: entry.file,
      who: entry.who,
      changes:
        entry.who === "undone" ? [] : normalizeJournalChanges(entry.changes),
    });
  }
  function summarizeArtboardText(
    html?: Dynamic,
    maxWords: Dynamic = 40,
  ): Dynamic {
    let walk: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value2 of Array.from(input.childNodes) as Dynamic) {
          let value3: Dynamic =
            value2.nodeType === 3
              ? normalizeJournalText(value2.textContent ?? "")
              : value2.nodeType === 1 &&
                  !/^(?:style|script)$/.test(value2.localName)
                ? walk(value2)
                : "";
          if (value3 !== "") return value3;
        }
        return "";
      },
      value: Dynamic = parseJournalRoot(html);
    return value === null ? "" : truncateJournalText(walk(value), maxWords);
  }
  function collectJournalChanges(
    session?: Dynamic,
    boards?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let changes: Dynamic = new Map();
    if (options !== undefined) {
      let values: Dynamic = new Set(
          session.journal.flatMap(
            (source?: Dynamic): Dynamic =>
              source.kind === "between" && source.who === "undone"
                ? allJournalArtboards(source).map(
                    (input?: Dynamic): Dynamic => input.file,
                  )
                : [],
          ),
        ),
        value: Dynamic = session.journal
          .filter((source?: Dynamic): Dynamic => source.kind === "comment")
          .flatMap(allJournalArtboards)
          .filter(
            (input?: Dynamic): Dynamic =>
              input.changes.length === 1 &&
              !values.has(input.file) &&
              (input.changes[0] === REMOVED_ARTBOARD_JOURNAL_LABEL
                ? options(input.file)
                : input.changes[0] === NEW_ARTBOARD_JOURNAL_LABEL &&
                  !options(input.file)),
          );
      value.length > 0 &&
        changes.set("undonefalse", {
          who: "undone",
          opened: false,
          parts: value.map(
            (input?: Dynamic): Dynamic => ({
              file: input.file,
              changes: [],
            }),
          ),
        });
    }
    for (let { file: value, now: value2, other: value3 } of boards as Dynamic) {
      let entry: Dynamic = session.seen.get(value),
        value4: Dynamic = classifyJournalChangeSource(
          entry,
          session.beforeLast.get(value),
          value2,
          value3,
        );
      if (value4 !== "nothing") {
        let value5: Dynamic = value4 !== "undone" && session.opened.has(value),
          value6: Dynamic = value4 + String(value5);
        changes.has(value6) ||
          changes.set(value6, {
            who: value4,
            opened: value5,
            parts: [],
          });
        changes.get(value6).parts.push({
          file: value,
          changes:
            value4 === "undone"
              ? []
              : describeArtboardHtmlChanges(entry, value2),
          shape: hashHtmlStructure(value2),
        });
        session.beforeLast.delete(value);
      }
      session.opened.delete(value);
      session.seen.set(value, value2);
    }
    for (let value of changes.values() as Dynamic)
      appendExternalJournalEntry(
        session.journal,
        {
          ...value.parts[0],
          who: value.who,
          opened: value.opened,
          also: value.parts.slice(1),
        },
        session.clock(),
      );
  }
  function finishFastEditJournalTurn(
    session?: Dynamic,
    status?: Dynamic,
    threadId?: Dynamic,
  ): Dynamic {
    let turn: Dynamic = session.turn;
    session.turn = null;
    turn?.open === true &&
      (0, runtime.closeHistoryTurn)(
        session.history,
        status === null ? null : HISTORY_TURN_COMPLETION_MESSAGES[status],
      );
    if (turn === null || status === null) return;
    threadId !== undefined &&
      (session.threads.delete(threadId),
      session.threads.add(threadId),
      session.threads.size > MAX_FAST_EDIT_JOURNAL_ENTRIES &&
        session.threads.delete(session.threads.values().next().value));
    let value: Dynamic =
        status === "done" || status === "left" || status === "left_changed",
      [value2, ...value3]: Dynamic = [turn, ...(turn.also ?? [])].map(
        (input?: Dynamic): Dynamic => {
          let value4: Dynamic =
            value && input.before !== undefined && input.after !== undefined;
          value4
            ? (session.beforeLast.set(input.file, input.before),
              session.seen.set(input.file, input.after))
            : value && input.how === "new" && input.after !== undefined
              ? session.seen.set(input.file, input.after)
              : (value || status === "unconfirmed") &&
                (session.seen.delete(input.file),
                session.beforeLast.delete(input.file));
          return {
            file: input.file,
            changes:
              input.how !== undefined
                ? [
                    input.how === "new"
                      ? NEW_ARTBOARD_JOURNAL_LABEL
                      : REMOVED_ARTBOARD_JOURNAL_LABEL,
                  ]
                : value4
                  ? describeArtboardHtmlChanges(
                      input.before,
                      input.after,
                      undefined,
                      input.ids,
                    )
                  : [],
            ...(input.after !== undefined
              ? {
                  shape: hashHtmlStructure(input.after),
                }
              : {}),
          };
        },
      );
    session.journal.length = 0;
    appendTurnJournalEntry(
      session.journal,
      {
        ...value2,
        end: status,
        also: value3,
      },
      session.clock(),
    );
  }
  function recordFastEditReadResult(
    session?: Dynamic,
    readResult?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let root: Dynamic = parseJournalRoot(readResult.html),
      handlePattern: Dynamic = /^[a-z]{1,8}$/.test(readResult.prefix)
        ? new RegExp("^" + readResult.prefix + "\\d{1,6}$")
        : null,
      value: Dynamic = null,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (root === null || handlePattern === null) return "";
        if (value === null) {
          value = new Map();
          let value5: Dynamic = createElementTextSummarizer(root);
          for (let value6 of Array.from(
            root.querySelectorAll("*"),
          ) as Dynamic) {
            if (value5(value6, 1) === "") continue;
            let value7: Dynamic = describeJournalElement(
              value6.localName,
              value5(value6, MAX_JOURNAL_ELEMENT_LABEL_CHARS),
            );
            value.set(
              value7,
              value.has(value7) ? "" : (value6.getAttribute("id") ?? ""),
            );
          }
        }
        let value4: Dynamic = value.get(input) ?? "";
        return handlePattern.test(value4) ? "#" + value4 : "";
      },
      value2: Dynamic = null,
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let value4: Dynamic = options(input);
        return (
          "#" +
          (runtime.FAST_EDIT_ARTBOARD_ID_PATTERN.test(value4)
            ? value4
            : "artboard")
        );
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let value4: Dynamic = input.map(callback2),
          value5: Dynamic = runtime.MAX_LISTED_HISTORY_TURN_IDS;
        for (
          ;
          value5 > 1 &&
          (0, runtime.summarizeTurnIds)(value4, value5).length >
            MAX_JOURNAL_ATTRIBUTE_CHARS;

        )
          value5 -= 1;
        return (0, runtime.summarizeTurnIds)(value4, value5);
      },
      values: Dynamic = new Set(),
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        input.changes.length === 1 &&
        (input.changes[0] === NEW_ARTBOARD_JOURNAL_LABEL ||
          input.changes[0] === REMOVED_ARTBOARD_JOURNAL_LABEL),
      values2: Dynamic = new Set();
    session.forEach((source?: Dynamic, options2?: Dynamic): Dynamic => {
      if (!(source.kind !== "between" || source.who !== "undone"))
        for (let value4 of allJournalArtboards(source) as Dynamic) {
          let value5: Dynamic = session
            .slice(0, options2)
            .reverse()
            .find(
              (source2?: Dynamic): Dynamic =>
                allJournalArtboards(source2).some(
                  (input?: Dynamic): Dynamic =>
                    input.file === value4.file &&
                    (source2.kind === "between" || input.changes.length > 0),
                ),
            );
          value5?.kind === "comment" &&
            (values.add(value5),
            allJournalArtboards(value5).some(
              (input?: Dynamic): Dynamic =>
                input.file === value4.file && callback4(input),
            ) && values2.add(value4.file));
        }
    });
    let value3: Dynamic = null;
    return {
      text: session
        .map((source?: Dynamic): Dynamic => {
          if (source.kind === "between" && source.who === "undone") {
            let value10: Dynamic = allJournalArtboards(source)
              .map((input?: Dynamic): Dynamic => input.file)
              .filter(
                (input?: Dynamic): Dynamic =>
                  input !== readResult.file || values2.has(input),
              );
            return truncateJournalText(
              source.at +
                " " +
                FAST_EDIT_TURN_STATUS_LABELS.undone +
                (value10.length > 0 ? ", on " + callback3(value10) : "") +
                ": that edit was undone",
              MAX_JOURNAL_TEXT_CHARS,
            );
          }
          let callback5: Dynamic = (input?: Dynamic): Dynamic => {
              let value10: Dynamic = input.file === readResult.file,
                value11: Dynamic =
                  value10 &&
                  root !== null &&
                  handlePattern !== null &&
                  input.shape !== undefined &&
                  input.shape === (value2 ??= hashElementStructure(root)),
                callback6: Dynamic = (input2?: Dynamic): Dynamic => {
                  let value12: Dynamic = value11 ? root : undefined;
                  for (let value14 of input2.split(".") as Dynamic)
                    value12 = value12?.children[Number(value14) - 1];
                  let value13: Dynamic = value12?.getAttribute("id") ?? "";
                  return value11 && handlePattern.test(value13)
                    ? "#" + value13
                    : "";
                },
                callback7: Dynamic = (
                  input2?: Dynamic,
                  options2: Dynamic = input2,
                ): Dynamic => {
                  let value12: Dynamic =
                    /^(the [a-z][a-z0-9]*|an element) @([\d.]+)$/.exec(input2);
                  return value12 !== null
                    ? callback6(value12[2]) || value12[1]
                    : (value10 && callback(input2)) || options2;
                },
                callback8: Dynamic = (input2?: Dynamic): Dynamic => {
                  for (let value12 of input2.matchAll(
                    / (?:after|before|in) /g,
                  ) as Dynamic) {
                    let value13: Dynamic = value12.index + value12[0].length,
                      value14: Dynamic = input2.slice(value13),
                      value15: Dynamic = callback7(value14);
                    if (value15 !== value14)
                      return input2.slice(0, value13) + value15;
                  }
                  return input2;
                },
                callback9: Dynamic = (input2?: Dynamic): Dynamic =>
                  callback8(
                    input2.replace(
                      /^(new [a-z][a-z0-9]*) @([\d.]+)/,
                      (
                        input3?: Dynamic,
                        options2?: Dynamic,
                        context?: Dynamic,
                      ): Dynamic =>
                        options2 +
                        (callback6(context) === ""
                          ? ""
                          : " " + callback6(context)),
                    ),
                  ),
                callback10: Dynamic = (items3?: Dynamic): Dynamic => {
                  let value12: Dynamic = Array.from(
                      items3.matchAll(/ (?:after|before|in) /g),
                    ),
                    value13: Dynamic =
                      value12.find((input2?: Dynamic): Dynamic => {
                        let value16: Dynamic = items3.slice(
                          input2.index + input2[0].length,
                        );
                        return callback7(value16) !== value16;
                      }) ?? value12[value12.length - 1],
                    value14: Dynamic = items3.slice(
                      6,
                      value13?.index ?? items3.length,
                    ),
                    value15: Dynamic = callback7(value14);
                  return [
                    "moved " +
                      (/ @[\d.]+$/.test(value14) ? value15 : value14) +
                      (value13 === undefined
                        ? ""
                        : value13[0] +
                          callback7(
                            items3.slice(value13.index + value13[0].length),
                          )),
                    value15.startsWith("#") ? value15.slice(1) : "",
                  ];
                },
                items: Dynamic = [],
                items2: Dynamic = [],
                text: Dynamic = "";
              for (let value12 of input.changes as Dynamic)
                if (value12.startsWith("  ")) {
                  items.push(
                    text +
                      value12
                        .slice(2)
                        .replace(
                          ": ",
                          value12.startsWith("  text: ") ? " " : " \u2192 ",
                        ),
                  );
                  text = "";
                } else if (value12.endsWith(":")) {
                  text = callback7(value12.slice(0, -1)) + " ";
                  items2.push(/^#([a-z]{1,8}\d{1,6}) $/.exec(text)?.[1] ?? "");
                } else if (value12.startsWith("moved ")) {
                  let [value13, value14]: Dynamic = callback10(value12);
                  items.push(value13);
                  items2.push(value14);
                  text = "";
                } else {
                  items.push(
                    value12 === NEW_ARTBOARD_JOURNAL_LABEL ||
                      value12 === REMOVED_ARTBOARD_JOURNAL_LABEL
                      ? value12 + " " + callback2(input.file)
                      : value12.startsWith("new ")
                        ? callback9(value12)
                        : value12,
                  );
                  items2.push(
                    /^new [a-z][a-z0-9]* #([a-z]{1,8}\d{1,6})(?= |$)/.exec(
                      items[items.length - 1],
                    )?.[1] ?? "",
                  );
                  text = "";
                }
              return {
                here: value10,
                what: items,
                heads: items2,
                now: callback7,
              };
            },
            value4: Dynamic = [
              NEW_ARTBOARD_JOURNAL_LABEL,
              REMOVED_ARTBOARD_JOURNAL_LABEL,
            ].flatMap((input?: Dynamic): Dynamic => {
              let value10: Dynamic = allJournalArtboards(source)
                .filter(
                  (input2?: Dynamic): Dynamic =>
                    callback4(input2) && input2.changes[0] === input,
                )
                .map((input2?: Dynamic): Dynamic => input2.file);
              return value10.length > 0
                ? [input + " " + callback3(value10)]
                : [];
            }),
            { here: value5, what: value6 }: Dynamic = callback5(source),
            value7: Dynamic = allJournalArtboards(source)
              .slice(1)
              .filter((input?: Dynamic): Dynamic => !callback4(input))
              .map((input?: Dynamic): Dynamic => {
                let value10: Dynamic = callback5(input);
                return (
                  (value10.here ? "" : "on " + callback2(input.file) + ": ") +
                  value10.what.join(", ")
                );
              }),
            value8: Dynamic = [
              ...value4,
              ...(value6.length > 0 && !callback4(source)
                ? [value6.join(", ")]
                : []),
              ...value7,
            ].join("; "),
            value9: Dynamic = allJournalArtboards(source).filter(
              (input?: Dynamic): Dynamic => input.changes.length > 0,
            );
          (value9.length > 0 || values.has(source)) &&
            (value3 = values.has(source)
              ? null
              : {
                  file: value9[0].file,
                  handle:
                    value9.length > 1 ||
                    new Set(callback5(value9[0]).heads).size !== 1
                      ? ""
                      : callback5(value9[0]).heads[0],
                });
          return source.kind === "comment" && value8 === ""
            ? ""
            : truncateJournalText(
                source.at +
                  " " +
                  (source.kind === "comment"
                    ? "you"
                    : FAST_EDIT_TURN_STATUS_LABELS[source.who]) +
                  (source.kind !== "comment" && source.opened === true
                    ? ", since the design was opened"
                    : "") +
                  (value5 ||
                  callback4(source) ||
                  (value6.length === 0 && value7.length + value4.length > 0)
                    ? ""
                    : ", on " + callback2(source.file)) +
                  ": " +
                  (value8 !== "" ? value8 : "the artboard changed"),
                MAX_JOURNAL_TEXT_CHARS,
              );
        })
        .filter((input?: Dynamic): Dynamic => input !== "").join(`
`),
      last: value3,
    };
  }
  bindRuntimeValue(
    runtime,
    "MAX_JOURNAL_CHANGE_LINES",
    () => MAX_JOURNAL_CHANGE_LINES,
    (value) => {
      MAX_JOURNAL_CHANGE_LINES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_JOURNAL_TEXT_CHARS",
    () => MAX_JOURNAL_TEXT_CHARS,
    (value) => {
      MAX_JOURNAL_TEXT_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_JOURNAL_ATTRIBUTE_CHARS",
    () => MAX_JOURNAL_ATTRIBUTE_CHARS,
    (value) => {
      MAX_JOURNAL_ATTRIBUTE_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_JOURNAL_ELEMENT_LABEL_CHARS",
    () => MAX_JOURNAL_ELEMENT_LABEL_CHARS,
    (value) => {
      MAX_JOURNAL_ELEMENT_LABEL_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_JOURNAL_DIFF_CHARS",
    () => MAX_JOURNAL_DIFF_CHARS,
    (value) => {
      MAX_JOURNAL_DIFF_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_JOURNAL_LINE_CHARS",
    () => MAX_JOURNAL_LINE_CHARS,
    (value) => {
      MAX_JOURNAL_LINE_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NEW_ARTBOARD_JOURNAL_LABEL",
    () => NEW_ARTBOARD_JOURNAL_LABEL,
    (value) => {
      NEW_ARTBOARD_JOURNAL_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REMOVED_ARTBOARD_JOURNAL_LABEL",
    () => REMOVED_ARTBOARD_JOURNAL_LABEL,
    (value) => {
      REMOVED_ARTBOARD_JOURNAL_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNTRUSTED_TEXT_PATTERN",
    () => UNTRUSTED_TEXT_PATTERN,
    (value) => {
      UNTRUSTED_TEXT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeJournalText",
    () => sanitizeJournalText,
    (value) => {
      sanitizeJournalText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeJournalWhitespace",
    () => normalizeJournalWhitespace,
    (value) => {
      normalizeJournalWhitespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeJournalText",
    () => normalizeJournalText,
    (value) => {
      normalizeJournalText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "truncateJournalText",
    () => truncateJournalText,
    (value) => {
      truncateJournalText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "journalUtf8Size",
    () => journalUtf8Size,
    (value) => {
      journalUtf8Size = value;
    },
  );
  bindRuntimeValue(runtime, "parseJournalRoot", () => parseJournalRoot);
  bindRuntimeValue(
    runtime,
    "immediateElementText",
    () => immediateElementText,
    (value) => {
      immediateElementText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createElementTextSummarizer",
    () => createElementTextSummarizer,
  );
  bindRuntimeValue(
    runtime,
    "normalizeJournalTagName",
    () => normalizeJournalTagName,
    (value) => {
      normalizeJournalTagName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeJournalElement",
    () => describeJournalElement,
    (value) => {
      describeJournalElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_DECORATIVE_ELEMENT_COUNT",
    () => MAX_DECORATIVE_ELEMENT_COUNT,
    (value) => {
      MAX_DECORATIVE_ELEMENT_COUNT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NON_DECORATIVE_ELEMENT_SELECTOR",
    () => NON_DECORATIVE_ELEMENT_SELECTOR,
    (value) => {
      NON_DECORATIVE_ELEMENT_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasBackgroundImage",
    () => hasBackgroundImage,
    (value) => {
      hasBackgroundImage = value;
    },
  );
  bindRuntimeValue(runtime, "isDecorativeElement", () => isDecorativeElement);
  bindRuntimeValue(
    runtime,
    "relativeElementIndexPath",
    () => relativeElementIndexPath,
    (value) => {
      relativeElementIndexPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hashElementStructure",
    () => hashElementStructure,
    (value) => {
      hashElementStructure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hashHtmlStructure",
    () => hashHtmlStructure,
    (value) => {
      hashHtmlStructure = value;
    },
  );
  bindRuntimeValue(runtime, "parseJournalStyle", () => parseJournalStyle);
  bindRuntimeValue(runtime, "describeStyleChanges", () => describeStyleChanges);
  bindRuntimeValue(
    runtime,
    "equalElementAttributes",
    () => equalElementAttributes,
    (value) => {
      equalElementAttributes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "journalElementAttributes",
    () => journalElementAttributes,
    (value) => {
      journalElementAttributes = value;
    },
  );
  bindRuntimeValue(runtime, "matchJournalElements", () => matchJournalElements);
  bindRuntimeValue(
    runtime,
    "MAX_REORDER_TRACKING_ITEMS",
    () => MAX_REORDER_TRACKING_ITEMS,
    (value) => {
      MAX_REORDER_TRACKING_ITEMS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "longestIncreasingSubsequenceLength",
    () => longestIncreasingSubsequenceLength,
    (value) => {
      longestIncreasingSubsequenceLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "detectMovedJournalElements",
    () => detectMovedJournalElements,
  );
  bindRuntimeValue(
    runtime,
    "describeArtboardHtmlChanges",
    () => describeArtboardHtmlChanges,
  );
  bindRuntimeValue(
    runtime,
    "classifyJournalChangeSource",
    () => classifyJournalChangeSource,
  );
  bindRuntimeValue(
    runtime,
    "normalizeJournalChanges",
    () => normalizeJournalChanges,
  );
  bindRuntimeValue(
    runtime,
    "allJournalArtboards",
    () => allJournalArtboards,
    (value) => {
      allJournalArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatJournalTime",
    () => formatJournalTime,
    (value) => {
      formatJournalTime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "appendTurnJournalEntry",
    () => appendTurnJournalEntry,
  );
  bindRuntimeValue(
    runtime,
    "appendExternalJournalEntry",
    () => appendExternalJournalEntry,
  );
  bindRuntimeValue(
    runtime,
    "summarizeArtboardText",
    () => summarizeArtboardText,
  );
  bindRuntimeValue(
    runtime,
    "createFastEditJournalState",
    () => createFastEditJournalState,
    (value) => {
      createFastEditJournalState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_JOURNAL_ENTRIES",
    () => MAX_FAST_EDIT_JOURNAL_ENTRIES,
    (value) => {
      MAX_FAST_EDIT_JOURNAL_ENTRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectJournalChanges",
    () => collectJournalChanges,
  );
  bindRuntimeValue(
    runtime,
    "finishFastEditJournalTurn",
    () => finishFastEditJournalTurn,
  );
  bindRuntimeValue(
    runtime,
    "HISTORY_TURN_COMPLETION_MESSAGES",
    () => HISTORY_TURN_COMPLETION_MESSAGES,
    (value) => {
      HISTORY_TURN_COMPLETION_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_TURN_STATUS_LABELS",
    () => FAST_EDIT_TURN_STATUS_LABELS,
    (value) => {
      FAST_EDIT_TURN_STATUS_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recordFastEditReadResult",
    () => recordFastEditReadResult,
  );
  return () => {
    MAX_JOURNAL_CHANGE_LINES = 10;
    MAX_JOURNAL_TEXT_CHARS = 300;
    MAX_JOURNAL_ATTRIBUTE_CHARS = 160;
    MAX_JOURNAL_ELEMENT_LABEL_CHARS = 60;
    MAX_JOURNAL_DIFF_CHARS = 240;
    MAX_JOURNAL_LINE_CHARS = 340;
    NEW_ARTBOARD_JOURNAL_LABEL = "new artboard";
    REMOVED_ARTBOARD_JOURNAL_LABEL = "removed artboard";
    UNTRUSTED_TEXT_PATTERN = /untrusted|[0-9a-f]{32}/i;
    sanitizeJournalText = (input?: Dynamic): Dynamic => {
      let value: Dynamic = input.replace(/\p{Cf}/gu, "");
      return UNTRUSTED_TEXT_PATTERN.test(value)
        ? (0, runtime.sanitizeUntrustedText)(value)
        : value;
    };
    normalizeJournalWhitespace = (input?: Dynamic): Dynamic =>
      input.replace(/[\s\p{Cc}]+/gu, " ");
    normalizeJournalText = (input?: Dynamic): Dynamic =>
      normalizeJournalWhitespace(sanitizeJournalText(input)).trim();
    truncateJournalText = (items?: Dynamic, options?: Dynamic): Dynamic =>
      items.length > options ? items.slice(0, options - 1) + "\u2026" : items;
    journalUtf8Size = (input?: Dynamic): Dynamic =>
      new TextEncoder().encode(input).length;
    immediateElementText = (input?: Dynamic): Dynamic =>
      normalizeJournalText(
        Array.from(input.childNodes)
          .filter((input2?: Dynamic): Dynamic => input2.nodeType === 3)
          .map((input2?: Dynamic): Dynamic => input2.textContent ?? "")
          .join(" "),
      );
    normalizeJournalTagName = (input?: Dynamic): Dynamic =>
      input.replace(/^sc-raw-/, "");
    describeJournalElement = (
      input?: Dynamic,
      options?: Dynamic,
      context: Dynamic = "the ",
    ): Dynamic =>
      (runtime.SAFE_PROMPT_HTML_TAGS.has(normalizeJournalTagName(input))
        ? context + normalizeJournalTagName(input)
        : context === "the "
          ? "an element"
          : "element") +
      (options !== ""
        ? ' "' +
          truncateJournalText(options, MAX_JOURNAL_ELEMENT_LABEL_CHARS) +
          '"'
        : "");
    MAX_DECORATIVE_ELEMENT_COUNT = 40;
    NON_DECORATIVE_ELEMENT_SELECTOR =
      "img, picture, video, canvas, dc-import, x-import, input, textarea, select, sc-raw-select, button";
    hasBackgroundImage = (element?: Dynamic): Dynamic =>
      /(?:^|;)\s*background(?:-image)?\s*:[^;]*url\(/i.test(
        element.getAttribute("style") ?? "",
      );
    relativeElementIndexPath = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let items: Dynamic = [];
      for (
        let value: Dynamic = input;
        value !== options && value.parentElement !== null;
        value = value.parentElement
      )
        items.unshift(
          Array.prototype.indexOf.call(value.parentElement.children, value) + 1,
        );
      return items.join(".");
    };
    hashElementStructure = (input?: Dynamic): Dynamic => {
      let count: Dynamic = 2166136261;
      for (let value of [
        input,
        ...Array.from(input.querySelectorAll("*")),
      ] as Dynamic)
        for (let value2 of (value.localName +
          String(value.children.length) +
          " ") as Dynamic)
          count = Math.imul(count ^ value2.charCodeAt(0), 16777619);
      return String(count >>> 0);
    };
    hashHtmlStructure = (input?: Dynamic): Dynamic => {
      let value: Dynamic = parseJournalRoot(input);
      return value === null ? "" : hashElementStructure(value);
    };
    equalElementAttributes = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let attributes: Dynamic = input.attributes,
        attributes2: Dynamic = options.attributes;
      if (attributes.length !== attributes2.length) return false;
      for (let index: Dynamic = 0; index < attributes.length; index++)
        if (
          attributes[index].name !== attributes2[index].name ||
          attributes[index].value !== attributes2[index].value
        )
          return false;
      return true;
    };
    journalElementAttributes = (input?: Dynamic, options?: Dynamic): Dynamic =>
      new Map(
        Array.from(input.attributes)
          .filter(
            (input2?: Dynamic): Dynamic =>
              input2.name !== "style" &&
              !(
                input2.name === "id" &&
                options !== null &&
                options.test(input2.value)
              ),
          )
          .map(
            (input2?: Dynamic): Dynamic => [
              input2.name,
              normalizeJournalText(input2.value),
            ],
          ),
      );
    MAX_REORDER_TRACKING_ITEMS = 400;
    longestIncreasingSubsequenceLength = (input?: Dynamic): Dynamic => {
      let items: Dynamic = [];
      for (let value of input as Dynamic) {
        let index: Dynamic = 0,
          length: Dynamic = items.length;
        for (; index < length; ) {
          let value2: Dynamic = (index + length) >> 1;
          items[value2] < value ? (index = value2 + 1) : (length = value2);
        }
        items[index] = value;
      }
      return items.length;
    };
    allJournalArtboards = (input?: Dynamic): Dynamic => [
      input,
      ...(input.also ?? []),
    ];
    formatJournalTime = (input?: Dynamic): Dynamic =>
      String(input.getHours()).padStart(2, "0") +
      ":" +
      String(input.getMinutes()).padStart(2, "0");
    createFastEditJournalState = (
      input: Dynamic = (): Dynamic => new Date(),
      options?: Dynamic,
    ): Dynamic => ({
      journal: [],
      history: (0, runtime.createFastEditHistory)(options),
      seen: new Map(),
      beforeLast: new Map(),
      opened: new Set(),
      unrecorded: new Map(),
      threads: new Set(),
      first: null,
      turn: null,
      clock: input,
    });
    MAX_FAST_EDIT_JOURNAL_ENTRIES = 200;
    HISTORY_TURN_COMPLETION_MESSAGES = {
      done: "done",
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      handed: "handed to the agent, nothing changed here",
      not_applied: "not done here, it went to the agent",
      unconfirmed: "made, but the save was not confirmed",
      nothing: "not done, nothing changed",
      left: "what was made of it here still stands; it also went to the agent",
      left_changed:
        "it went to the agent; what stands of it here is what the artboards show",
    };
    FAST_EDIT_TURN_STATUS_LABELS = {
      hand: "by hand",
      other: "someone else",
      undone: "undo",
    };
  };
}
