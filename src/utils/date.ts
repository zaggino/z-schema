const isLeapYear = (year: number): boolean => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const getDaysInMonth = (year: number, month: number): number => {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
};

export const isValidRfc3339Date = (year: number, month: number, day: number): boolean => {
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDay = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDay;
};
