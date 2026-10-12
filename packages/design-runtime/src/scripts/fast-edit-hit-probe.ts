/** Describe a rendered click target while respecting imported component boundaries. */
export interface FastEditHitProbe {
  look: {
    behind: string | null;
    size: string;
    weight: string;
    style: string;
    color: string;
    ground: string;
    align: string;
    w: number;
    h: number;
  } | null;
  words: [number, number, number, number][];
  tpl: number | null;
  tag: string;
  own: string;
  all: string;
  kids: number;
  interp: boolean;
  imported: boolean;
  atPath: boolean;
}
export function fastEditHitProbe(
  selector: string,
  templateIndex: number | null,
): FastEditHitProbe | null {
  try {
    let element = document.querySelector(selector);
    let multipleMatches = false;
    let atPath = true;
    const root = document.querySelector(".sc-host:not(.sc-host .sc-host)");
    const hostOf = (candidate: Element): Element | null => {
      return (
        candidate.hasAttribute("data-sc-name") && candidate.parentElement
          ? candidate.parentElement
          : candidate
      ).closest("[data-sc-name]");
    };
    if (templateIndex !== null) {
      const matches = Array.from(
        document.querySelectorAll('[data-dc-tpl="' + templateIndex + '"]'),
      ).filter((candidate) => hostOf(candidate) === root);
      if (!(element && matches.indexOf(element) >= 0)) {
        const descendants = matches.filter(
          (candidate) => element && element.contains(candidate),
        );
        if (descendants.length) {
          element = descendants[0]!;
          multipleMatches = descendants.length > 1;
          atPath = false;
        } else if (matches.length === 1) {
          element = matches[0]!;
          atPath = false;
        }
      }
    }
    if (!element) return null;
    const host = hostOf(element);
    let ownText = "";
    let childElements = 0;
    let hasInterpolation = false;
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) ownText += child.nodeValue;
      else if (child.nodeType === 1) {
        if ((child as Element).classList.contains("sc-interp"))
          hasInterpolation = true;
        else childElements++;
      }
    }
    const templateId = element.getAttribute("data-dc-tpl");
    const words: [number, number, number, number][] = [];
    const textWalker = document.createTreeWalker(element, 4);
    let textNode: Node | null;
    while ((textNode = textWalker.nextNode()) && words.length < 40) {
      if (!textNode.nodeValue!.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rectangles = range.getClientRects();
      for (
        let index = 0;
        index < rectangles.length && words.length < 40;
        index++
      ) {
        const rectangle = rectangles[index]!;
        words.push([
          rectangle.left,
          rectangle.top,
          rectangle.right,
          rectangle.bottom,
        ]);
      }
    }
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const transparentColor = /^(?:transparent|rgba\(\d+, \d+, \d+, 0\))$/;
    let behind: string | null = null;
    for (
      let ancestor = element.parentElement;
      ancestor && behind === null;
      ancestor = ancestor.parentElement
    ) {
      const color = getComputedStyle(ancestor).backgroundColor;
      if (!transparentColor.test(color)) behind = color;
    }
    return {
      look: multipleMatches
        ? null
        : {
            behind,
            size: style.fontSize,
            weight: style.fontWeight,
            style: style.fontStyle,
            color: style.color,
            ground: style.backgroundColor,
            align: style.textAlign,
            w: bounds.width,
            h: bounds.height,
          },
      words,
      tpl:
        templateId !== null && /^\d{1,6}$/.test(templateId)
          ? Number(templateId)
          : null,
      tag: element.localName,
      own: ownText.slice(0, 2000),
      all: multipleMatches ? "" : (element.textContent || "").slice(0, 2000),
      kids: childElements,
      interp: hasInterpolation,
      imported: Boolean(root) && host !== root,
      atPath,
    };
  } catch {
    return null;
  }
}
