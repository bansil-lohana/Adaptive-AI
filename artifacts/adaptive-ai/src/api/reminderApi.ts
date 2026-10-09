import { apiRequest } from './client';

export interface ReminderItem {
  id: string;
  userId: string;
  timetableEntryId: string;
  minutesBefore: number;
  enabled: boolean;
  notificationTitle?: string | null;
  notificationBody?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  timetableEntryId: string;
  minutesBefore: number;
  enabled?: boolean;
  notificationTitle?: string | null;
  notificationBody?: string | null;
}

export const reminderApi = {
  async getReminders(): Promise<ReminderItem[]> {
    return apiRequest<ReminderItem[]>('/api/reminders');
  },

  async createReminder(data: CreateReminderInput): Promise<ReminderItem> {
    return apiRequest<ReminderItem>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateReminder(id: string, data: Partial<CreateReminderInput>): Promise<ReminderItem> {
    return apiRequest<ReminderItem>(`/api/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteReminder(id: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/api/reminders/${id}`, {
      method: 'DELETE',
    });
  },
};
