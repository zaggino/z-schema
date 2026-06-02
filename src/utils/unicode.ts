/**
 * Returns the number of Unicode code points in the string.
 * Uses a surrogate-aware charCodeAt scan (equivalent to the string iterator)
 * that counts a surrogate pair as one code point and lone surrogates as one each.
 */
export function unicodeLength(str: string): number {
  let count = str.length;
  for (let i = 0; i < str.length - 1; i++) {
    const hi = str.charCodeAt(i);
    if (hi >= 0xd8_00 && hi <= 0xdb_ff) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc_00 && lo <= 0xdf_ff) {
        count--;
        i++;
      }
    }
  }
  return count;
}
