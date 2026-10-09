import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, ErrorBanner, Field, Screen } from '@/components/UI';
import { useAuth } from '@/context/AuthContext';

export default function ResetPassword() {
  const router = useRouter(); const { email = '' } = useLocalSearchParams<{ email?: string }>(); const { resetPassword } = useAuth();
  const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [success, setSuccess] = useState(false); const [busy, setBusy] = useState(false);
  const save = async () => { if (next.length < 8) return setError('Password must be at least 8 characters.'); if (next !== confirm) return setError('Passwords do not match.'); setBusy(true); const result = await resetPassword(email, next); setBusy(false); if (!result.ok) setError(result.message || 'Unable to update password.'); else { setError(''); setSuccess(true); } };
  return <Screen title="Reset password" subtitle="Development simulation — choose a new local password."><Field label="New password" value={next} onChangeText={setNext} secureTextEntry helper="At least 8 characters" /><Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry /><ErrorBanner message={error} />{success ? <><Button label="Password updated successfully" onPress={() => router.replace('/(auth)/login')} /><Button label="Continue to Login" onPress={() => router.replace('/(auth)/login')} secondary /></> : <Button label={busy ? 'Updating…' : 'Update Password'} onPress={save} disabled={busy} />}</Screen>;
}