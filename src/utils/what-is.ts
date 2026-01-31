export const whatIs = (what) => {
  const to = typeof what;

  if (to === 'object') {
    if (what === null) {
      return 'null';
    }
    if (Array.isArray(what)) {
      return 'array';
    }
    return 'object'; // typeof what === 'object' && what === Object(what) && !Array.isArray(what);
  }

  if (to === 'number') {
    if (Number.isFinite(what)) {
      if (what % 1 === 0) {
        return 'integer';
      } else {
        return 'number';
      }
    }
    if (Number.isNaN(what)) {
      return 'not-a-number';
    }
    return 'unknown-number';
  }

  return to; // undefined, boolean, string, function
};
