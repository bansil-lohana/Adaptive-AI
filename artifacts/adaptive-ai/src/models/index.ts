export type InteractionMode = 'touch' | 'voice' | 'camera' | 'automatic';
export type ThemeMode = 'light' | 'dark' | 'system';
export type TextSize = 'small' | 'normal' | 'large' | 'extraLarge';
export interface UserPreferences {
  mode: InteractionMode;
  theme: ThemeMode;
  textSize: TextSize;
  highContrast: boolean;
  largeButtons: boolean;
  reduceMotion: boolean;
  simplified: boolean;
  voiceFeedback: boolean;
  autoRead: boolean;
  adaptiveUI: boolean;
}
export interface HistoryItem { id: string; title: string; type: 'Voice' | 'Camera' | 'Text'; preview: string; timestamp: string; response: string; }
export interface ClassSchedule {
  id: string; subject: string; dayOfWeek: number; startTime: string; endTime: string;
  room?: string; teacher?: string; reminderMinutes: number; semesterId: string; enabled: boolean;
}
export interface Semester { id: string; name: string; isActive: boolean; }
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUri?: string;
}