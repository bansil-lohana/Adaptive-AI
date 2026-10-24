import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/context/PreferencesContext';
import { useAuth } from '@/context/AuthContext';
import { askQuestion } from '@/services/aiService';
import { Card, ErrorBanner, Loading, Screen, styles } from '@/components/UI';
import { VoiceActionButton } from '@/components/VoiceActionButton';
import { ClassSchedule } from '@/models';
import { dashboardApi, DashboardData } from '@/api/dashboardApi';
import { TimetableEntryItem } from '@/api/timetableApi';
import { isOfflineMockMode } from '@/api/offlineMock';

// ---------------------------------------------------------------------------
// Helpers to convert backend TimetableEntryItem → local ClassSchedule shape
// ---------------------------------------------------------------------------
function entryToSchedule(entry: TimetableEntryItem): ClassSchedule {
  return {
    id: entry.id,
    subject: entry.subject,
    dayOfWeek: entry.dayOfWeek,
    startTime: entry.startTime,
    endTime: entry.endTime,
    room: entry.room ?? undefined,
    teacher: entry.teacher ?? undefined,
    reminderMinutes: entry.reminderMinutes,
    semesterId: entry.semester ?? 'current',
    enabled: entry.enabled,
  };
}

// ---------------------------------------------------------------------------
// useDashboard — fetches dashboard data once; falls back gracefully on error
// ---------------------------------------------------------------------------
function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .getDashboard()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const { preferences, history, classes: localClasses, addHistory } = usePreferences();
  const { user } = useAuth();
  const { data: dashboardData, loading: dashboardLoading } = useDashboard();
  const [input, setInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [, setMinute] = useState(0);
  useEffect(() => { const timer = setInterval(() => setMinute(value => value + 1), 60000); return () => clearInterval(timer); }, []);

  const now = new Date();

  const emailPrefix = user?.email?.split('@')[0]?.trim();
  const displayName =
    user?.user_metadata?.full_name?.trim() ||
    user?.user_metadata?.name?.trim() ||
    (emailPrefix ? titleCase(emailPrefix) : '') ||
    'User';
  const firstName = titleCase(displayName.split(/\s+/)[0]);
  const avatarInitials = getInitials(displayName);

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  // Today's classes: prefer backend data, fall back to local PreferencesContext
  const classes: ClassSchedule[] = dashboardData
    ? dashboardData.todayClasses.map(entryToSchedule)
    : localClasses;

  // All-week classes for nextClass calculation when backend is unavailable
  const allClasses: ClassSchedule[] = dashboardData
    ? [...dashboardData.todayClasses, ...dashboardData.upcomingReminders]
        .filter((entry, index, arr) => arr.findIndex(e => e.id === entry.id) === index)
        .map(entryToSchedule)
    : localClasses;

  const todayClasses = dashboardData
    ? classes  // already filtered to today on the server
    : localClasses.filter(item => item.enabled && item.dayOfWeek === now.getDay());

  // nextClass: prefer the backend-computed value, fall back to local calculation
  const nextClass = useMemo(() => {
    if (dashboardData?.nextClass) {
      return entryToSchedule(dashboardData.nextClass);
    }
    return getNextClass(allClasses, now);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData, allClasses, now.getDate(), now.getHours(), now.getMinutes()]);

  const todaySummary = todayClasses.length === 0
    ? 'You have no classes today. Great time to catch up!'
    : `You have ${todayClasses.length} ${todayClasses.length === 1 ? 'class' : 'classes'} today.`;

  const voiceFirst = preferences.adaptiveUI && preferences.mode === 'voice';
  const cameraFirst = preferences.adaptiveUI && preferences.mode === 'camera';

  const submitQuestion = async () => {
    const prompt = input.trim();
    if (!prompt || aiLoading) return;
    setInput('');
    setAiResponse('');
    setAiError('');
    setAiLoading(true);
    try {
      const response = await askQuestion(prompt);
      setAiResponse(response);
      addHistory({ id: Date.now().toString(), title: 'Text question', type: 'Text', preview: prompt, timestamp: 'Just now', response });
    } catch (submitError) {
      setAiError(submitError instanceof Error ? submitError.message : 'Unable to send your question. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Screen title="" showHeader={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.eyebrow, { color: colors.primary, marginBottom: 0 }]}>ADAPTIVE AI</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile' as never)} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .75 : 1 })}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{avatarInitials}</Text>
            </Pressable>
          </View>
          {isOfflineMockMode() ? <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 5 }}>Offline demo — data stays on this device; AI answers are placeholders.</Text> : null}
          <Text style={{ color: colors.foreground, fontSize: 29, fontWeight: '700', letterSpacing: -.7, marginTop: 16 }}>{greeting}, {firstName} <Text style={{ fontSize: 24 }}>👋</Text></Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 7, lineHeight: 22 }}>{dashboardLoading ? 'Loading your schedule…' : todaySummary}</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 110 }}>
          {dashboardLoading
            ? <View style={{ marginTop: 24 }}><Loading label="Loading dashboard…" /></View>
            : nextClass
              ? <NextClassCard nextClass={nextClass} now={now} colors={colors} onPress={() => router.push('/(tabs)/schedule' as never)} />
              : null}
          <View>
            <Card style={{ backgroundColor: '#102B3F', borderColor: '#102B3F', padding: 20, marginTop: 20 }}>
              <Text style={{ color: '#7EE5D5', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 }}>YOUR ADAPTIVE AI</Text>
              <Text style={{ color: '#FFF', fontSize: 25, fontWeight: '700', marginTop: 9 }}>{voiceFirst ? 'Ready to listen.' : cameraFirst ? 'Ready to see.' : 'Ask Adaptive AI'}</Text>
              <Text style={{ color: '#B9D0D2', marginTop: 7, lineHeight: 21 }}>{voiceFirst ? "Tap and speak — I'm listening." : cameraFirst ? 'Point your camera at text or an object.' : 'How can I help you today?'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: 16, borderRadius: 12, backgroundColor: '#173B4D', borderWidth: 1, borderColor: '#2B5260' }}>
                <VoiceActionButton
                  disabled={aiLoading}
                  onAnswer={response => {
                    setAiResponse(response);
                    addHistory({ id: Date.now().toString(), title: 'Voice question', type: 'Voice', preview: response, timestamp: 'Just now', response });
                  }}
                  onError={setAiError}
                />
                <TextInput ref={inputRef} value={input} onChangeText={setInput} onSubmitEditing={submitQuestion} returnKeyType="send" accessibilityLabel="Ask Adaptive AI text input" placeholder="Ask anything..." placeholderTextColor="#9BB8BB" style={{ flex: 1, minHeight: 46, paddingHorizontal: 14, color: '#FFF', fontSize: 14 }} />
                <Pressable accessibilityRole="button" accessibilityLabel="Submit AI question" onPress={submitQuestion} disabled={aiLoading || !input.trim()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: aiLoading || !input.trim() ? .45 : 1 }}>
                  <Feather name="arrow-up" size={20} color="#7EE5D5" />
                </Pressable>
              </View>
              {aiLoading ? <Loading label="Thinking..." /> : aiResponse ? <Text style={{ color: '#D7EBE9', lineHeight: 20, marginTop: 14 }}>{aiResponse}</Text> : null}
              <ErrorBanner message={aiError} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <PressAction icon="mic" label="Voice" onPress={() => router.push({ pathname: '/(tabs)/assistant', params: { mode: 'voice' } } as never)} />
                <PressAction icon="camera" label="Camera" onPress={() => router.push('/(tabs)/camera' as never)} />
                <PressAction icon="edit-3" label="Text" onPress={() => router.push({ pathname: '/(tabs)/assistant', params: { mode: 'text' } } as never)} />
              </View>
            </Card>
          </View>
          {!preferences.simplified && <><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick actions</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{[['file-text', 'Read text'], ['image', 'Explain image'], ['align-left', 'Summarize'], ['globe', 'Translate']].map(([icon, label]) => <PressAction key={label} icon={icon as keyof typeof Feather.glyphMap} label={label} onPress={() => label === 'Read text' ? router.push('/(tabs)/read-text' as never) : label === 'Explain image' ? router.push('/(tabs)/explain-image' as never) : label === 'Summarize' ? router.push('/(tabs)/summarize-file' as never) : router.push('/(tabs)/translate' as never)} light />)}</View></>}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 }}><Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 0 }]}>Recent activity</Text>{history.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="See all recent activity" onPress={() => router.push('/(tabs)/history' as never)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>See all →</Text></Pressable>}</View>
          {history.length === 0 ? <Card style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 }}><Feather name="activity" size={24} color={colors.mutedForeground} /><Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 17, marginTop: 10 }}>No activity yet</Text><Text style={{ color: colors.mutedForeground, marginTop: 7, textAlign: 'center', lineHeight: 21 }}>Ask Adaptive AI something and your recent activity will appear here.</Text><Pressable accessibilityRole="button" accessibilityLabel="Start asking Adaptive AI" onPress={() => router.push({ pathname: '/(tabs)/assistant', params: { mode: 'text' } } as never)} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginTop: 16, opacity: pressed ? .75 : 1 })}><Text style={{ color: colors.primary, fontWeight: '700' }}>Ask Adaptive AI</Text></Pressable></Card> : history.slice(0, 3).map(item => <Card key={item.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}><Feather name={item.type === 'Camera' ? 'camera' : item.type === 'Voice' ? 'mic' : 'message-circle'} size={19} color={colors.primary} /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: '700' }}>{item.title}</Text><Text style={{ color: colors.mutedForeground, marginTop: 3, fontSize: 12 }}>{item.timestamp}</Text></View></Card>)}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (unchanged from original)
