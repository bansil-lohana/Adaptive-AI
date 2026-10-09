import * as Notifications from 'expo-notifications';
import { ClassSchedule } from '@/models';

export async function requestReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}
export async function scheduleClassReminder(item: ClassSchedule) {
  if (item.reminderMinutes <= 0) return;
  const now = new Date();
  const start = new Date(now);
  const dayOffset = (item.dayOfWeek - now.getDay() + 7) % 7;
  const [hour, minute] = item.startTime.split(':').map(Number);
  start.setDate(now.getDate() + dayOffset);
  start.setHours(hour, minute, 0, 0);
  if (start.getTime() - now.getTime() <= item.reminderMinutes * 60_000) {
    start.setDate(start.getDate() + 7);
  }
  const reminderDate = new Date(start.getTime() - item.reminderMinutes * 60_000);
  if (reminderDate.getTime() <= now.getTime()) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Upcoming class', body: `${item.subject} starts in ${item.reminderMinutes} minutes.\n${item.room ?? 'Room to be announced'}` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
  });
}