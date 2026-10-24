import React from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Button, Card, Screen, styles } from '@/components/UI';
import { useAuth } from '@/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  if (!user) return null;
  const displayName = user.name.trim() || user.email.split('@')[0]?.trim() || 'Student';
  const avatarInitials = getInitials(displayName);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Signout error:', err);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      } else {
        router.replace('/(auth)/login');
      }
    }
  };

  const showPrivacy = () =>
    Alert.alert(
      'Privacy & security',
      'This prototype stores your account and preferences locally on this device.',
    );

  return (
    <Screen title="Profile" subtitle="Manage your account and adaptive experience.">
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: '#E8F2F1', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {user.avatarUri ? (
              <Image source={{ uri: user.avatarUri }} style={{ width: 86, height: 86 }} />
            ) : (
              <Text style={{ color: '#0F766E', fontSize: 28, fontWeight: '700' }}>
                {avatarInitials}
              </Text>
            )}
          </View>
          <Text style={{ color: '#1E293B', fontSize: 21, fontWeight: '700', marginTop: 14 }}>{displayName}</Text>
          <Text style={{ color: '#64748B', marginTop: 5 }}>{user.email}</Text>
          <Button label="Edit Profile" icon="edit-2" onPress={() => router.push('/edit-profile' as never)} secondary />
        </Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={handleLogout}
          style={({ pressed }) => ({
            minHeight: 48,
            borderWidth: 1,
            borderColor: '#F0B8B0',
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 14,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#B42318', fontWeight: '700' }}>
            Log Out
          </Text>
        </Pressable>
        <Text style={[styles.sectionTitle, { color: '#1E293B' }]}>Account</Text>
        <Card style={{ padding: 8 }}>
          <Row icon="lock" label="Change Password" onPress={() => router.push('/change-password' as never)} />
          <Row icon="sliders" label="Accessibility & preferences" onPress={() => router.push('/(tabs)/settings' as never)} />
          <Row icon="shield" label="Privacy & security" onPress={showPrivacy} />
        </Card>
        <Text style={[styles.sectionTitle, { color: '#1E293B' }]}>About</Text>
        <Card>
          <Text style={{ color: '#1E293B', fontWeight: '600' }}>Adaptive AI</Text>
          <Text style={{ color: '#64748B', marginTop: 6 }}>
            Version 1.0.0 · Built for accessible, personalized assistance.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
function Row({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }}><Feather name={icon} size={19} color="#0F766E" /><Text style={{ color: '#1E293B', fontWeight: '600', flex: 1 }}>{label}</Text><Feather name="chevron-right" size={18} color="#64748B" /></Pressable>; }

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || '?';
}