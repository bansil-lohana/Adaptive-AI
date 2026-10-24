import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClassSchedule } from '@/models';
import type { DashboardData } from './dashboardApi';
import type { UserProfileData } from './profileApi';
import type { TimetableEntryItem } from './timetableApi';

const CLASS_KEY = 'adaptive-classes';
const CONVERSATION_KEY = 'adaptive-offline-conversations';
const SUBJECT_KEY = 'adaptive-offline-subjects';
const REMINDER_KEY = 'adaptive-offline-reminders';
const PROFILE_KEY = 'adaptive-offline-profile';
const MOCK_USER_ID = 'offline-demo-user';

export function isOfflineMockMode(): boolean {
  return process.env.EXPO_PUBLIC_OFFLINE_MOCK_MODE === 'true';
}

export async function handleOfflineMock<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const path = endpoint.split('?')[0];
  const method = (options.method ?? 'GET').toUpperCase();
  const body = readBody(options.body);
  let result: unknown;

  if (path === '/api/dashboard' && method === 'GET') {
    result = await getDashboard();
  } else if (path === '/api/timetable' && method === 'GET') {
    result = await listTimetable();
  } else if (path === '/api/timetable/today' && method === 'GET') {
    result = (await listTimetable()).filter(entry => entry.dayOfWeek === new Date().getDay());
  } else if (path === '/api/timetable/week' && method === 'GET') {
    result = await listTimetable();
  } else if (path === '/api/timetable/next' && method === 'GET') {
    result = await nextTimetableEntry();
  } else if (path.startsWith('/api/timetable/day/') && method === 'GET') {
    const day = Number(path.split('/').at(-1));
    result = (await listTimetable()).filter(entry => entry.dayOfWeek === day);
  } else if (path === '/api/timetable' && method === 'POST') {
    result = await createTimetableEntry(body);
  } else if (path === '/api/timetable/confirm' && method === 'POST') {
    result = await confirmTimetable(body);
  } else if (path === '/api/timetable/extract' && method === 'POST') {
    result = {
      uploadId: `offline-demo-upload-${Date.now()}`,
      processingStatus: 'offline-demo-sample',
      entries: [{
        subject: 'Demo class (sample)',
        dayOfWeek: new Date().getDay(),
        startTime: '16:00',
        endTime: '17:00',
        room: 'Sample room',
        teacher: 'Demo teacher',
        reminderMinutes: 15,
      }],
    };
  } else if (path.startsWith('/api/timetable/') && method === 'DELETE') {
    result = await deleteTimetableEntry(path.split('/').at(-1) ?? '');
  } else if (path.startsWith('/api/timetable/') && method === 'PUT') {
    result = await updateTimetableEntry(path.split('/').at(-1) ?? '', body);
  } else if (path === '/api/profile' && method === 'GET') {
    result = await getProfile();
  } else if (path === '/api/profile' && method === 'PUT') {
    result = await updateProfile(body);
  } else if (path === '/api/profile/avatar' && method === 'POST') {
    result = await getProfile();
  } else if (path === '/api/subjects' && method === 'GET') {
    result = await load<unknown[]>(SUBJECT_KEY, []);
  } else if (path === '/api/subjects' && method === 'POST') {
    result = await createStoredRecord(SUBJECT_KEY, body);
  } else if (path.startsWith('/api/subjects/') && method === 'PUT') {
    result = await updateStoredRecord(SUBJECT_KEY, path.split('/').at(-1) ?? '', body);
  } else if (path.startsWith('/api/subjects/') && method === 'DELETE') {
    result = await deleteStoredRecord(SUBJECT_KEY, path.split('/').at(-1) ?? '');
  } else if (path === '/api/reminders' && method === 'GET') {
    result = await load<unknown[]>(REMINDER_KEY, []);
  } else if (path === '/api/reminders' && method === 'POST') {
    result = await createStoredRecord(REMINDER_KEY, body);
  } else if (path.startsWith('/api/reminders/') && method === 'PUT') {
    result = await updateStoredRecord(REMINDER_KEY, path.split('/').at(-1) ?? '', body);
  } else if (path.startsWith('/api/reminders/') && method === 'DELETE') {
    result = await deleteStoredRecord(REMINDER_KEY, path.split('/').at(-1) ?? '');
  } else if (path === '/api/ai/chat' && method === 'POST') {
    result = await mockChat(body);
  } else if (path === '/api/ai/voice' && method === 'POST') {
    result = { answer: 'Offline demo response: voice recording received. Connect to the API for transcription and an AI-generated answer.' };
  } else if ((path === '/api/ai/image' || path === '/api/ai/vision') && method === 'POST') {
    result = { answer: 'Offline demo response: image received. Connect to the API for image analysis and an AI-generated explanation.' };
  } else if (path === '/api/ai/explain' && method === 'POST') {
    result = { answer: `Offline demo response: connect to the API for an AI explanation of your text.` };
  } else if (path === '/api/ai/generate' && method === 'POST') {
    result = { answer: 'Offline demo response: connect to the API for AI-generated study help.' };
  } else if (path === '/api/ai/conversations' && method === 'GET') {
    result = await load<unknown[]>(CONVERSATION_KEY, []);
  } else if (path === '/api/ai/conversations' && method === 'POST') {
    result = await createStoredRecord(CONVERSATION_KEY, body);
  } else if (/^\/api\/ai\/conversations\/[^/]+$/.test(path) && method === 'GET') {
    const id = path.split('/').at(-1);
    const conversation = (await load<Array<{ id: string }>>(CONVERSATION_KEY, [])).find(item => item.id === id);
    if (!conversation) throw new Error('Conversation not found in offline demo data.');
    result = conversation;
  } else if (/^\/api\/ai\/conversations\/[^/]+\/messages$/.test(path) && method === 'POST') {
    result = await appendConversationMessage(path.split('/').at(-2) ?? '', body);
  } else if (path.startsWith('/api/ai/conversations/') && method === 'DELETE') {
    result = await deleteStoredRecord(CONVERSATION_KEY, path.split('/').at(-1) ?? '');
  } else if (path === '/api/ai/mcq' && method === 'POST') {
    result = {
      question: null,
      options: [],
      answer: null,
      explanation: 'Offline demo mode cannot read or solve questions from images.',
      confidence: 0,
    };
  } else if (path === '/api/mcq/history' && method === 'GET') {
    result = [];
  } else if (path.startsWith('/api/mcq/history/') && method === 'DELETE') {
    result = { id: path.split('/').at(-1) ?? '' };
  } else {
    throw new Error(`Offline demo mode does not implement ${method} ${path}.`);
  }

  return result as T;
}

