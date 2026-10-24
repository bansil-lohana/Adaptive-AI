import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/context/PreferencesContext';
import { askVoice, askVoiceBlob, askVoiceTranscript, generateAnswer } from '@/services/aiService';
import { Card, ErrorBanner, Loading, Screen } from '@/components/UI';

type AssistantMode = 'text' | 'voice';
type Message = { id: string; role: 'user' | 'ai'; text: string };
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
};

const suggestions = [
  'Explain photosynthesis simply',
  'Summarize the water cycle',
  'Give me a study idea',
];

export default function Assistant() {
  const colors = useColors();
  const { mode: routeMode } = useLocalSearchParams<{ mode?: string }>();
  const mode: AssistantMode = routeMode === 'voice' ? 'voice' : 'text';
  const { addHistory, preferences } = usePreferences();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState('');
  const [retryPrompt, setRetryPrompt] = useState('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const recognition = useRef<BrowserRecognition | null>(null);
  const recognizedTranscript = useRef('');
  const sequence = useRef(0);
  const autoReadEnabled = useRef(preferences.autoRead);

  useEffect(() => {
    autoReadEnabled.current = preferences.autoRead;
  }, [preferences.autoRead]);

  useEffect(() => () => {
    recognition.current?.stop();
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
    mediaStream.current?.getTracks().forEach(track => track.stop());
  }, []);

  const sendPrompt = async (rawPrompt: string, source: AssistantMode, retry = false) => {
    const prompt = rawPrompt.trim();
    if (!prompt || loading) return;

    if (!retry) {
      setMessages(previous => [...previous, { id: `${Date.now()}-${sequence.current++}`, role: 'user', text: prompt }]);
    }
    setError('');
    setLoading(true);
    try {
      const response = source === 'voice'
        ? await askVoiceTranscript(prompt)
        : await generateAnswer(prompt);
      setMessages(previous => [...previous, { id: `${Date.now()}-${sequence.current++}`, role: 'ai', text: response }]);
      setRetryPrompt('');
      if (source === 'text') setInput('');
      setRecognizedText('');
      addHistory({
        id: Date.now().toString(),
        title: source === 'voice' ? 'Voice question' : 'Text question',
        type: source === 'voice' ? 'Voice' : 'Text',
        preview: prompt,
        timestamp: 'Just now',
        response,
      });
      if (autoReadEnabled.current && response.trim()) {
        try {
          Speech.speak(response);
        } catch (speechError) {
          setError(getErrorMessage(speechError, 'Unable to read the AI response aloud.'));
        }
      }
    } catch (sendError) {
      setError(getErrorMessage(sendError, 'Unable to send your question. Please try again.'));
      setRetryPrompt(prompt);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    void sendPrompt(input, 'text');
  };

  const submitAudio = async (audio: Blob, mimeType: string) => {
    setLoading(true);
    setError('');
    setMessages(previous => [...previous, {
      id: `${Date.now()}-${sequence.current++}`,
      role: 'user',
      text: 'Voice message',
    }]);
    try {
      const response = await askVoiceBlob(audio, mimeType);
      setMessages(previous => [...previous, { id: `${Date.now()}-${sequence.current++}`, role: 'ai', text: response }]);
      addHistory({ id: Date.now().toString(), title: 'Voice question', type: 'Voice', preview: 'Voice message', timestamp: 'Just now', response });
      if (autoReadEnabled.current && response.trim()) Speech.speak(response);
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to submit this recording. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const startBrowserRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const message = 'Voice input is not supported in this browser. Try a supported browser or the mobile app.';
      console.error(message);
      setError(message);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(type => MediaRecorder.isTypeSupported(type));
      const activeRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunks.current = [];
      activeRecorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };
      activeRecorder.onerror = () => {
        setRecording(false);
        setError('The browser could not record audio. Check microphone access and try again.');
        stream.getTracks().forEach(track => track.stop());
        mediaStream.current = null;
      };
      activeRecorder.onstop = () => {
        const audio = new Blob(audioChunks.current, { type: activeRecorder.mimeType || mimeType || 'audio/webm' });
        audioChunks.current = [];
        stream.getTracks().forEach(track => track.stop());
        mediaStream.current = null;
        if (!audio.size) {
          setError('No audio was recorded. Please try again.');
          return;
        }
        void submitAudio(audio, audio.type || 'audio/webm');
      };
      mediaRecorder.current = activeRecorder;
      activeRecorder.start();
      setRecording(true);
    } catch (recordError) {
      mediaStream.current?.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
      const denied = isMicrophonePermissionError(recordError);
      const message = denied
        ? 'Microphone access was denied. Allow microphone access in your browser settings and try again.'
        : getErrorMessage(recordError, 'Unable to access the microphone. Please try again.');
      console.error(denied ? 'Microphone access denied:' : 'Unable to start browser audio recording:', recordError);
      setError(message);
      if (denied) showMicrophoneAlert(message);
    }
  };

  const startBrowserRecognition = () => {
    const browserWindow = window as RecognitionWindow;
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      console.warn('Web Speech API is unavailable; falling back to browser audio recording.');
      setRecognizedText('Speech recognition is unavailable in this browser. Using audio recording; transcription will be sent when you stop.');
      void startBrowserRecording();
      return;
    }

    try {
      const activeRecognition = new Recognition();
      activeRecognition.lang = navigator.language || 'en-US';
      activeRecognition.continuous = true;
      activeRecognition.interimResults = true;
      activeRecognition.maxAlternatives = 1;
      activeRecognition.onresult = event => {
        const finalSegments: string[] = [];
        const interimSegments: string[] = [];
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          if (result.isFinal) finalSegments.push(result[0].transcript);
          else interimSegments.push(result[0].transcript);
        }
        const finalTranscript = finalSegments.join(' ');
        const interimTranscript = interimSegments.join(' ');
        recognizedTranscript.current = finalTranscript.trim();
        setRecognizedText([finalTranscript, interimTranscript].filter(Boolean).join(' '));
      };
      activeRecognition.onerror = event => {
        setRecording(false);
        recognition.current = null;
        const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        const message = denied
          ? 'Microphone access was denied. Allow microphone access in your browser settings and try again.'
          : `Speech recognition failed (${event.error}). Please try again.`;
        console.error('Browser speech recognition failed:', event.error);
        setError(message);
        if (denied) showMicrophoneAlert(message);
      };
      activeRecognition.onend = () => {
        if (recognition.current === activeRecognition) {
          recognition.current = null;
          setRecording(false);
          const transcript = recognizedTranscript.current.trim();
          recognizedTranscript.current = '';
          if (transcript) {
            void sendPrompt(transcript, 'voice');
          } else {
            const message = 'Speech was not recognized. Please try speaking again.';
            console.warn(message);
            setError(message);
          }
        }
      };
      recognition.current = activeRecognition;
      recognizedTranscript.current = '';
      setRecognizedText('');
      activeRecognition.start();
      setRecording(true);
    } catch (recognitionError) {
      recognition.current = null;
      setRecording(false);
      const message = getErrorMessage(recognitionError, 'Unable to start speech recognition.');
      console.error('Unable to start browser speech recognition:', recognitionError);
      setError(message);
    }
  };

  const startNativeRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        const message = permission.canAskAgain
          ? 'Microphone permission was not granted. Allow access and try again.'
          : 'Microphone permission is blocked. Enable it in your device settings.';
        console.error('Microphone permission denied:', message);
        setError(message);
        showMicrophoneAlert(message);
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecognizedText('Listening… Your recording will be transcribed when you stop.');
    } catch (recordError) {
      const denied = isMicrophonePermissionError(recordError);
      const message = denied
        ? 'Microphone permission was not granted. Allow access and try again.'
        : getErrorMessage(recordError, 'Unable to start audio recording.');
      console.error('Unable to start native audio recording:', recordError);
      setError(message);
      if (denied) showMicrophoneAlert(message);
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    if (Platform.OS === 'web') {
      if (recognition.current) {
        recognition.current.stop();
        return;
      }
      if (mediaRecorder.current?.state === 'recording') {
        mediaRecorder.current.stop();
        return;
      }
      setError('The recording could not be stopped. Please try again.');
      return;
    }

    setRecognizedText('');
    setLoading(true);
    setError('');
    setMessages(previous => [...previous, {
      id: `${Date.now()}-${sequence.current++}`,
      role: 'user',
      text: 'Voice message',
    }]);
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('The recording could not be opened. Please try again.');
      const response = await askVoice(recorder.uri);
      setMessages(previous => [...previous, { id: `${Date.now()}-${sequence.current++}`, role: 'ai', text: response }]);
      addHistory({ id: Date.now().toString(), title: 'Voice question', type: 'Voice', preview: 'Voice message', timestamp: 'Just now', response });
      if (autoReadEnabled.current && response.trim()) Speech.speak(response);
    } catch (recordError) {
      setError(getErrorMessage(recordError, 'Unable to transcribe this recording. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = () => {
    setError('');
    if (recording) {
      void stopRecording();
    } else if (Platform.OS === 'web') {
      startBrowserRecognition();
    } else {
      void startNativeRecording();
    }
  };

  const messagesList = (
    <FlatList
      style={{ flex: 1 }}
      data={messages}
      keyExtractor={item => item.id}
      contentContainerStyle={{ paddingBottom: 80, flexGrow: 1 }}
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 24, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="zap" size={28} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground, marginTop: 16 }}>Ask Adaptive AI</Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 7, textAlign: 'center' }}>
            Type a question below or start with a suggestion.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ alignItems: item.role === 'user' ? 'flex-end' : 'flex-start', marginVertical: 6 }}>
          <Card style={{ maxWidth: '88%', backgroundColor: item.role === 'user' ? colors.primary : colors.card, borderColor: item.role === 'user' ? colors.primary : colors.border, padding: 14 }}>
            <Text style={{ color: item.role === 'user' ? colors.primaryForeground : colors.foreground, lineHeight: 21 }}>{item.text}</Text>
            {item.role === 'ai' && (
              <Pressable accessibilityRole="button" accessibilityLabel="Read response aloud" onPress={() => Speech.speak(item.text)} style={{ marginTop: 12 }}>
                <Feather name="volume-2" size={18} color={colors.primary} />
              </Pressable>
            )}
          </Card>
        </View>
      )}
      ListFooterComponent={loading ? <Loading label="Sending to Adaptive AI..." /> : null}
    />
  );

  return (
    <Screen
      title={mode === 'voice' ? 'Voice Assistant' : 'Ask anything'}
      subtitle={mode === 'voice' ? 'Speak naturally to interact with Adaptive AI' : 'I adapt to the way you think.'}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, position: 'relative', marginTop: 16, paddingBottom: Platform.OS === 'web' ? 88 : 72 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View
            accessibilityRole="text"
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary }}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: '700', textTransform: 'capitalize' }}>{mode}</Text>
          </View>
        </View>

        {mode === 'text' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
              {suggestions.map(prompt => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  onPress={() => void sendPrompt(prompt, 'text')}
                  disabled={loading}
                  style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.secondary, opacity: loading ? 0.5 : 1 }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{prompt}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {messagesList}
            <ErrorBanner message={error} />
            {retryPrompt && !loading && (
              <Pressable accessibilityRole="button" onPress={() => void sendPrompt(retryPrompt, 'text', true)} style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Try again</Text>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', paddingVertical: 9 }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!loading}
                accessibilityLabel="Ask Adaptive AI text input"
                placeholder="Ask a question..."
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, color: colors.foreground }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={loading || !input.trim()}
                onPress={handleSend}
                style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: loading || !input.trim() ? 0.5 : 1 }}
              >
                <Feather name="arrow-up" size={21} color={colors.primaryForeground} />
              </Pressable>
            </View>
          </>
        )}

        {mode === 'voice' && (
          <>
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recording ? 'Stop listening and submit voice message' : 'Start voice assistant'}
                accessibilityState={{ disabled: loading }}
                disabled={loading}
                onPress={toggleRecording}
                style={({ pressed }) => ({
                  width: 132,
                  height: 132,
                  borderRadius: 66,
                  backgroundColor: recording ? colors.destructive : colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: loading ? 0.5 : pressed ? 0.8 : 1,
                  elevation: 5,
                })}
              >
                <Feather name={recording ? 'square' : 'mic'} size={48} color={colors.primaryForeground} />
              </Pressable>
              <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: 18 }}>
                {loading ? 'Thinking…' : recording ? 'Listening…' : 'Tap the microphone to speak'}
              </Text>
              {recognizedText ? <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>{recognizedText}</Text> : null}
              <ErrorBanner message={error} />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isMicrophonePermissionError(error: unknown) {
  return typeof DOMException !== 'undefined' && error instanceof DOMException
    ? error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' || error.name === 'SecurityError'
    : error instanceof Error && /permission|denied|not allowed/i.test(error.message);
}

function showMicrophoneAlert(message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }
  Alert.alert('Microphone access', message);
}