// ---------------------------------------------------------------------------

function NextClassCard({ nextClass, now, colors, onPress }: { nextClass: ClassSchedule; now: Date; colors: ReturnType<typeof useColors>; onPress: () => void }) {
  const target = getClassStart(nextClass, now);
  const isNow = target.getTime() <= now.getTime() && getClassEnd(nextClass, now).getTime() > now.getTime();
  return <Pressable accessibilityRole="button" accessibilityLabel="View next class details" onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? .98 : 1 }] })}><Card style={{ padding: 18, marginTop: 24, backgroundColor: colors.accent, borderColor: '#E8B5A5' }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.accentForeground, fontSize: 11, letterSpacing: 1.1, fontWeight: '700' }}>NEXT CLASS · {formatCountdown(nextClass, now)}</Text><Feather accessibilityLabel="Class details" name="chevron-right" size={20} color={colors.accentForeground} /></View><Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 20, marginTop: 10 }}>{nextClass.subject}</Text><View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Feather name="clock" size={15} color={colors.accentForeground} /><Text style={{ color: colors.foreground, fontSize: 14 }}>{formatTime(nextClass.startTime)}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Feather name="map-pin" size={15} color={colors.accentForeground} /><Text style={{ color: colors.foreground, fontSize: 14 }}>{nextClass.room || 'Room TBD'}</Text></View></View><Text style={{ color: colors.accentForeground, fontWeight: '700', marginTop: 14, minHeight: 24 }}>{isNow ? 'In progress · View full schedule →' : 'View full schedule →'}</Text></Card></Pressable>;
}

