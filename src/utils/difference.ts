/**
 *
 * @param {*} bigSet
 * @param {*} subSet
 *
 * @returns {*[]}
 */
export const difference = (bigSet, subSet) => {
  const arr = [];
  let idx = bigSet.length;
  while (idx--) {
    if (subSet.indexOf(bigSet[idx]) === -1) {
      arr.push(bigSet[idx]);
    }
  }
  return arr;
};
