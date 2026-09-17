import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import { nextMatch } from "../internal/typeahead.js";
import { useControllable } from "../internal/useControllable.js";

export interface UseComboboxOptions<T> {
  /** The full list. Filtering happens here, not in the consumer. */
  readonly options: readonly T[];
  /** How to read a label off an option. Defaults to `String(option)`. */
  readonly getLabel?: (option: T) => string;
  /** Controlled text of the input. Leave undefined to let the hook own it. */
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** Fired when an option is committed, by Enter or by pointer. */
  readonly onSelect?: (option: T, index: number) => void;
  /** Defaults to a case-insensitive substring match on the label. */
  readonly filter?: (option: T, query: string, label: string) => boolean;
  /**
   * What a printable character does.
   *
   * `"filter"` types it into the field, which is the behaviour an editable
   * combobox owes the user: you must be able to start a query with any
   * letter. This is the default.
   *
   * `"first-letter"` jumps to the next option starting with that character
   * while the field is empty, the way a select-only combobox behaves. It is
   * faster on a short, known list, and it costs you the ability to type a
   * query beginning with a letter any option starts with. Pick one knowingly.
   */
  readonly typeahead?: "filter" | "first-letter";
  /** Prefix for the generated ids. One is derived from `useId` otherwise. */
  readonly id?: string;
}

export interface ComboboxInputProps {
  readonly id: string;
  readonly role: "combobox";
  readonly value: string;
  readonly autoComplete: "off";
  readonly "aria-expanded": boolean;
  readonly "aria-controls": string;
  readonly "aria-autocomplete": "list";
  readonly "aria-activedescendant": string | undefined;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
}

export interface ComboboxListProps {
  readonly id: string;
  readonly role: "listbox";
  readonly hidden: boolean;
}

export interface ComboboxOptionProps {
  readonly id: string;
  readonly role: "option";
  readonly "aria-selected": boolean;
  readonly "data-active": "" | undefined;
  readonly onMouseDown: (event: MouseEvent) => void;
  readonly onMouseEnter: () => void;
  readonly onClick: () => void;
}

export interface UseComboboxResult<T> {
  readonly isOpen: boolean;
  readonly activeIndex: number;
  /** The options that survived the filter, in display order. */
  readonly items: readonly T[];
  readonly value: string;
  readonly open: () => void;
  readonly close: () => void;
  readonly getInputProps: () => ComboboxInputProps;
  readonly getListProps: () => ComboboxListProps;
  readonly getOptionProps: (index: number) => ComboboxOptionProps;
  /** The element the active option lives in, for scrolling it into view. */
  readonly listRef: React.RefObject<HTMLElement | null>;
}

/**
 * The editable combobox from the WAI-ARIA authoring practices, with one rule
 * held above the others: focus never leaves the input.
 *
 * That rule is why the active option is pointed at with
 * `aria-activedescendant` instead of being focused. A screen reader then
 * announces the option while the typing caret, and everything the user knows
 * about where they are, stays in the field.
 *
 * Arrow keys clamp at the ends instead of wrapping, because wrapping in a
 * filtered list makes it impossible to tell the first result from the last.
 * Type-ahead does wrap, because cycling through every entry starting with the
 * same letter is the whole point of pressing it twice.
 */
