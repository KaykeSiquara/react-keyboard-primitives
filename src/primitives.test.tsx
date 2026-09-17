import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./combobox/Combobox.js";
import { Dialog } from "./dialog/Dialog.js";
import { focusableWithin } from "./internal/focusable.js";
import { nextMatch } from "./internal/typeahead.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function activeOptionOf(input: HTMLElement): HTMLElement | null {
  const id = input.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

/* ============================================================
   type-ahead
   ============================================================ */

describe("nextMatch", () => {
  it("finds the first match after the current index", () => {
    expect(nextMatch(MONTHS, -1, "j")).toBe(0);
    expect(nextMatch(MONTHS, 0, "j")).toBe(5);
    expect(nextMatch(MONTHS, 5, "j")).toBe(6);
  });

  it("wraps past the end, which is what makes repeats cycle", () => {
    expect(nextMatch(MONTHS, 6, "j")).toBe(0);
  });

  it("ignores case", () => {
    expect(nextMatch(MONTHS, -1, "D")).toBe(11);
  });

  it("returns -1 for no match, for whitespace and for an empty list", () => {
    expect(nextMatch(MONTHS, -1, "z")).toBe(-1);
    expect(nextMatch(MONTHS, -1, " ")).toBe(-1);
    expect(nextMatch([], -1, "j")).toBe(-1);
  });
});

/* ============================================================
   focusableWithin
   ============================================================ */

