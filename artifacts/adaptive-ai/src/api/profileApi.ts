import { apiRequest, apiUpload } from './client';

export interface UserProfileData {
  id: string;
  fullName: string;
  email: string;
  studentId?: string | null;
  department?: string | null;
  semester?: number | null;
  profileImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  studentId?: string | null;
  department?: string | null;
  semester?: number | null;
}

export const profileApi = {
  async getProfile(): Promise<UserProfileData> {
    return apiRequest<UserProfileData>('/api/profile');
  },

  async updateProfile(patch: UpdateProfileInput): Promise<UserProfileData> {
    return apiRequest<UserProfileData>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },

  async uploadAvatar(imageUri: string, mimeType = 'image/jpeg'): Promise<UserProfileData> {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'avatar.jpg';
    // React Native FormData file shape
    formData.append('image', {
      uri: imageUri,
      type: mimeType,
      name: filename,
    } as unknown as Blob);

    return apiUpload<UserProfileData>('/api/profile/avatar', formData);
  },
};