export function useCombobox<T>(options: UseComboboxOptions<T>): UseComboboxResult<T> {
  const {
    options: allOptions,
    getLabel = (option: T) => String(option),
    value: controlledValue,
    defaultValue = "",
    onValueChange,
    onSelect,
    filter,
    typeahead = "filter",
    id: idProp,
  } = options;

  const reactId = useId();
  const id = idProp ?? `combobox-${reactId.replace(/[:]/g, "")}`;
  const listId = `${id}-list`;
  const optionId = useCallback((index: number) => `${id}-option-${index}`, [id]);

  const [value, setValue] = useControllable(controlledValue, defaultValue, onValueChange);
  const [isOpen, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLElement | null>(null);

  const matches = useCallback(
    (option: T, query: string) => {
      const label = getLabel(option);
      if (filter) return filter(option, query, label);
      return label.toLowerCase().includes(query.trim().toLowerCase());
    },
    [filter, getLabel],
  );

  const items = useMemo(
    () => (value ? allOptions.filter((option) => matches(option, value)) : allOptions.slice()),
    [allOptions, matches, value],
  );

  const labels = useMemo(() => items.map(getLabel), [items, getLabel]);

  // A filter can shrink the list under the active index. Clamping here keeps
  // aria-activedescendant from pointing at an id that no longer exists.
  useEffect(() => {
    setActiveIndex((current) => (current >= items.length ? items.length - 1 : current));
  }, [items.length]);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = items[index];
      if (option === undefined) return;
      setValue(getLabel(option));
      onSelect?.(option, index);
      close();
    },
    [close, getLabel, items, onSelect, setValue],
  );

  const move = useCallback(
    (delta: number) => {
      setOpen(true);
      setActiveIndex((current) => {
        if (items.length === 0) return -1;
        if (current === -1) return delta > 0 ? 0 : items.length - 1;
        const next = current + delta;
        if (next < 0) return 0;
        if (next > items.length - 1) return items.length - 1;
        return next;
      });
    },
    [items.length],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          move(1);
          return;
        case "ArrowUp":
          event.preventDefault();
          move(-1);
          return;
        case "Home":
          if (!isOpen || items.length === 0) return;
          event.preventDefault();
          setActiveIndex(0);
          return;
        case "End":
          if (!isOpen || items.length === 0) return;
          event.preventDefault();
          setActiveIndex(items.length - 1);
          return;
        case "Enter":
          if (!isOpen || activeIndex < 0) return;
          event.preventDefault();
          commit(activeIndex);
          return;
        case "Escape":
          if (!isOpen) return;
          event.preventDefault();
          close();
          return;
        case "Tab":
          // Tab leaves the field, so the list goes with it. No preventDefault:
          // trapping Tab in a combobox would strand keyboard users.
          if (isOpen) close();
          return;
        default:
          break;
      }

      // Only in first-letter mode, and only while the field is empty. In the
      // default mode a printable character belongs to the query and falls
      // through to the input, which is the whole point of an editable field.
      if (
        typeahead === "first-letter" &&
        event.key.length === 1 &&
        value === "" &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        const hit = nextMatch(labels, activeIndex, event.key);
        if (hit !== -1) {
          event.preventDefault();
          setOpen(true);
          setActiveIndex(hit);
        }
      }
    },
    [activeIndex, close, commit, isOpen, items.length, labels, move, typeahead, value],
  );

  const getInputProps = useCallback(
    (): ComboboxInputProps => ({
      id,
      role: "combobox",
      value,
      autoComplete: "off",
      "aria-expanded": isOpen,
      "aria-controls": listId,
      "aria-autocomplete": "list",
      "aria-activedescendant": isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined,
      onChange: (event) => {
        setValue(event.target.value);
        setOpen(true);
        setActiveIndex(-1);
      },
      onKeyDown,
      onFocus: open,
      onBlur: close,
    }),
    [activeIndex, close, id, isOpen, listId, onKeyDown, open, optionId, setValue, value],
  );

  const getListProps = useCallback(
    (): ComboboxListProps => ({ id: listId, role: "listbox", hidden: !isOpen }),
    [isOpen, listId],
  );

  const getOptionProps = useCallback(
    (index: number): ComboboxOptionProps => ({
      id: optionId(index),
      role: "option",
      "aria-selected": index === activeIndex,
      "data-active": index === activeIndex ? "" : undefined,
      // Stopping mousedown keeps the input from blurring, which would close
      // the list before the click ever lands on the option.
      onMouseDown: (event) => event.preventDefault(),
      onMouseEnter: () => setActiveIndex(index),
      onClick: () => commit(index),
    }),
    [activeIndex, commit, optionId],
  );

  // Keeping the active option in view is a side effect of the active index,
  // not of the key that changed it, so pointer and keyboard behave the same.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const element = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex))}`);
    element?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isOpen, optionId]);

  return {
    isOpen,
    activeIndex,
    items,
    value,
    open,
    close,
    getInputProps,
    getListProps,
    getOptionProps,
    listRef,
  };
}
