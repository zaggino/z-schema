const GUARDED: readonly object[] = [Object.prototype, Array.prototype, Function.prototype];

/**
 * Guards the built-in prototypes for the tests of the enclosing `describe`.
 *
 * Registers an `afterEach` that deletes every key a test left on a prototype in `GUARDED`, so a failing test
 * cannot leave it polluted for the rest of the worker. Returns an assertion that no key was added since the guard
 * was created.
 */
export function guardBuiltinPrototypes(): () => void {
  const before = GUARDED.map((proto) => Reflect.ownKeys(proto));

  afterEach(() => {
    for (let i = 0; i < GUARDED.length; i++) {
      const proto = GUARDED[i] as Record<PropertyKey, unknown>;
      const keys = Reflect.ownKeys(proto);
      for (let k = 0; k < keys.length; k++) {
        if (!before[i].includes(keys[k])) {
          delete proto[keys[k]];
        }
      }
    }
  });

  return () => {
    for (let i = 0; i < GUARDED.length; i++) {
      expect(Reflect.ownKeys(GUARDED[i])).toEqual(before[i]);
    }
  };
}