async function getDashboard(): Promise<DashboardData> {
  const entries = await listTimetable();
  const today = new Date().getDay();
  const todayClasses = entries.filter(entry => entry.dayOfWeek === today && entry.enabled);
  const profile = await getProfile();
  return {
    profile: {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
    },
    todayClasses,
    nextClass: findNextEntry(entries),
    upcomingReminders: entries.filter(entry => entry.dayOfWeek !== today && entry.enabled),
    recentMcq: [],
  };
}

async function getProfile(): Promise<UserProfileData> {
  return load<UserProfileData>(PROFILE_KEY, {
    id: MOCK_USER_ID,
    fullName: 'Offline Student',
    email: 'student@example.test',
  });
}

async function updateProfile(body: Record<string, unknown>): Promise<UserProfileData> {
  const current = await getProfile();
  const next = {
    ...current,
    ...(typeof body.fullName === 'string' ? { fullName: body.fullName } : {}),
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

async function listTimetable(): Promise<TimetableEntryItem[]> {
  const classes = await load<ClassSchedule[]>(CLASS_KEY, []);
  return classes.map(toTimetableEntry);
}

async function nextTimetableEntry(): Promise<TimetableEntryItem | null> {
  const entries = await listTimetable();
  return findNextEntry(entries);
}

function findNextEntry(entries: TimetableEntryItem[]): TimetableEntryItem | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return entries
    .filter(entry => entry.enabled)
    .map(entry => ({
      entry,
      daysUntil: (entry.dayOfWeek - now.getDay() + 7) % 7,
      startMinutes: timeToMinutes(entry.startTime),
    }))
    .filter(item => item.daysUntil > 0 || item.startMinutes >= nowMinutes)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.startMinutes - b.startMinutes)[0]?.entry ?? null;
}

