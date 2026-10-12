/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardSvgCopy(
  runtime: RuntimeBindings,
): () => void {
  function containsSvgExternalResource(input?: Dynamic): Dynamic {
    return (
      input.includes("\\") ||
      /(?:url|image|image-set|src)\s*\(/i.test(
        input.replace(/url\(\s*(['"]?)#[^)]*\1\s*\)/gi, ""),
      )
    );
  }
  function sanitizeSvgClipboardDom(element?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    (element.localName === "title" || element.localName === "desc") &&
      (element.textContent = element.textContent ?? "");
    for (let value of [...element.childNodes] as Dynamic)
      if (value.nodeType === Node.CDATA_SECTION_NODE)
        value.replaceWith(
          element.ownerDocument.createTextNode(value.nodeValue ?? ""),
        );
      else if (value.nodeType === Node.ELEMENT_NODE) {
        let value2: Dynamic = value;
        if (
          value2.namespaceURI === runtime.HttpWwwW3Org2000SvgValue_2 &&
          runtime.ClipboardPngCopyASwitchSet.has(value2.localName)
        ) {
          let value3: Dynamic = element.ownerDocument.createElementNS(
            runtime.HttpWwwW3Org2000SvgValue_2,
            "g",
          );
          if (value2.localName === "switch") {
            let items: Dynamic = [...value2.children],
              value4: Dynamic =
                items.find(
                  (input?: Dynamic): Dynamic =>
                    !input.hasAttribute("systemLanguage") &&
                    !input.hasAttribute("requiredExtensions") &&
                    !input.hasAttribute("requiredFeatures"),
                ) ?? items[0];
            value4 && value3.append(value4);
          } else value3.append(...value2.childNodes);
          value2.replaceWith(value3);
          index += sanitizeSvgClipboardDom(value3);
        } else
          value2.namespaceURI !== runtime.HttpWwwW3Org2000SvgValue_2 ||
          !runtime.ClipboardPngCopySubscribers.has(value2.localName)
            ? value2.remove()
            : (index += sanitizeSvgClipboardDom(value2));
      } else value.nodeType !== Node.TEXT_NODE && value.remove();
    for (let value of [...element.attributes] as Dynamic) {
      let localName: Dynamic = value.localName,
        value2: Dynamic = localName.toLowerCase(),
        value3: Dynamic =
          localName === "href" &&
          (value.namespaceURI === null ||
            value.namespaceURI === runtime.HttpWwwW3Org1999XlinkValue);
      if (
        value.namespaceURI === runtime.HttpWwwW3Org2000XmlnsValue &&
        (value.value === runtime.HttpWwwW3Org2000SvgValue_2 ||
          value.value === runtime.HttpWwwW3Org1999XlinkValue)
      )
        continue;
      (((value.namespaceURI === null && !value.name.includes(":")) ||
        value3 ||
        (value.namespaceURI === runtime.HttpWwwW3OrgXML1998NamespaceValue &&
          localName === "space")) &&
        !/^(on|data-|aria-)/i.test(localName) &&
        value2 !== "class" &&
        !runtime.ClipboardPngCopySubscribers_2.has(value2) &&
        (value3 || value2 !== "href") &&
        !containsSvgExternalResource(value.value) &&
        (value3
          ? runtime.ClipboardPngCopyPattern.test(value.value) ||
            (element.localName === "image" &&
              runtime.ClipboardPngCopyDataImagePattern.test(value.value))
          : !/^\s*(?:javascript|vbscript|data):/i.test(value.value))) ||
        element.removeAttributeNS(value.namespaceURI, localName);
    }
    element.localName === "image" &&
      !element.getAttribute("href") &&
      !element.getAttributeNS(runtime.HttpWwwW3Org1999XlinkValue, "href") &&
      index++;
    return index;
  }
  function sanitizeSvgClipboard(input?: Dynamic): Dynamic {
    let value: Dynamic = new DOMParser().parseFromString(
        input,
        "image/svg+xml",
      ),
      documentElement: Dynamic = value.documentElement;
    if (
      documentElement.namespaceURI !== runtime.HttpWwwW3Org2000SvgValue_2 ||
      documentElement.localName !== "svg" ||
      value.getElementsByTagNameNS("*", "parsererror").length > 0
    )
      return null;
    let value2: Dynamic = sanitizeSvgClipboardDom(documentElement);
    return {
      svg: new XMLSerializer().serializeToString(documentElement),
      blank: value2,
    };
  }
  function svgClipboardMimeTypes(input: Dynamic = window): Dynamic {
    let ClipboardItem: Dynamic = input.ClipboardItem;
    return typeof ClipboardItem?.supports == "function" &&
      ClipboardItem.supports("image/svg+xml")
      ? ["text/plain", "image/svg+xml"]
      : ["text/plain"];
  }
  function parseSvgCaptureReply(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null)
      return {
        ok: false,
        softError: "bad-reply",
      };
    let value: Dynamic = input;
    if (value.e === "no-selection" || value.e === "zero-size")
      return {
        ok: false,
        softError: value.e,
      };
    let value2: Dynamic =
      typeof value.s == "string" ? sanitizeSvgClipboard(value.s) : null;
    return value2 === null
      ? {
          ok: false,
          softError: "bad-reply",
        }
      : {
          ok: true,
          ...value2,
          clipped: value.clipped === true,
        };
  }
  async function captureClipboardSvg(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = null,
  ): Promise<Dynamic> {
    let injected_svgCapture: Dynamic = runtime.injected_svgCapture;
    if (!injected_svgCapture)
      return {
        ok: false,
        softError: "bad-reply",
      };
    let value: Dynamic = await input.executeJavaScript(
      "(function(){" +
        injected_svgCapture +
        ";return window.__dcSvgCapture(" +
        JSON.stringify(options) +
        "," +
        JSON.stringify(context) +
        ");})()",
      15e3,
    );
    return parseSvgCaptureReply(value);
  }
  function svgCopyErrorMessage(input?: Dynamic): Dynamic {
    let value: Dynamic = input instanceof Error ? input.message : "";
    return /^(executeJavaScript timed out|preview is blocked)/.test(value)
      ? (0, runtime.describeCaptureFailure)(input)
      : runtime.AccessibilityAnnouncementsLabel_4;
  }
  async function writeClipboardSvg(
    input?: Dynamic,
    options: Dynamic = window,
  ): Promise<Dynamic> {
    let ClipboardItem: Dynamic = options.ClipboardItem,
      clipboard: Dynamic = options.navigator.clipboard;
    if (
      typeof ClipboardItem != "function" ||
      typeof clipboard?.write != "function"
    )
      return "refused";
    let value: Dynamic = input.catch((): Dynamic => null),
      value2: Dynamic = Object.fromEntries(
        svgClipboardMimeTypes(options).map(
          (input2?: Dynamic): Dynamic => [
            input2,
            value.then(
              (input3?: Dynamic): Dynamic =>
                input3 === null
                  ? Promise.reject(new Error("no picture"))
                  : new Blob([input3], {
                      type: input2,
                    }),
            ),
          ],
        ),
      );
    for (let value3 of Object.values(value2) as Dynamic)
      value3.catch((): Dynamic => {});
    try {
      await clipboard.write([new ClipboardItem(value2)]);
      return (await value) !== null ? "copied" : "no-picture";
    } catch {
      let value3: Dynamic = await value;
      if (value3 === null) return "no-picture";
      try {
        await clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([value3], {
              type: "text/plain",
            }),
          }),
        ]);
        return "copied";
      } catch {
        return "refused";
      }
    }
  }
  bindRuntimeValue(
    runtime,
    "containsSvgExternalResource",
    () => containsSvgExternalResource,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeSvgClipboardDom",
    () => sanitizeSvgClipboardDom,
  );
  bindRuntimeValue(runtime, "sanitizeSvgClipboard", () => sanitizeSvgClipboard);
  bindRuntimeValue(
    runtime,
    "svgClipboardMimeTypes",
    () => svgClipboardMimeTypes,
  );
  bindRuntimeValue(runtime, "parseSvgCaptureReply", () => parseSvgCaptureReply);
  bindRuntimeValue(runtime, "captureClipboardSvg", () => captureClipboardSvg);
  bindRuntimeValue(runtime, "svgCopyErrorMessage", () => svgCopyErrorMessage);
  bindRuntimeValue(runtime, "writeClipboardSvg", () => writeClipboardSvg);
  return () => {};
}
