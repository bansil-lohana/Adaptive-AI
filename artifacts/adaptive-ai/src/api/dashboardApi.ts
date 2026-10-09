import { apiRequest } from './client';
import { UserProfileData } from './profileApi';
import { TimetableEntryItem } from './timetableApi';

export interface RecentMcqItem {
  id: string;
  userId: string;
  imagePath?: string | null;
  question?: string | null;
  options?: string[] | null;
  answer?: string | null;
  explanation?: string | null;
  confidence?: number | string | null;
  createdAt: string;
}

export interface DashboardData {
  profile: UserProfileData;
  todayClasses: TimetableEntryItem[];
  nextClass: TimetableEntryItem | null;
  upcomingReminders: TimetableEntryItem[];
  recentMcq: RecentMcqItem[];
}

export const dashboardApi = {
  async getDashboard(): Promise<DashboardData> {
    return apiRequest<DashboardData>('/api/dashboard');
  },
};
