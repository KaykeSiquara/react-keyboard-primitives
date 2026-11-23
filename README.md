# react-keyboard-primitives

Two React primitives whose keyboard behaviour is the product: a combobox that
never moves focus off the input, and a dialog with a focus trap written out
rather than imported. Headless and unstyled. No runtime dependencies.

These came out of an internal system with 117 dense screens where every control
had to be reachable from the keyboard. They are small on purpose. If you need a
full component library, use one. If you need these two to be correct, they are
here with the tests that say so.

## Install

```sh
npm install github:KaykeSiquara/react-keyboard-primitives
```

Not on the npm registry yet: this installs straight from GitHub and builds on
install. Imports stay `@kaykesiquara/react-keyboard-primitives`.

React 18 or 19, as a peer dependency. Node 20 or newer to build from source, and 22 or newer to run the tests.

## Combobox

```tsx
import { Combobox } from "@kaykesiquara/react-keyboard-primitives";

<Combobox
  label="Accounting period"
  options={months}
  description="Arrows to move, Home and End for the ends, Enter confirms, Esc closes."
  onSelect={(month) => setPeriod(month)}
/>;
```

| Key | What happens |
| --- | --- |
| `ArrowDown` `ArrowUp` | Moves the active option. Opens the list if it was closed. |
| `Home` `End` | First and last option. |
| `Enter` | Commits the active option and closes. |
| `Esc` | Closes without changing the value. |
| `Tab` | Closes and leaves. Never trapped. |
| printable | Types into the field and filters. See the note below. |

### Focus never leaves the input

That is the one rule the component exists to hold. The active option is pointed
at with `aria-activedescendant` instead of being focused, so a screen reader
announces it while the typing caret, and everything the user knows about where
they are, stays in the field.

Every keyboard test asserts it:

```ts
expect(input).toHaveFocus();
```

### Arrows clamp, type-ahead wraps

Arrow keys stop at the ends. In a filtered list, wrapping makes it impossible
to tell the first result from the last, and the user loses the sense of how
long the list is.

First-letter type-ahead does wrap, because cycling through every entry starting
with the same letter is the reason you press it twice.

### The type-ahead trade-off

This is the decision worth reading before you pick a mode.

`typeahead="filter"`, the default, types the character into the field. An
editable combobox owes the user that: you have to be able to start a query with
any letter.

`typeahead="first-letter"` jumps to the next option starting with that
character while the field is empty, the way a select-only combobox behaves. It
is faster on a short, known list. It also means you can never type a query that
begins with a letter some option begins with, because the key is swallowed
before it reaches the field.

The two behaviours belong to two different patterns and mixing them silently is
a bug. A test asserts each one, so the choice stays visible.

### Headless

`useCombobox` returns prop getters and no markup:

```tsx
const combobox = useCombobox({ options: months });

<input {...combobox.getInputProps()} />
<ul {...combobox.getListProps()} ref={combobox.listRef}>
  {combobox.items.map((month, i) => (
    <li key={month} {...combobox.getOptionProps(i)}>{month}</li>
  ))}
</ul>;
```

The `Combobox` component is a thin shell over it. `data-active` marks the
active option for styling.

## Dialog

```tsx
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Delete batch"
  description="Six documents will be removed. This cannot be undone."
>
  <button onClick={remove}>Delete batch</button>
  <button onClick={() => setOpen(false)}>Keep documents</button>
</Dialog>
```

On open, focus moves inside. `Tab` cycles only through the controls in the
dialog, `Shift` + `Tab` cycles backwards, `Esc` closes, and focus returns to
whatever had it before. Scrolling on the document is frozen while it is open.

### Three things that make the trap correct

Each of them is a bug when it is missing, and each has a test.

The key listener runs in the **capture phase**, so `Tab` is handled before
anything inside the dialog can stop the event and let focus escape.

The focusable elements are read **on every keystroke**, not cached on open. A
dialog whose contents change, which is most of them, would otherwise cycle
through elements that no longer exist.

The element to return focus to is captured **before the dialog renders**.
Reading `document.activeElement` afterwards gives you the dialog.

### Why a portal

An absolutely positioned dialog rendered in place is clipped by any ancestor
with `overflow: hidden`, and it inherits that ancestor's stacking context, so
no `z-index` will lift it out. Rendering into `document.body` sidesteps both.

### Why not `<dialog>`

The native element does most of this now, and in an application you should
probably use it. This one is written out because the behaviour is the point:
the trap, the return of focus and the scroll lock are visible here instead of
being the browser's business.

## What is not here

No styling, no theme, no animation, no portal target management, no
virtualisation, no multi-select, no async loading. Every one of those is a
reason to reach for a larger library instead.

## Tests

29 tests, on Vitest with Testing Library and jsdom. They are written against
accessible behaviour, which means role, accessible name and keyboard, not class
names or component internals. Reworking the markup does not break them.

```sh
npm install
npm test
npm run typecheck
npm run build
```

CI runs the suite on Node 22 and 24, and once more against React 19.

## Licence

MIT. See [LICENSE](LICENSE).
