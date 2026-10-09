import React, { useState } from 'react';
import { Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { explainText } from '@/services/aiService';
import { getFileErrorMessage, readTextFile } from '@/services/fileTextService';
import { Button, Card, ErrorBanner, Loading, Screen } from '@/components/UI';
import { useColors } from '@/hooks/useColors';

export default function ReadText() {
  const colors = useColors();
  const router = useRouter();
  const [fileName, setFileName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseFile = async () => {
    setError('');
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled) return;
      const file = selection.assets[0];
      if (!file) throw new Error('The selected file could not be opened.');

      setFileName(file.name);
      setExplanation('');
      setBusy(true);
      const text = await readTextFile(file);
      setExplanation(await explainText(text));
    } catch (readError) {
      setError(getFileErrorMessage(readError, 'Unable to read this file right now. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
      <Screen title="Read text" subtitle="Choose a text file to read and explain. Supports .txt, .md, .csv, .tsv, and .json files up to 2 MB.">
      <Card style={{ marginTop: 22 }}>
        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>SELECTED FILE</Text>
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: 10 }}>{fileName || 'No file selected yet'}</Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 20, marginTop: 7 }}>{fileName ? 'Your file is ready to read.' : 'Choose a supported text file from your device.'}</Text>
      </Card>
      {busy ? <Loading label="Reading file..." /> : explanation ? <Card><Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ADAPTIVE AI EXPLANATION</Text><Text style={{ color: colors.foreground, lineHeight: 22, marginTop: 10 }}>{explanation}</Text></Card> : null}
      <ErrorBanner message={error} />
      <Button label={fileName ? 'Choose another file' : 'Choose a file'} icon="file-text" onPress={chooseFile} disabled={busy} />
      <Button label="Back to Home" onPress={() => router.back()} secondary />
    </Screen>
  );
}