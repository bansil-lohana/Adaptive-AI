import { combineDateAndTime } from "./time";

export function getNextClass<T extends { dayOfWeek: number; startTime: string; endTime: string }>(
  entries: T[],
  now = new Date(),
): T | null {
  if (entries.length === 0) return null;
  const ranked = entries
    .map((entry) => {
      const start = combineDateAndTime(now, entry.dayOfWeek, entry.startTime);
      const end = combineDateAndTime(now, entry.dayOfWeek, entry.endTime);
      if (end <= now) {
        start.setDate(start.getDate() + 7);
        end.setDate(end.getDate() + 7);
      }
      return { entry, start };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return ranked[0]?.entry ?? null;
}
