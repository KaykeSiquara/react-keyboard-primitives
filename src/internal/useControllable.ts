import { useCallback, useState } from "react";

/**
 * One value that works controlled or uncontrolled.
 *
 * The rule the hook enforces: when the consumer controls the value, the
 * internal state is never written, so there is exactly one source of truth.
 * Writing both is the bug that makes a controlled input flicker back to its
 * old value for one frame.
 */
export function useControllable<T>(
  controlled: T | undefined,
  initial: T,
  onChange?: (value: T) => void,
): readonly [T, (value: T) => void] {
  const [uncontrolled, setUncontrolled] = useState<T>(initial);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : uncontrolled;

  const set = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [value, set] as const;
}
