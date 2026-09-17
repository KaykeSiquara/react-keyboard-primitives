/**
 * Finding the focusable elements inside a container.
 *
 * The selector below is the boring part. The part that matters is the filter:
 * an element can match the selector and still be unreachable, because it is
 * inside a hidden subtree or has been taken out of the accessibility tree.
 * A focus trap that ignores that will happily move focus somewhere invisible.
 */

const SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex^='-'])",
].join(",");

function isReachable(element: HTMLElement): boolean {
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[inert]") !== null) return false;
  if (element.closest("[hidden]") !== null) return false;

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return true;
  return style.display !== "none" && style.visibility !== "hidden";
}

/** Focusable elements inside `root`, in document order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(isReachable);
}
