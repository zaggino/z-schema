export const difference = (bigSet: any[], subSet: any[]) => {
  const arr = [];
  let idx = bigSet.length;
  while (idx--) {
    if (subSet.indexOf(bigSet[idx]) === -1) {
      arr.push(bigSet[idx]);
    }
  }
  return arr;
};
