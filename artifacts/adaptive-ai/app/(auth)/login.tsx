import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Button, ErrorBanner, Field, Screen, styles } from '@/components/UI';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import * as Speech from 'expo-speech';
import { DEMO_ACCOUNT } from '@/config/auth';

export default function Login() {
  const router = useRouter(); const { signIn } = useAuth(); const { preferences } = usePreferences();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [errors, setErrors] = useState<Record<string, string>>({}); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [showPassword, setShowPassword] = useState(false);
  const speak = (text: string) => { if (preferences.voiceFeedback) Speech.speak(text); };
  const authenticate = async (loginEmail: string, loginPassword: string) => {
    const next: Record<string, string> = {};
    if (!loginEmail.trim()) next.email = 'Email is required'; else if (!/^\S+@\S+\.\S+$/.test(loginEmail)) next.email = 'Enter a valid email address';
    if (!loginPassword) next.password = 'Password is required';
    setErrors(next); setMessage(''); if (Object.keys(next).length) { speak(Object.values(next).join('. ')); return; }
    setBusy(true); const result = await signIn(loginEmail, loginPassword); setBusy(false);
    if (!result.ok) { setMessage(result.message || 'Unable to sign in.'); speak(result.message || 'Unable to sign in.'); }
  };
  const submit = async () => authenticate(email, password);
  const useDemoAccount = async () => { setEmail(DEMO_ACCOUNT.email); setPassword(DEMO_ACCOUNT.password); await authenticate(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password); };
  return <Screen title="Welcome back" subtitle="Sign in to continue to Adaptive AI"><View style={styles.authBrand}><View style={styles.logo}><Feather name="zap" size={20} color="#FFFFFF" /></View><Text style={{ color: '#64748B' }}>Your adaptive assistant</Text><Pressable accessibilityRole="button" accessibilityLabel="Voice-guided login" onPress={() => Speech.speak('Sign in to continue to Adaptive AI')} style={styles.voiceButton}><Feather name="mic" size={18} color="#0F766E" /></Pressable></View>
     <Pressable accessibilityRole="button" accessibilityLabel="Use demo account" onPress={useDemoAccount} disabled={busy} style={({ pressed }) => ({ backgroundColor: '#E8F2F1', borderRadius: 12, padding: 12, marginBottom: 4, opacity: busy ? .6 : pressed ? .75 : 1 })}><Text style={{ color: '#0F766E', fontWeight: '700', fontSize: 13 }}>Use Demo Account</Text><Text style={{ color: '#175A5A', fontSize: 12, marginTop: 3 }}>{DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}</Text></Pressable>
    {message ? <ErrorBanner message={message} /> : null}
    <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
    <Field label="Password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry={!showPassword} rightIcon={showPassword ? 'eye-off' : 'eye'} onRightPress={() => setShowPassword(!showPassword)} />
    <Link href="/(auth)/forgot" asChild><Pressable accessibilityRole="link" style={styles.authLink}><Text style={{ color: '#0F766E', fontWeight: '600' }}>Forgot password?</Text></Pressable></Link>
    <Button label={busy ? 'Signing in…' : 'Log In'} onPress={submit} disabled={busy} icon={busy ? undefined : 'log-in'} />
    <Button label="Continue with Google" onPress={() => setMessage('Google sign-in is not configured for this prototype yet.')} secondary icon="globe" />
     <View style={styles.authFooter}><Text style={{ color: '#64748B' }}>Don't have an account? </Text><Link href="/(auth)/register" asChild><Pressable accessibilityRole="link"><Text style={{ color: '#0F766E', fontWeight: '700' }}>Sign Up</Text></Pressable></Link></View>
  </Screen>;
}