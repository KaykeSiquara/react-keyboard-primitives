import { useEffect, type RefObject } from "react";
import { focusableWithin } from "../internal/focusable.js";

export interface UseFocusTrapOptions {
  /** Whether the trap is armed. Turning it off restores focus. */
  readonly active: boolean;
  /** Called on Escape. The trap never closes anything by itself. */
  readonly onEscape?: () => void;
  /** Where focus should land on open. Defaults to the first focusable. */
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** Where focus should return to. Defaults to whatever had it on open. */
  readonly returnFocus?: RefObject<HTMLElement | null>;
  /** Freeze scrolling on the document element while armed. */
  readonly lockScroll?: boolean;
}

/**
 * A focus trap, written out rather than imported.
 *
 * Three things make it correct, and each of them is a bug when missing.
 *
 * The listener is registered in the capture phase, so Tab is handled before
 * anything inside the dialog can stop the event and let focus escape.
 *
 * The focusable elements are read on every keystroke, not cached on open. A
 * dialog whose contents change, which is most of them, would otherwise cycle
 * through elements that no longer exist.
 *
 * Focus returns to the element that had it, and that element is captured
 * before the dialog renders. Reading it afterwards gives you the dialog.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { active, onEscape, initialFocus, returnFocus, lockScroll = true }: UseFocusTrapOptions,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const doc = container.ownerDocument;
    const previouslyFocused = (returnFocus?.current ?? doc.activeElement) as HTMLElement | null;

    const first = initialFocus?.current ?? focusableWithin(container)[0] ?? container;
    // A container with nothing focusable still has to receive focus, or the
    // next Tab lands behind the dialog.
    if (first === container && !container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    first.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;

      const node = containerRef.current;
      if (!node) return;

      const focusable = focusableWithin(node);
      if (focusable.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }

      const start = focusable[0] as HTMLElement;
      const end = focusable[focusable.length - 1] as HTMLElement;
      const current = doc.activeElement;

      if (!node.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? end : start).focus();
        return;
      }
      if (event.shiftKey && current === start) {
        event.preventDefault();
        end.focus();
        return;
      }
      if (!event.shiftKey && current === end) {
        event.preventDefault();
        start.focus();
      }
    }

    doc.addEventListener("keydown", onKeyDown, true);

    const root = doc.documentElement;
    const previousOverflow = root.style.overflow;
    if (lockScroll) root.style.overflow = "hidden";

    return () => {
      doc.removeEventListener("keydown", onKeyDown, true);
      if (lockScroll) root.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef, initialFocus, lockScroll, onEscape, returnFocus]);
}
