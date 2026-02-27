/**
 * Returns the number of Unicode code points in the string.
 * Uses the built-in string iterator which correctly handles surrogate pairs.
 */
export function unicodeLength(str: string): number {
  let count = 0;
  for (const _cp of str) {
    void _cp;
    count++;
  }
  return count;
}
