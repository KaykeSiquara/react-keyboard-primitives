/**
 * Type-ahead over a list of labels.
 *
 * Pure on purpose: no React, no DOM. The behaviour that is easy to get wrong
 * is the wrap-around, and a pure function is the cheapest place to prove it.
 */

/**
 * The next index whose label starts with `letter`, searching forward from
 * `from` and wrapping past the end. Returns -1 when nothing matches.
 *
 * `from` is the currently active index, so the search starts at `from + 1`.
 * That is what makes repeated presses of the same letter cycle through every
 * match instead of sticking on the first one.
 */
export function nextMatch(
  labels: readonly string[],
  from: number,
  letter: string,
): number {
  const needle = letter.toLowerCase();
  if (needle.length !== 1 || !needle.trim()) return -1;
  if (labels.length === 0) return -1;

  const start = from < -1 ? -1 : from;
  for (let step = 1; step <= labels.length; step += 1) {
    const index = (start + step + labels.length) % labels.length;
    if (labels[index]?.toLowerCase().startsWith(needle)) return index;
  }
  return -1;
}
