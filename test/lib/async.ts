/** Resolves after one macrotask turn, letting pending microtasks and zero-delay timers run. */
export const nextTurn = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
