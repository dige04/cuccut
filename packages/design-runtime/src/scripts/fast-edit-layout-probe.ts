/** Read the rendered element's layout without exporting DOM objects over the bridge. */
export interface FastEditLayoutProbe {
  el: string;
  parent: string;
  dir: string;
  align: string;
  cols: string;
}
export function fastEditLayoutProbe(
  selector: string,
): FastEditLayoutProbe | null {
  try {
    const element = document.querySelector(selector);
    if (!element || !element.parentElement) return null;
    const style = getComputedStyle(element);
    const parentStyle = getComputedStyle(element.parentElement);
    return {
      el: style.display,
      parent: parentStyle.display,
      dir: parentStyle.flexDirection,
      align: parentStyle.alignItems,
      cols: parentStyle.gridTemplateColumns,
    };
  } catch {
    return null;
  }
}