async function createTimetableEntry(body: Record<string, unknown>): Promise<TimetableEntryItem> {
  const classes = await load<ClassSchedule[]>(CLASS_KEY, []);
  const entry = fromTimetableBody(body);
  await AsyncStorage.setItem(CLASS_KEY, JSON.stringify([...classes, entry]));
  return toTimetableEntry(entry);
}

async function confirmTimetable(body: Record<string, unknown>): Promise<TimetableEntryItem[]> {
  const classes = await load<ClassSchedule[]>(CLASS_KEY, []);
  const entries = Array.isArray(body.entries)
    ? body.entries.map(item => fromTimetableBody(item as Record<string, unknown>))
    : [];
  await AsyncStorage.setItem(CLASS_KEY, JSON.stringify([...classes, ...entries]));
  return entries.map(toTimetableEntry);
}

async function updateTimetableEntry(id: string, body: Record<string, unknown>): Promise<TimetableEntryItem> {
  const classes = await load<ClassSchedule[]>(CLASS_KEY, []);
  const updated = classes.map(item => item.id === id ? {
    ...item,
    ...(typeof body.subject === 'string' ? { subject: body.subject } : {}),
    ...(typeof body.dayOfWeek === 'number' ? { dayOfWeek: body.dayOfWeek } : {}),
    ...(typeof body.startTime === 'string' ? { startTime: body.startTime } : {}),
    ...(typeof body.endTime === 'string' ? { endTime: body.endTime } : {}),
    ...(typeof body.room === 'string' || body.room === null ? { room: body.room ?? undefined } : {}),
    ...(typeof body.teacher === 'string' || body.teacher === null ? { teacher: body.teacher ?? undefined } : {}),
    ...(typeof body.reminderMinutes === 'number' ? { reminderMinutes: body.reminderMinutes } : {}),
    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
  } : item);
  const match = updated.find(item => item.id === id);
  if (!match) throw new Error('Class not found in offline timetable.');
  await AsyncStorage.setItem(CLASS_KEY, JSON.stringify(updated));
  return toTimetableEntry(match);
}

async function deleteTimetableEntry(id: string): Promise<{ id: string }> {
  const classes = await load<ClassSchedule[]>(CLASS_KEY, []);
  await AsyncStorage.setItem(CLASS_KEY, JSON.stringify(classes.filter(item => item.id !== id)));
  return { id };
}

function fromTimetableBody(body: Record<string, unknown>): ClassSchedule {
  return {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subject: typeof body.subject === 'string' ? body.subject : 'New class',
    dayOfWeek: typeof body.dayOfWeek === 'number' ? body.dayOfWeek : new Date().getDay(),
    startTime: typeof body.startTime === 'string' ? body.startTime : '16:00',
    endTime: typeof body.endTime === 'string' ? body.endTime : '17:00',
    room: typeof body.room === 'string' ? body.room : undefined,
    teacher: typeof body.teacher === 'string' ? body.teacher : undefined,
    reminderMinutes: typeof body.reminderMinutes === 'number' ? body.reminderMinutes : 15,
    semesterId: 'offline',
    enabled: true,
  };
}

