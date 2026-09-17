import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./useFocusTrap.js";

export interface DialogProps {
  readonly open: boolean;
  /** Called by Escape, by the backdrop, and by nothing else. */
  readonly onClose: () => void;
  /** Visible title. It becomes the accessible name through aria-labelledby. */
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly initialFocus?: RefObject<HTMLElement | null>;
  readonly closeOnBackdrop?: boolean;
  readonly lockScroll?: boolean;
  /** Portal target. Defaults to `document.body`. */
  readonly container?: HTMLElement | null;
  readonly className?: string;
  readonly backdropClassName?: string;
  readonly titleClassName?: string;
  readonly descriptionClassName?: string;
}

/**
 * A modal dialog.
 *
 * It goes through a portal for a reason that costs people hours: an absolutely
 * positioned dialog rendered in place is clipped by any ancestor with
 * `overflow: hidden`, and it inherits that ancestor's stacking context, so no
 * z-index will lift it out. Rendering into `document.body` sidesteps both.
 *
 * The native `<dialog>` element does most of this now. This one is written out
 * because the behaviour is the point: the trap, the return of focus and the
 * scroll lock are visible here instead of being the browser's business.
 */
export function Dialog(props: DialogProps): ReactNode {
  const {
    open,
    onClose,
    title,
    description,
    children,
    initialFocus,
    closeOnBackdrop = true,
    lockScroll = true,
    container,
    className,
    backdropClassName,
    titleClassName,
    descriptionClassName,
  } = props;

  const reactId = useId();
  const id = `dialog-${reactId.replace(/[:]/g, "")}`;
  const panelRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(panelRef, {
    active: open,
    onEscape: onClose,
    ...(initialFocus ? { initialFocus } : {}),
    lockScroll,
  });

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const target = container ?? document.body;

  return createPortal(
    <>
      <div
        className={backdropClassName}
        // The backdrop is decoration plus a click target. Announcing it would
        // put a nameless element between the user and the dialog.
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
        data-dialog-backdrop=""
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        className={className}
      >
        <h2 id={`${id}-title`} className={titleClassName}>
          {title}
        </h2>
        {description ? (
          <p id={`${id}-description`} className={descriptionClassName}>
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </>,
    target,
  );
}
