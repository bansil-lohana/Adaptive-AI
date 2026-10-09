import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { UserPreferences, HistoryItem, ClassSchedule, Semester } from '@/models';

const defaults: UserPreferences = { mode: 'automatic', theme: 'light', textSize: 'normal', highContrast: false, largeButtons: false, reduceMotion: false, simplified: false, voiceFeedback: false, autoRead: false, adaptiveUI: true };
const starterClasses: ClassSchedule[] = [
  { id: 'software-engineering', subject: 'Software Engineering', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', room: 'SE-12', teacher: 'Dr. Ahmed', reminderMinutes: 15, semesterId: 'fall-2026', enabled: true },
  { id: 'database-systems', subject: 'Database Systems', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', room: 'DB-04', teacher: 'Dr. Ali', reminderMinutes: 15, semesterId: 'fall-2026', enabled: true },
  { id: 'computer-networks', subject: 'Computer Networks', dayOfWeek: 1, startTime: '14:00', endTime: '15:00', room: 'CN-02', teacher: 'Dr. Sara', reminderMinutes: 15, semesterId: 'fall-2026', enabled: true },
];
const activeSemester: Semester = { id: 'fall-2026', name: 'Fall 2026', isActive: true };
type Ctx = { preferences: UserPreferences; update: (patch: Partial<UserPreferences>) => void; history: HistoryItem[]; addHistory: (item: HistoryItem) => void; clearHistory: () => void; classes: ClassSchedule[]; addClass: (item: ClassSchedule) => void; removeClass: (id: string) => void; clearClasses: () => void; semester: Semester; };
const PreferencesContext = createContext<Ctx | null>(null);
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaults);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [classes, setClasses] = useState<ClassSchedule[]>(starterClasses);
  useEffect(() => { AsyncStorage.multiGet(['adaptive-prefs', 'adaptive-history', 'adaptive-classes']).then(([p, h, c]) => { const storedPreferences = parseJson<Partial<UserPreferences>>(p[1], {}); const storedHistory = parseJson<HistoryItem[]>(h[1], []); const storedClasses = parseJson<ClassSchedule[]>(c[1], starterClasses); setPreferences({ ...defaults, ...storedPreferences }); setHistory(storedHistory); setClasses(storedClasses); }).catch(() => undefined); }, []);
  const update = (patch: Partial<UserPreferences>) => setPreferences(prev => { const next = { ...prev, ...patch }; AsyncStorage.setItem('adaptive-prefs', JSON.stringify(next)); return next; });
  const addHistory = (item: HistoryItem) => setHistory(prev => { const next = [item, ...prev].slice(0, 30); AsyncStorage.setItem('adaptive-history', JSON.stringify(next)); return next; });
  const clearHistory = () => { setHistory([]); AsyncStorage.removeItem('adaptive-history'); };
  const addClass = (item: ClassSchedule) => setClasses(prev => { const next = [...prev.filter(existing => existing.id !== item.id), item]; AsyncStorage.setItem('adaptive-classes', JSON.stringify(next)); return next; });
  const removeClass = (id: string) => setClasses(prev => { const next = prev.filter(item => item.id !== id); AsyncStorage.setItem('adaptive-classes', JSON.stringify(next)); return next; });
  const clearClasses = () => { setClasses([]); AsyncStorage.removeItem('adaptive-classes'); };
  return <PreferencesContext.Provider value={{ preferences, update, history, addHistory, clearHistory, classes, addClass, removeClass, clearClasses, semester: activeSemester }}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() { const value = useContext(PreferencesContext); if (!value) throw new Error('PreferencesProvider is missing'); return value; }

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}