import type { ReactNode } from "react";
import { useCombobox, type UseComboboxOptions } from "./useCombobox.js";

export interface ComboboxProps<T> extends UseComboboxOptions<T> {
  /** Visible label. Required: a combobox with no visible label is a trap. */
  readonly label: string;
  readonly placeholder?: string;
  /** Help or error text, wired to the input through aria-describedby. */
  readonly description?: ReactNode;
  readonly emptyMessage?: ReactNode;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly listClassName?: string;
  readonly optionClassName?: string;
  readonly labelClassName?: string;
  readonly descriptionClassName?: string;
}

/**
 * A thin, unstyled shell over `useCombobox`.
 *
 * It renders the markup the pattern requires and nothing else: no wrapper
 * chrome, no theme, no opinion about colour. Everything visual arrives through
 * class names, and `data-active` on the active option is the hook for styling
 * it. Reach for `useCombobox` directly when even this markup is in the way.
 */
export function Combobox<T>(props: ComboboxProps<T>): ReactNode {
  const {
    label,
    placeholder,
    description,
    emptyMessage = "No match.",
    className,
    inputClassName,
    listClassName,
    optionClassName,
    labelClassName,
    descriptionClassName,
    ...hookOptions
  } = props;

  const combobox = useCombobox(hookOptions);
  const inputProps = combobox.getInputProps();
  const listProps = combobox.getListProps();
  const describedBy = description ? `${inputProps.id}-description` : undefined;
  const getLabel = hookOptions.getLabel ?? ((option: T) => String(option));

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={inputProps.id}>
        {label}
      </label>

      <input {...inputProps} placeholder={placeholder} aria-describedby={describedBy} className={inputClassName} />

      <ul
        {...listProps}
        ref={combobox.listRef as React.RefObject<HTMLUListElement>}
        aria-label={label}
        className={listClassName}
      >
        {combobox.items.length === 0 ? (
          // Not an option: an empty list with a role="option" child would
          // announce the message as something selectable.
          <li aria-hidden="true">{emptyMessage}</li>
        ) : (
          combobox.items.map((option, index) => (
            <li key={getLabel(option)} {...combobox.getOptionProps(index)} className={optionClassName}>
              {getLabel(option)}
            </li>
          ))
        )}
      </ul>

      {description ? (
        <span id={describedBy} className={descriptionClassName}>
          {description}
        </span>
      ) : null}
    </div>
  );
}
