import { apiRequest } from './client';

export interface SubjectItem {
  id: string;
  userId: string;
  name: string;
  code?: string | null;
  teacher?: string | null;
  defaultRoom?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubjectInput {
  name: string;
  code?: string | null;
  teacher?: string | null;
  defaultRoom?: string | null;
}

export const subjectApi = {
  async getSubjects(): Promise<SubjectItem[]> {
    return apiRequest<SubjectItem[]>('/api/subjects');
  },

  async createSubject(data: CreateSubjectInput): Promise<SubjectItem> {
    return apiRequest<SubjectItem>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSubject(id: string, data: Partial<CreateSubjectInput>): Promise<SubjectItem> {
    return apiRequest<SubjectItem>(`/api/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteSubject(id: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/api/subjects/${id}`, {
      method: 'DELETE',
    });
  },
};