function toTimetableEntry(item: ClassSchedule): TimetableEntryItem {
  const now = new Date().toISOString();
  return {
    id: item.id,
    userId: MOCK_USER_ID,
    subjectId: item.id,
    subject: item.subject,
    dayOfWeek: item.dayOfWeek,
    startTime: item.startTime,
    endTime: item.endTime,
    room: item.room ?? null,
    teacher: item.teacher ?? null,
    semester: item.semesterId,
    reminderMinutes: item.reminderMinutes,
    enabled: item.enabled,
    createdAt: now,
    updatedAt: now,
  };
}

async function appendConversationMessage(id: string, body: Record<string, unknown>) {
  const conversations = await load<Array<{
    id: string;
    messages?: Array<{ id: string; conversationId: string; role: string; content: string; createdAt: string }>;
  }>>(CONVERSATION_KEY, []);
  const content = typeof body.content === 'string' ? body.content : '';
  const now = new Date().toISOString();
  const message = {
    id: `offline-reply-${Date.now()}`,
    conversationId: id,
    role: 'assistant',
    content: 'Offline demo response: connect to the API for a personalized AI answer.',
    createdAt: now,
  };
  const next = conversations.map(item => item.id === id
    ? { ...item, updatedAt: now, messages: [...(item.messages ?? []), { id: `offline-user-${Date.now()}`, conversationId: id, role: 'user', content, createdAt: now }, message] }
    : item);
  if (!next.some(item => item.id === id)) throw new Error('Conversation not found in offline demo data.');
  await AsyncStorage.setItem(CONVERSATION_KEY, JSON.stringify(next));
  return message;
}

async function mockChat(body: Record<string, unknown>) {
  const now = new Date().toISOString();
  const conversationId = typeof body.conversationId === 'string'
    ? body.conversationId
    : `offline-conversation-${Date.now()}`;
  const prompt = typeof body.message === 'string' ? body.message : '';
  const conversation = {
    id: conversationId,
    userId: MOCK_USER_ID,
    title: prompt.slice(0, 80) || 'Offline demo',
    createdAt: now,
    updatedAt: now,
    messages: [
      { id: `offline-message-${Date.now()}`, conversationId, role: 'user', content: prompt, createdAt: now },
      { id: `offline-reply-${Date.now()}`, conversationId, role: 'assistant', content: 'Offline demo response: your question was received. Connect to the API for a personalized AI answer.', createdAt: now },
    ],
  };
  const conversations = await load<typeof conversation[]>(CONVERSATION_KEY, []);
  await AsyncStorage.setItem(CONVERSATION_KEY, JSON.stringify([conversation, ...conversations.filter(item => item.id !== conversationId)]));
  return {
    conversationId,
    message: {
      id: conversation.messages[1].id,
      conversationId,
      role: 'assistant' as const,
      content: conversation.messages[1].content,
      createdAt: now,
    },
  };
}

async function createStoredRecord(key: string, body: Record<string, unknown>) {
  const now = new Date().toISOString();
  const record = {
    ...body,
    id: `offline-${Date.now()}`,
    userId: MOCK_USER_ID,
    createdAt: now,
    updatedAt: now,
    ...(key === CONVERSATION_KEY ? { messages: [] } : {}),
  };
  await AsyncStorage.setItem(key, JSON.stringify([record, ...await load<unknown[]>(key, [])]));
  return record;
}

async function updateStoredRecord(key: string, id: string, body: Record<string, unknown>) {
  const records = await load<Array<Record<string, unknown>>>(key, []);
  const updated = records.map(record => record.id === id
    ? { ...record, ...body, updatedAt: new Date().toISOString() }
    : record);
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated.find(record => record.id === id) ?? { id, ...body };
}

async function deleteStoredRecord(key: string, id: string) {
  const records = await load<Array<Record<string, unknown>>>(key, []);
  await AsyncStorage.setItem(key, JSON.stringify(records.filter(record => record.id !== id)));
  return { id };
}

async function load<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Unable to read offline demo data for ${key}.`, { cause: error });
  }
}

function readBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
