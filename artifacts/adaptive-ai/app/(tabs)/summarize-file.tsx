import React, { useState } from 'react';
import { Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { summarizeText } from '@/services/aiService';
import { getFileErrorMessage, readTextFile } from '@/services/fileTextService';
import { Button, Card, ErrorBanner, Loading, Screen } from '@/components/UI';
import { useColors } from '@/hooks/useColors';

export default function SummarizeFile() {
  const colors = useColors();
  const router = useRouter();
  const [fileName, setFileName] = useState('');
  const [summary, setSummary] = useState('');
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
      setSummary('');
      setBusy(true);
      const text = await readTextFile(file);
      setSummary(await summarizeText(text));
    } catch (readError) {
      setError(getFileErrorMessage(readError, 'Unable to summarize this file right now. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Summarize a file" subtitle="Choose a text file to summarize. Supports .txt, .md, .csv, .tsv, and .json files up to 2 MB.">
      <Card style={{ marginTop: 22 }}>
        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>SELECTED FILE</Text>
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: 10 }}>{fileName || 'No file selected yet'}</Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 20, marginTop: 7 }}>{fileName ? 'Your file is ready for a summary preview.' : 'Choose a supported text file from your device.'}</Text>
      </Card>
      {busy ? <Loading label="Summarizing file..." /> : summary ? <Card><Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ADAPTIVE AI SUMMARY</Text><Text style={{ color: colors.foreground, lineHeight: 22, marginTop: 10 }}>{summary}</Text></Card> : null}
      <ErrorBanner message={error} />
      <Button label={fileName ? 'Choose another file' : 'Choose a file'} icon="folder" onPress={chooseFile} disabled={busy} />
      <Button label="Back to Home" onPress={() => router.back()} secondary />
    </Screen>
  );
}