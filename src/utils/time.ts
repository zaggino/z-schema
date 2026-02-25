export const toUtcTime = (
  hour: number,
  minute: number,
  offsetSign: '+' | '-',
  offsetHour: number,
  offsetMinute: number
): { hour: number; minute: number } => {
  const localTotalMinutes = hour * 60 + minute;
  const offsetTotalMinutes = offsetHour * 60 + offsetMinute;
  const utcTotalMinutes =
    offsetSign === '+' ? localTotalMinutes - offsetTotalMinutes : localTotalMinutes + offsetTotalMinutes;
  const normalizedUtcTotalMinutes = ((utcTotalMinutes % 1440) + 1440) % 1440;
  return {
    hour: Math.floor(normalizedUtcTotalMinutes / 60),
    minute: normalizedUtcTotalMinutes % 60,
  };
};

export interface ParsedRfc3339Time {
  hour: number;
  minute: number;
  second: number;
  utcHour: number;
  utcMinute: number;
}

const RFC3339_TIME_REGEX = /^([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]+)?(z|([+-][0-9]{2}:[0-9]{2}))$/i;

export const parseRfc3339Time = (time: string): ParsedRfc3339Time | null => {
  const matches = RFC3339_TIME_REGEX.exec(time);
  if (matches === null) {
    return null;
  }

  const hour = parseInt(matches[1], 10);
  const minute = parseInt(matches[2], 10);
  const second = parseInt(matches[3], 10);
  if (hour > 23 || minute > 59 || second > 60) {
    return null;
  }

  let utcHour = hour;
  let utcMinute = minute;
  if (matches[5].toLowerCase() !== 'z') {
    const offsetMatches = /^([+-])([0-9]{2}):([0-9]{2})$/.exec(matches[5]);
    if (offsetMatches === null) {
      return null;
    }

    const offsetSign = offsetMatches[1] as '+' | '-';
    const offsetHour = parseInt(offsetMatches[2], 10);
    const offsetMinute = parseInt(offsetMatches[3], 10);
    if (offsetHour > 23 || offsetMinute > 59) {
      return null;
    }

    const utc = toUtcTime(hour, minute, offsetSign, offsetHour, offsetMinute);
    utcHour = utc.hour;
    utcMinute = utc.minute;
  }

  if (second === 60 && (utcHour !== 23 || utcMinute !== 59)) {
    return null;
  }

  return {
    hour,
    minute,
    second,
    utcHour,
    utcMinute,
  };
};