describe("focusableWithin", () => {
  it("keeps what can be reached and drops what cannot", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button>one</button>
      <button disabled>skipped, disabled</button>
      <input type="hidden" value="skipped, hidden input">
      <a href="#x">two</a>
      <a>skipped, no href</a>
      <div tabindex="0">three</div>
      <div tabindex="-1">skipped, negative tabindex</div>
      <button aria-hidden="true">skipped, aria-hidden</button>
      <div hidden><button>skipped, inside hidden</button></div>
    `;
    document.body.append(root);

    expect(focusableWithin(root).map((el) => el.textContent?.trim())).toEqual([
      "one",
      "two",
      "three",
    ]);

    root.remove();
  });
});

/* ============================================================
   combobox
   ============================================================ */

describe("Combobox", () => {
  const setup = (props: Partial<React.ComponentProps<typeof Combobox<string>>> = {}) => {
    const onSelect = vi.fn();
    render(<Combobox label="Accounting period" options={MONTHS} onSelect={onSelect} {...props} />);
    return { onSelect, input: screen.getByRole("combobox", { name: "Accounting period" }) };
  };

  it("carries the attributes the pattern requires", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("listbox", { hidden: true }).id);
  });

  it("opens on focus and lists every option", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(12);
  });

  it("walks the list with the arrows and never moves focus off the input", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);

    await user.keyboard("{ArrowDown}");
    expect(activeOptionOf(input)).toHaveTextContent("January");

    await user.keyboard("{ArrowDown}");
    expect(activeOptionOf(input)).toHaveTextContent("February");

    await user.keyboard("{ArrowUp}");
    expect(activeOptionOf(input)).toHaveTextContent("January");

    // The invariant the whole component exists to hold.
    expect(input).toHaveFocus();
  });

  it("opens upwards from the end of the list", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);

    await user.keyboard("{ArrowUp}");
    expect(activeOptionOf(input)).toHaveTextContent("December");
  });

  it("clamps at both ends instead of wrapping", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);

    await user.keyboard("{Home}{ArrowUp}{ArrowUp}");
    expect(activeOptionOf(input)).toHaveTextContent("January");

    await user.keyboard("{End}{ArrowDown}{ArrowDown}");
    expect(activeOptionOf(input)).toHaveTextContent("December");
  });

  it("jumps to the ends with Home and End", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);

    await user.keyboard("{End}");
    expect(activeOptionOf(input)).toHaveTextContent("December");

    await user.keyboard("{Home}");
    expect(activeOptionOf(input)).toHaveTextContent("January");
  });

  it("types the letter into the field by default, so any query can be started", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.keyboard("j");

    expect(input).toHaveValue("j");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "January",
      "June",
      "July",
    ]);
  });

  it("cycles through every option starting with the typed letter in first-letter mode", async () => {
    const user = userEvent.setup();
    const { input } = setup({ typeahead: "first-letter" });
    await user.click(input);

    await user.keyboard("j");
    expect(activeOptionOf(input)).toHaveTextContent("January");
    await user.keyboard("j");
    expect(activeOptionOf(input)).toHaveTextContent("June");
    await user.keyboard("j");
    expect(activeOptionOf(input)).toHaveTextContent("July");
    await user.keyboard("j");
    expect(activeOptionOf(input)).toHaveTextContent("January");

    // Type-ahead moves the active option, it does not type into the field.
    expect(input).toHaveValue("");
  });

  it("filters once there is a query, and stops using type-ahead", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.keyboard("ju");

    expect(input).toHaveValue("ju");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["June", "July"]);
  });

  it("commits the active option with Enter and closes", async () => {
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(input).toHaveValue("February");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onSelect).toHaveBeenCalledWith("February", 1);
  });

  it("does nothing on Enter when no option is active", async () => {
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    await user.click(input);
    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  it("closes on Escape without changing the value", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.keyboard("{ArrowDown}{Escape}");

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("shows the empty message instead of an empty listbox", async () => {
    const user = userEvent.setup();
    const { input } = setup({ emptyMessage: "No accounting period matches that." });
    await user.click(input);
    await user.keyboard("zzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No accounting period matches that.")).toBeInTheDocument();
  });

  it("commits on click without the input ever losing focus first", async () => {
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "March" }));

    expect(onSelect).toHaveBeenCalledWith("March", 2);
    expect(input).toHaveValue("March");
  });

  it("ties the description to the input through aria-describedby", () => {
    setup({ description: "Arrows to move, Enter confirms." });
    const input = screen.getByRole("combobox", { name: "Accounting period" });
    const describedBy = input.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Arrows to move, Enter confirms.",
    );
  });
});

/* ============================================================
   dialog
   ============================================================ */

function DialogHarness({ onClose }: { readonly onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <>
      <button onClick={() => setOpen(true)}>Open confirmation</button>
      <Dialog
        open={open}
        onClose={close}
        title="Delete batch"
        description="Six documents will be removed."
      >
        <button onClick={close}>Confirm</button>
        <button onClick={close}>Cancel</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("renders nothing while closed", () => {
    render(<DialogHarness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is named and described by its own content", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open confirmation" }));

    const dialog = screen.getByRole("dialog", { name: "Delete batch" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Six documents will be removed.");
  });

  it("moves focus into the dialog on open", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open confirmation" }));

    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });

  it("cycles Tab inside and never reaches the opener", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open confirmation" }));

    const confirm = screen.getByRole("button", { name: "Confirm" });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
  });

  it("cycles backwards with Shift and Tab", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open confirmation" }));

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes on Escape and hands focus back to the opener", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);

    const opener = screen.getByRole("button", { name: "Open confirmation" });
    await user.click(opener);
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("locks and restores the scroll of the document", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const before = document.documentElement.style.overflow;

    await user.click(screen.getByRole("button", { name: "Open confirmation" }));
    expect(document.documentElement.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(document.documentElement.style.overflow).toBe(before);
  });

  it("honours an explicit initial focus", async () => {
    function WithInitialFocus() {
      const [open, setOpen] = useState(false);
      const cancelRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Careful" initialFocus={cancelRef}>
            <button>Confirm</button>
            <button ref={cancelRef}>Cancel</button>
          </Dialog>
        </>
      );
    }

    const user = userEvent.setup();
    render(<WithInitialFocus />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes on the backdrop only when asked to", async () => {
    function WithoutBackdropClose() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onClose={() => setOpen(false)} title="Stay" closeOnBackdrop={false}>
          <button>Confirm</button>
        </Dialog>
      );
    }

    const user = userEvent.setup();
    render(<WithoutBackdropClose />);
    const backdrop = document.querySelector("[data-dialog-backdrop]") as HTMLElement;

    await user.click(backdrop);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
