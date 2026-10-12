/** The original app.js prefix chooses the system theme only before a theme exists. */
export function initializeThemeFromSystem(): void {
  try {
    const root = document.documentElement;
    if (!root.getAttribute("data-theme")) {
      root.setAttribute(
        "data-theme",
        matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      );
    }
  } catch {
    // A denied or unavailable browser environment leaves the existing theme intact.
  }
}
