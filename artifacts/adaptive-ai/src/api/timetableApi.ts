import { apiRequest, apiUpload } from './client';

export interface TimetableEntryItem {
  id: string;
  userId: string;
  subjectId: string;
  subject: string;
  code?: string | null;
  dayOfWeek: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  room?: string | null;
  teacher?: string | null;
  semester?: string | null;
  notes?: string | null;
  reminderMinutes: number;
  enabled: boolean;
  reminderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimetableEntryInput {
  subjectId?: string;
  subject?: string;
  code?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  teacher?: string | null;
  semester?: string | null;
  notes?: string | null;
  reminderMinutes?: number;
}

export interface ExtractedTimetableDraft {
  subject: string;
  code?: string | null;
  teacher?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  reminderMinutes?: number;
}

export interface ExtractionResult {
  uploadId: string;
  processingStatus: string;
  entries: ExtractedTimetableDraft[];
}

export const timetableApi = {
  async getTimetable(): Promise<TimetableEntryItem[]> {
    return apiRequest<TimetableEntryItem[]>('/api/timetable');
  },

  async getTodayTimetable(): Promise<TimetableEntryItem[]> {
    return apiRequest<TimetableEntryItem[]>('/api/timetable/today');
  },

  async getWeekTimetable(): Promise<TimetableEntryItem[]> {
    return apiRequest<TimetableEntryItem[]>('/api/timetable/week');
  },

  async getNextClass(): Promise<TimetableEntryItem | null> {
    return apiRequest<TimetableEntryItem | null>('/api/timetable/next');
  },

  async getDayTimetable(day: number): Promise<TimetableEntryItem[]> {
    return apiRequest<TimetableEntryItem[]>(`/api/timetable/day/${day}`);
  },

  async createEntry(data: CreateTimetableEntryInput): Promise<TimetableEntryItem> {
    return apiRequest<TimetableEntryItem>('/api/timetable', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateEntry(
    id: string,
    data: Partial<CreateTimetableEntryInput>,
  ): Promise<TimetableEntryItem> {
    return apiRequest<TimetableEntryItem>(`/api/timetable/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteEntry(id: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/api/timetable/${id}`, {
      method: 'DELETE',
    });
  },

  async extractTimetable(
    fileUri: string,
    mimeType = 'image/jpeg',
    fileName = 'timetable.jpg',
  ): Promise<ExtractionResult> {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as unknown as Blob);

    return apiUpload<ExtractionResult>('/api/timetable/extract', formData);
  },

  async confirmTimetable(
    entries: ExtractedTimetableDraft[],
    uploadId?: string,
  ): Promise<TimetableEntryItem[]> {
    return apiRequest<TimetableEntryItem[]>('/api/timetable/confirm', {
      method: 'POST',
      body: JSON.stringify({
        entries,
        uploadId,
      }),
    });
  },
};
