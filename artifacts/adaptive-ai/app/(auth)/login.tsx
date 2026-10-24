import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { Button, ErrorBanner, Field, Screen, styles } from '@/components/UI';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { getSupabaseClient } from '@/services/auth/supabaseClient';
import * as Speech from 'expo-speech';

export default function Login() {
  const router = useRouter(); const { signIn, user, isLoading, refreshSession } = useAuth(); const { preferences } = usePreferences();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [errors, setErrors] = useState<Record<string, string>>({}); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [showPassword, setShowPassword] = useState(false);
  const speak = (text: string) => { if (preferences.voiceFeedback) Speech.speak(text); };
  useEffect(() => {
    if (!isLoading && user) router.replace('/(tabs)');
  }, [isLoading, router, user]);

  const authenticate = async (loginEmail: string, loginPassword: string) => {
    const next: Record<string, string> = {};
    if (!loginEmail.trim()) next.email = 'Email is required'; else if (!/^\S+@\S+\.\S+$/.test(loginEmail)) next.email = 'Enter a valid email address';
    if (!loginPassword) next.password = 'Password is required';
    setErrors(next); setMessage(''); if (Object.keys(next).length) { speak(Object.values(next).join('. ')); return; }
    setBusy(true);
    try {
      const result = await signIn(loginEmail, loginPassword);
      if (!result.ok) {
        setMessage(result.message || 'Unable to sign in.');
        speak(result.message || 'Unable to sign in.');
        return;
      }
      router.replace('/(tabs)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to sign in.';
      setMessage(errorMessage);
      speak(errorMessage);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => authenticate(email, password);
  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage('');
    try {
      const redirectTo =
        Platform.OS === 'web'
          ? `${window.location.origin}${window.location.pathname}`
          : Linking.createURL('/(auth)/login');
      const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          ...(Platform.OS !== 'web' ? { skipBrowserRedirect: true } : {}),
        },
      });
      if (error) throw error;

      if (Platform.OS !== 'web') {
        if (!data.url) throw new Error('Unable to start Google sign-in.');
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          const { error: sessionError } = await getSupabaseClient().auth.exchangeCodeForSession(result.url);
          if (sessionError) throw sessionError;
          await refreshSession();
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to sign in with Google.';
      setMessage(errorMessage);
      speak(errorMessage);
    } finally {
      setBusy(false);
    }
  };
  return <Screen title="Welcome back" subtitle="Sign in to continue to Adaptive AI"><View style={styles.authBrand}><View style={styles.logo}><Feather name="zap" size={20} color="#FFFFFF" /></View><Text style={{ color: '#64748B' }}>Your adaptive assistant</Text><Pressable accessibilityRole="button" accessibilityLabel="Voice-guided login" onPress={() => Speech.speak('Sign in to continue to Adaptive AI')} style={styles.voiceButton}><Feather name="mic" size={18} color="#0F766E" /></Pressable></View>
    {message ? <ErrorBanner message={message} /> : null}
    <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
    <Field label="Password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry={!showPassword} rightIcon={showPassword ? 'eye-off' : 'eye'} onRightPress={() => setShowPassword(!showPassword)} />
    <Link href="/(auth)/forgot" asChild><Pressable accessibilityRole="link" style={styles.authLink}><Text style={{ color: '#0F766E', fontWeight: '600' }}>Forgot password?</Text></Pressable></Link>
    <Button label={busy ? 'Signing in…' : 'Log In'} onPress={submit} disabled={busy} icon={busy ? undefined : 'log-in'} />
    <Button label={busy ? 'Signing in…' : 'Continue with Google'} onPress={signInWithGoogle} disabled={busy} secondary icon="globe" />
     <View style={styles.authFooter}><Text style={{ color: '#64748B' }}>Don't have an account? </Text><Link href="/(auth)/register" asChild><Pressable accessibilityRole="link"><Text style={{ color: '#0F766E', fontWeight: '700' }}>Sign Up</Text></Pressable></Link></View>
  </Screen>;
}