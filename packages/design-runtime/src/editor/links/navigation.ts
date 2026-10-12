/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorLinksNavigation(
  runtime: RuntimeBindings,
): () => void {
  var LinksNavigationHttpsPattern: Dynamic;
  var LinksNavigationHttpsPattern_2: Dynamic;
  var LinksNavigationResolvedValue: Dynamic;
  var LinksNavigationResolvedValue_2: Dynamic;
  var LinksNavigationKey: Dynamic;
  var LinksNavigationKeyValue: Dynamic;
  var LinksNavigationKeyValue_2: Dynamic;
  function validateNavigableUrl(input?: Dynamic, options?: Dynamic): Dynamic {
    if (
      !(
        options?.storedUrl === true
          ? LinksNavigationHttpsPattern_2
          : LinksNavigationHttpsPattern
      ).test(input)
    )
      return null;
    let value: Dynamic;
    try {
      value = new URL(input);
    } catch {
      return null;
    }
    let value2: Dynamic =
        typeof location === "undefined" ? "" : location.hostname,
      value3: Dynamic = value2.replace(/^[^.]+\./, ""),
      hostname: Dynamic = value.hostname;
    return hostname === "" ||
      hostname.endsWith(".") ||
      hostname === value2 ||
      value.username !== "" ||
      value.password !== "" ||
      hostname === "claudeusercontent.com" ||
      hostname.endsWith(".claudeusercontent.com") ||
      (value3.includes(".") &&
        (hostname === value3 || hostname.endsWith("." + value3)))
      ? null
      : input;
  }
  function getElementLinkHref(element?: Dynamic): Dynamic {
    let value: Dynamic =
      element.getAttribute("href") || element.getAttribute("data-href") || "";
    return LinksNavigationHttpsPattern.test(value) ? value : "";
  }
  function openValidatedLink(input?: Dynamic, options?: Dynamic): Dynamic {
    if (validateNavigableUrl(input, options) === null) return;
    let value: Dynamic = (document as Dynamic).createElement("a");
    value.href = input;
    value.target = "_blank";
    value.rel = "noopener noreferrer";
    (document as Dynamic).body.append(value);
    value.click();
    value.remove();
  }
  bindRuntimeValue(
    runtime,
    "LinksNavigationHttpsPattern",
    () => LinksNavigationHttpsPattern,
    (value) => {
      LinksNavigationHttpsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LinksNavigationHttpsPattern_2",
    () => LinksNavigationHttpsPattern_2,
    (value) => {
      LinksNavigationHttpsPattern_2 = value;
    },
  );
  bindRuntimeValue(runtime, "validateNavigableUrl", () => validateNavigableUrl);
  bindRuntimeValue(
    runtime,
    "LinksNavigationResolvedValue",
    () => LinksNavigationResolvedValue,
    (value) => {
      LinksNavigationResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LinksNavigationResolvedValue_2",
    () => LinksNavigationResolvedValue_2,
    (value) => {
      LinksNavigationResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LinksNavigationKey",
    () => LinksNavigationKey,
    (value) => {
      LinksNavigationKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LinksNavigationKeyValue",
    () => LinksNavigationKeyValue,
    (value) => {
      LinksNavigationKeyValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LinksNavigationKeyValue_2",
    () => LinksNavigationKeyValue_2,
    (value) => {
      LinksNavigationKeyValue_2 = value;
    },
  );
  bindRuntimeValue(runtime, "getElementLinkHref", () => getElementLinkHref);
  bindRuntimeValue(runtime, "openValidatedLink", () => openValidatedLink);
  return () => {
    LinksNavigationHttpsPattern = /^https?:\/\/[^\s)\[]*$/;
    LinksNavigationHttpsPattern_2 = /^https?:\/\/\S*$/;
    LinksNavigationResolvedValue = (0, runtime.isApplePlatform)()
      ? "\u2318"
      : "Ctrl";
    LinksNavigationResolvedValue_2 =
      " (" +
      LinksNavigationResolvedValue +
      "-click or " +
      LinksNavigationResolvedValue +
      "+Enter to open)";
    LinksNavigationKey =
      (input?: Dynamic): Dynamic =>
      (event?: Dynamic): Dynamic => {
        event.key !== "Enter" ||
          event.nativeEvent?.isComposing ||
          (input && !(event.metaKey || event.ctrlKey)) ||
          (event.preventDefault(),
          openValidatedLink(getElementLinkHref(event.currentTarget)));
      };
    LinksNavigationKeyValue = LinksNavigationKey(true);
    LinksNavigationKeyValue_2 = LinksNavigationKey(false);
  };
}
