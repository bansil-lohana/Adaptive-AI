export function normalizeTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return value;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

export function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = normalizeTime(value).split(":").map(Number);
  return hours * 60 + minutes;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function combineDateAndTime(base: Date, dayOfWeek: number, time: string): Date {
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  const result = new Date(base);
  const offset = (dayOfWeek - base.getDay() + 7) % 7;
  result.setDate(base.getDate() + offset);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
