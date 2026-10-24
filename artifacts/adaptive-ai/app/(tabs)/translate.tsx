import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { translateText } from '@/services/aiService';
import { Button, Card, ErrorBanner, Loading, Screen } from '@/components/UI';

export default function Translate() {
  const colors = useColors();
  const router = useRouter();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('English');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const translate = async () => {
    if (!text.trim() || !language.trim() || busy) return;
    setBusy(true);
    setError('');
    setTranslation('');
    try {
      setTranslation(await translateText(text.trim(), language.trim()));
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : 'Unable to translate this text right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Translate text" subtitle="Translate study notes into the language you choose.">
      <TextInput
        accessibilityLabel="Text to translate"
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Enter text to translate"
        placeholderTextColor={colors.mutedForeground}
        textAlignVertical="top"
        style={{ minHeight: 150, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 15, color: colors.foreground, marginTop: 22 }}
      />
      <Text style={{ color: colors.foreground, fontWeight: '600', marginTop: 16 }}>Translate into</Text>
      <TextInput
        accessibilityLabel="Target language"
        value={language}
        onChangeText={setLanguage}
        placeholder="Target language"
        placeholderTextColor={colors.mutedForeground}
        style={{ minHeight: 50, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, color: colors.foreground, marginTop: 8 }}
      />
      <Button label="Translate" icon="globe" onPress={translate} disabled={busy || !text.trim() || !language.trim()} />
      {busy ? <Loading label="Translating..." /> : translation ? <Card><Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>TRANSLATION</Text><Text style={{ color: colors.foreground, lineHeight: 22, marginTop: 10 }}>{translation}</Text></Card> : null}
      <ErrorBanner message={error} />
      <Button label="Back" onPress={() => router.back()} secondary />
    </Screen>
  );
}