function PressAction({ icon, label, onPress, light }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; light?: boolean }) { const colors = useColors(); return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, minWidth: light ? '46%' : 0, minHeight: 52, padding: 12, borderRadius: 12, backgroundColor: light ? colors.card : '#173B4D', borderWidth: light ? 1 : 0, borderColor: colors.border, opacity: pressed ? .75 : 1 })}><Feather name={icon} size={20} color={light ? colors.primary : '#7EE5D5'} /><Text style={{ color: light ? colors.foreground : '#FFF', fontWeight: '600', fontSize: 12, marginTop: 9 }}>{label}</Text></Pressable>; }

// ---------------------------------------------------------------------------
// Pure utility functions (unchanged from original)
// ---------------------------------------------------------------------------

function getOccurrence(item: ClassSchedule, now: Date) { const [startHour, startMinute] = item.startTime.split(':').map(Number); const [endHour, endMinute] = item.endTime.split(':').map(Number); const start = new Date(now); const dayOffset = (item.dayOfWeek - now.getDay() + 7) % 7; start.setDate(now.getDate() + dayOffset); start.setHours(startHour, startMinute, 0, 0); const end = new Date(start); end.setHours(endHour, endMinute, 0, 0); if (end <= now) { start.setDate(start.getDate() + 7); end.setDate(end.getDate() + 7); } return { start, end }; }
function getNextClass(items: ClassSchedule[], now: Date) { return items.filter(item => item.enabled).map(item => ({ item, ...getOccurrence(item, now) })).sort((a, b) => a.start.getTime() - b.start.getTime())[0]?.item; }
function getClassStart(item: ClassSchedule, now: Date) { return getOccurrence(item, now).start; }
function getClassEnd(item: ClassSchedule, now: Date) { return getOccurrence(item, now).end; }
function formatCountdown(item: ClassSchedule, now: Date) { const start = getClassStart(item, now); const end = getClassEnd(item, now); if (start <= now && end > now) return 'NOW'; const diff = start.getTime() - now.getTime(); const mins = Math.max(0, Math.ceil(diff / 60000)); if (start.toDateString() === now.toDateString()) { const hours = Math.floor(mins / 60); const remaining = mins % 60; return hours ? `IN ${hours}H ${remaining}M` : `IN ${mins} MIN`; } if (start.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return `TOMORROW · ${formatTime(item.startTime)}`; return `${start.toLocaleDateString(undefined, { weekday: 'short' })} · ${formatTime(item.startTime)}`; }
function formatTime(value: string) { const [hour, minute] = value.split(':').map(Number); const suffix = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`; }
function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(); }
function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || '?';
}
