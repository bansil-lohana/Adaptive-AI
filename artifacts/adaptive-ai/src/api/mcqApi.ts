import { apiRequest } from './client';
import { RecentMcqItem } from './dashboardApi';

export const mcqApi = {
  async getHistory(): Promise<RecentMcqItem[]> {
    return apiRequest<RecentMcqItem[]>('/api/mcq/history');
  },

  async getHistoryItem(id: string): Promise<RecentMcqItem> {
    return apiRequest<RecentMcqItem>(`/api/mcq/history/${id}`);
  },

  async deleteHistoryItem(id: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/api/mcq/history/${id}`, {
      method: 'DELETE',
    });
  },
};
