/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditArtboardOperations(
  runtime: RuntimeBindings,
): () => void {
  var FAST_EDIT_OPERATION_LIMITS: Dynamic;
  var MAX_FAST_EDIT_FILES: Dynamic;
  var FAST_EDIT_ARTBOARD_ID_PATTERN: Dynamic;
  var escapeFastEditAttribute: Dynamic;
  var safeArtboardTitle: Dynamic;
  var parseArtboardCoordinate: Dynamic;
  var checkFastEditNewArtboardLimit: Dynamic;
  var ARTBOARD_PLACEMENT_GAP: Dynamic;
  var artboardRectanglesOverlap: Dynamic;
  function createFastEditFileIds(files?: Dynamic): Dynamic {
    let idsByFile: Dynamic = new Map(),
      filesById: Dynamic = new Map(),
      fileStem: Dynamic = (input?: Dynamic): Dynamic =>
        input
          .replace(/\.dc\.html$/i, "")
          .replace(/[^A-Za-z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 56) || "artboard";
    for (let value of files as Dynamic) {
      let value2: Dynamic = fileStem(value),
        value3: Dynamic = value2;
      for (
        let count: Dynamic = 2;
        filesById.has(value3) ||
        value3 === "__proto__" ||
        value3 === "constructor" ||
        value3 === "prototype" ||
        value3.toLowerCase() === "container";
        count++
      )
        value3 = value2 + "-" + String(count);
      idsByFile.set(value, value3);
      filesById.set(value3, value);
    }
    return {
      idOf: idsByFile,
      pathOf: filesById,
    };
  }
  function sanitizeArtboardTitle(
    title?: Dynamic,
    maxChars: Dynamic = 120,
  ): Dynamic {
    return Array.from(String(title), (input?: Dynamic): Dynamic => {
      let value: Dynamic = input.codePointAt(0) ?? 0;
      return value < 32 ||
        (value >= 127 && value <= 159) ||
        value === 1564 ||
        value === 8206 ||
        value === 8207 ||
        (value >= 8234 && value <= 8238) ||
        (value >= 8294 && value <= 8297) ||
        value === 65279
        ? " "
        : input;
    })
      .join("")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  }
  function serializeFastEditArtboard(
    id?: Dynamic,
    board?: Dynamic,
    pageAttributes: Dynamic = "",
  ): Dynamic {
    return (
      '<section id="' +
      id +
      '" data-title="' +
      escapeFastEditAttribute(safeArtboardTitle(board.title)) +
      '" style="left: ' +
      String(Math.round(board.x)) +
      "px; top: " +
      String(Math.round(board.y)) +
      "px; width: " +
      String(Math.round(board.w)) +
      "px; height: " +
      String(Math.round(board.h)) +
      'px"' +
      pageAttributes +
      ">"
    );
  }
  function parseFastEditArtboardSection(
    html?: Dynamic,
    limits?: Dynamic,
  ): Dynamic {
    let openingTag: Dynamic = /^<section\b[^>]*>/i.exec(html);
    if (openingTag === null) return null;
    let quote: Dynamic = "",
      openingTagEnd: Dynamic = -1;
    for (let index: Dynamic = 0; index < html.length; index++) {
      let value8: Dynamic = html[index];
      if (quote !== "") value8 === quote && (quote = "");
      else if (value8 === '"' || value8 === "'") quote = value8;
      else if (value8 === ">") {
        openingTagEnd = index;
        break;
      }
    }
    if (openingTagEnd !== openingTag[0].length - 1) return null;
    let value: Dynamic = (document as Dynamic).createElement("template");
    value.innerHTML = openingTag[0] + "</section>";
    let firstElementChild: Dynamic = value.content.firstElementChild;
    if (firstElementChild === null || firstElementChild.localName !== "section")
      return null;
    let state: Dynamic = {};
    for (let value8 of (firstElementChild.getAttribute("style") ?? "").split(
      ";",
    ) as Dynamic) {
      let value9: Dynamic = value8.indexOf(":");
      value9 > 0 &&
        (state[value8.slice(0, value9).trim().toLowerCase()] = value8
          .slice(value9 + 1)
          .trim());
    }
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value8: Dynamic = state[input];
        if (value8 === undefined) return null;
        let value9: Dynamic = /^(-?\d{1,6}(?:\.\d{1,3})?)(?:px)?$/.exec(value8);
        return value9 === null ? "bad" : value9[1];
      },
      callback2: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value8?: Dynamic,
      ): Dynamic => {
        let attribute2: Dynamic = firstElementChild.getAttribute(input);
        return parseArtboardCoordinate(
          attribute2 !== null ? attribute2 : callback(options),
          context,
          value8,
        );
      },
      value2: Dynamic = callback2("data-x", "left", -2e5, 2e5),
      value3: Dynamic = callback2("data-y", "top", -2e5, 2e5),
      value4: Dynamic = callback2("data-w", "width", 120, 8e3),
      value5: Dynamic = callback2("data-h", "height", 120, 8e3);
    if (
      value2 === null ||
      value3 === null ||
      value4 === null ||
      value5 === null
    )
      return null;
    let attribute: Dynamic = firstElementChild.getAttribute("data-title"),
      value6: Dynamic =
        attribute === null ? undefined : sanitizeArtboardTitle(attribute);
    if (value6 === "") return null;
    let value7: Dynamic = /^(?:yes|true|1)$/i.test(
        (firstElementChild.getAttribute("data-delete") ?? "").trim(),
      ),
      state2: Dynamic = {};
    for (let value8 of ["background", "color", "font"] as Dynamic) {
      let attribute2: Dynamic = firstElementChild.getAttribute(
        "data-page-" + value8,
      );
      attribute2 !== null
        ? (state2[value8] = attribute2)
        : limits?.has(value8) === true && (state2[value8] = "");
    }
    return {
      ...(Object.keys(state2).length > 0
        ? {
            page: state2,
          }
        : {}),
      ...(value7
        ? {
            del: value7,
          }
        : {}),
      ...(value6 !== undefined
        ? {
            title: value6,
          }
        : {}),
      ...(value2 !== undefined
        ? {
            x: value2,
          }
        : {}),
      ...(value3 !== undefined
        ? {
            y: value3,
          }
        : {}),
      ...(value4 !== undefined
        ? {
            w: value4,
          }
        : {}),
      ...(value5 !== undefined
        ? {
            h: value5,
          }
        : {}),
    };
  }
  function diffArtboardProperties(before?: Dynamic, after?: Dynamic): Dynamic {
    let changes: Dynamic = {};
    after.x !== undefined &&
      after.x !== Math.round(before.x) &&
      (changes.x = after.x);
    after.y !== undefined &&
      after.y !== Math.round(before.y) &&
      (changes.y = after.y);
    after.w !== undefined &&
      after.w !== Math.round(before.w) &&
      (changes.w = after.w);
    after.h !== undefined &&
      after.h !== Math.round(before.h) &&
      (changes.h = after.h);
    return {
      place: changes,
      ...(after.title !== undefined &&
      after.title !== safeArtboardTitle(before.title)
        ? {
            title: after.title,
          }
        : {}),
    };
  }
  function parseFastEditArtboardOperation(
    value?: Dynamic,
    knownIds?: Dynamic,
  ): Dynamic {
    if (value === null || typeof value != "object") return null;
    let operation: Dynamic = value,
      id: Dynamic =
        typeof operation.id == "string" &&
        FAST_EDIT_ARTBOARD_ID_PATTERN.test(operation.id) &&
        knownIds.has(operation.id)
          ? operation.id
          : null;
    return operation.op === "remove"
      ? id === null
        ? null
        : {
            op: "remove",
            id: id,
          }
      : operation.op === "duplicate"
        ? id === null
          ? null
          : {
              op: "duplicate",
              id: id,
              ...(typeof operation.newId == "string" &&
              FAST_EDIT_ARTBOARD_ID_PATTERN.test(operation.newId) &&
              !knownIds.has(operation.newId)
                ? {
                    newId: operation.newId,
                  }
                : {}),
              ...(typeof operation.html == "string" &&
              operation.html.length <= 2e5
                ? {
                    html: operation.html,
                  }
                : {}),
            }
        : operation.op === "add"
          ? typeof operation.html == "string" &&
            operation.html.length <= 2e5 &&
            /^<section\b/i.test(operation.html)
            ? {
                op: "add",
                html: operation.html,
                ...(typeof operation.id == "string" &&
                /^[A-Za-z0-9_-]{1,64}$/.test(operation.id)
                  ? {
                      id: operation.id,
                    }
                  : {}),
              }
            : null
          : typeof operation.op == "string"
            ? {
                op: "other",
                name: operation.op.slice(0, 24),
              }
            : null;
  }
  function findAdjacentArtboardSpaces(
    boards?: Dynamic,
    reference?: Dynamic,
  ): Dynamic {
    let overlapsHorizontally: Dynamic = (input?: Dynamic): Dynamic =>
        input.x < reference.x + reference.w && input.x + input.w > reference.x,
      overlapsVertically: Dynamic = (input?: Dynamic): Dynamic =>
        input.y < reference.y + reference.h && input.y + input.h > reference.y,
      belowY: Dynamic =
        Math.max(
          reference.y + reference.h,
          ...boards
            .filter(
              (input?: Dynamic): Dynamic =>
                overlapsHorizontally(input) &&
                input.y >= reference.y + reference.h - 1,
            )
            .map((input?: Dynamic): Dynamic => input.y + input.h),
        ) + ARTBOARD_PLACEMENT_GAP,
      rightX: Dynamic =
        Math.max(
          reference.x + reference.w,
          ...boards
            .filter(
              (input?: Dynamic): Dynamic =>
                overlapsVertically(input) &&
                input.x >= reference.x + reference.w - 1,
            )
            .map((input?: Dynamic): Dynamic => input.x + input.w),
        ) + ARTBOARD_PLACEMENT_GAP,
      value: Dynamic =
        Math.max(
          reference.y + reference.h,
          ...boards.map((input?: Dynamic): Dynamic => input.y + input.h),
        ) + ARTBOARD_PLACEMENT_GAP,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        String(Math.round(input)),
      value2: Dynamic =
        belowY === reference.y + reference.h + ARTBOARD_PLACEMENT_GAP;
    return {
      below: {
        x: reference.x,
        y: belowY,
        direct: value2,
      },
      right: {
        x: rightX,
        y: reference.y,
      },
      row: {
        x: reference.x,
        y: value,
      },
      line:
        "FREE PLACES near it: below: left " +
        callback(reference.x) +
        ", top " +
        callback(belowY) +
        (value2
          ? " (directly under it)"
          : " (under what is already below it)") +
        "; right: left " +
        callback(rightX) +
        ", top " +
        callback(reference.y) +
        "; a whole free row: left " +
        callback(reference.x) +
        ", top " +
        callback(value),
    };
  }
  function findAvailableArtboardPosition(
    requested?: Dynamic,
    occupied?: Dynamic,
    reference?: Dynamic,
  ): Dynamic {
    let rectangle: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => ({
        x: input,
        y: options,
        w: requested.w,
        h: requested.h,
      }),
      isFree: Dynamic = (input?: Dynamic): Dynamic =>
        !occupied.some(
          (input2?: Dynamic): Dynamic =>
            artboardRectanglesOverlap(input, input2),
        );
    if (
      requested.x !== undefined &&
      requested.y !== undefined &&
      isFree(rectangle(requested.x, requested.y))
    )
      return {
        x: requested.x,
        y: requested.y,
        moved: "",
      };
    let value: Dynamic = findAdjacentArtboardSpaces(
        occupied.filter((input?: Dynamic): Dynamic => input !== reference),
        reference,
      ),
      value2: Dynamic = requested.x ?? reference.x,
      value3: Dynamic = requested.y ?? reference.y + reference.h,
      value4: Dynamic = [
        {
          ...value.below,
          moved: "below",
        },
        {
          ...value.right,
          moved: "right of",
        },
        {
          ...value.row,
          moved: "in a free row under",
        },
      ].filter(
        (input?: Dynamic): Dynamic => isFree(rectangle(input.x, input.y)),
      );
    value4.sort(
      (input?: Dynamic, options?: Dynamic): Dynamic =>
        Math.hypot(input.x - value2, input.y - value3) -
        Math.hypot(options.x - value2, options.y - value3),
    );
    if (value4.length > 0)
      return {
        x: value4[0].x,
        y: value4[0].y,
        moved: value4[0].moved,
      };
    let x: Dynamic = value.row.x;
    for (
      let index: Dynamic = 0;
      index < 64 && !isFree(rectangle(x, value.row.y));
      index++
    )
      x = Math.max(
        x + ARTBOARD_PLACEMENT_GAP,
        ...occupied
          .filter(
            (input?: Dynamic): Dynamic =>
              artboardRectanglesOverlap(rectangle(x, value.row.y), input),
          )
          .map(
            (input?: Dynamic): Dynamic =>
              input.x + input.w + ARTBOARD_PLACEMENT_GAP,
          ),
      );
    return {
      x: x,
      y: value.row.y,
      moved: "in a free row under",
    };
  }
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_OPERATION_LIMITS",
    () => FAST_EDIT_OPERATION_LIMITS,
    (value) => {
      FAST_EDIT_OPERATION_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_FILES",
    () => MAX_FAST_EDIT_FILES,
    (value) => {
      MAX_FAST_EDIT_FILES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_ARTBOARD_ID_PATTERN",
    () => FAST_EDIT_ARTBOARD_ID_PATTERN,
    (value) => {
      FAST_EDIT_ARTBOARD_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFastEditFileIds",
    () => createFastEditFileIds,
  );
  bindRuntimeValue(
    runtime,
    "escapeFastEditAttribute",
    () => escapeFastEditAttribute,
    (value) => {
      escapeFastEditAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeArtboardTitle",
    () => sanitizeArtboardTitle,
  );
  bindRuntimeValue(
    runtime,
    "safeArtboardTitle",
    () => safeArtboardTitle,
    (value) => {
      safeArtboardTitle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeFastEditArtboard",
    () => serializeFastEditArtboard,
  );
  bindRuntimeValue(
    runtime,
    "parseArtboardCoordinate",
    () => parseArtboardCoordinate,
    (value) => {
      parseArtboardCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseFastEditArtboardSection",
    () => parseFastEditArtboardSection,
  );
  bindRuntimeValue(
    runtime,
    "diffArtboardProperties",
    () => diffArtboardProperties,
  );
  bindRuntimeValue(
    runtime,
    "checkFastEditNewArtboardLimit",
    () => checkFastEditNewArtboardLimit,
    (value) => {
      checkFastEditNewArtboardLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseFastEditArtboardOperation",
    () => parseFastEditArtboardOperation,
  );
  bindRuntimeValue(
    runtime,
    "ARTBOARD_PLACEMENT_GAP",
    () => ARTBOARD_PLACEMENT_GAP,
    (value) => {
      ARTBOARD_PLACEMENT_GAP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findAdjacentArtboardSpaces",
    () => findAdjacentArtboardSpaces,
  );
  bindRuntimeValue(
    runtime,
    "artboardRectanglesOverlap",
    () => artboardRectanglesOverlap,
    (value) => {
      artboardRectanglesOverlap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findAvailableArtboardPosition",
    () => findAvailableArtboardPosition,
  );
  return () => {
    FAST_EDIT_OPERATION_LIMITS = {
      news: 24,
    };
    MAX_FAST_EDIT_FILES = runtime.FAST_EDIT_INPUT_LIMITS.maxFiles;
    FAST_EDIT_ARTBOARD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
    escapeFastEditAttribute = (input?: Dynamic): Dynamic =>
      input
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    safeArtboardTitle = (input?: Dynamic): Dynamic =>
      sanitizeArtboardTitle(
        sanitizeArtboardTitle(input).replace(/[<>"'&`]/g, " "),
      ) || "Artboard";
    parseArtboardCoordinate = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      if (input === null) return;
      if (!/^-?\d{1,6}(?:\.\d{1,3})?$/.test(input.trim())) return null;
      let value: Dynamic = Math.round(Number(input));
      return value < options || value > context ? null : value;
    };
    checkFastEditNewArtboardLimit = (input?: Dynamic): Dynamic =>
      input.adds.length + input.duplicates.length >
      FAST_EDIT_OPERATION_LIMITS.news
        ? "cap_news"
        : null;
    ARTBOARD_PLACEMENT_GAP = 80;
    artboardRectanglesOverlap = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input.x < options.x + options.w &&
      input.x + input.w > options.x &&
      input.y < options.y + options.h &&
      input.y + input.h > options.y;
  };
}
