import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { analyzeImage } from '@/services/aiService';
import { Button, Card, ErrorBanner, Loading, Screen } from '@/components/UI';
import { useColors } from '@/hooks/useColors';

export default function ExplainImage() {
  const colors = useColors();
  const router = useRouter();
  const [imageUri, setImageUri] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseImage = async () => {
    setError('');
    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (selection.canceled) return;
    const uri = selection.assets[0]?.uri;
    if (!uri) {
      setError('The selected image could not be opened. Please try another image.');
      return;
    }

    setImageUri(uri);
    setExplanation('');
    setBusy(true);
    try {
      setExplanation(await analyzeImage());
    } catch {
      setError('Unable to explain this image right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Explain an image" subtitle="Choose a study image and Adaptive AI will provide a clear explanation.">
      <Card style={{ marginTop: 22, padding: 12 }}>
        {imageUri ? (
          <Image accessibilityLabel="Selected image to explain" source={{ uri: imageUri }} style={{ width: '100%', height: 230, borderRadius: 14 }} resizeMode="cover" />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Choose an image to explain" onPress={chooseImage} style={{ height: 230, borderRadius: 14, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '700' }}>Choose an image</Text>
            <Text style={{ color: colors.mutedForeground, marginTop: 7 }}>Select a photo from your device</Text>
          </Pressable>
        )}
      </Card>
      {busy ? <Loading label="Explaining image..." /> : explanation ? <Card><Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ADAPTIVE AI EXPLANATION</Text><Text style={{ color: colors.foreground, lineHeight: 22, marginTop: 10 }}>{explanation}</Text></Card> : null}
      <ErrorBanner message={error} />
      <Button label={imageUri ? 'Choose another image' : 'Choose image'} icon="image" onPress={chooseImage} disabled={busy} />
      <Button label="Back to Home" onPress={() => router.back()} secondary />
    </Screen>
  );
}