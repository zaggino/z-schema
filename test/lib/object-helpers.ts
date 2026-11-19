// Freezes a value and everything reachable from it, so that a write to the source fails.
export const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    const children = Object.values(value);
    for (let i = 0; i < children.length; i++) {
      deepFreeze(children[i]);
    }
  }
  return value;
};

// An object with `count` nested levels: the innermost one sits at depth count - 1.
export const nest = (count: number): Record<string, unknown> => {
  const root: Record<string, unknown> = {};
  let current = root;
  for (let i = 1; i < count; i++) {
    const next: Record<string, unknown> = {};
    current.not = next;
    current = next;
  }
  return root;
};
