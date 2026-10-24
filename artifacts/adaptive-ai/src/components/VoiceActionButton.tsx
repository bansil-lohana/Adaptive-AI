import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import { askVoice, askVoiceBlob } from '@/services/aiService';
import { useColors } from '@/hooks/useColors';

type Props = {
  disabled?: boolean;
  onAnswer: (answer: string) => void;
  onError: (message: string) => void;
};

export function VoiceActionButton({ disabled = false, onAnswer, onError }: Props) {
  const colors = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);

  useEffect(() => () => {
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
    mediaStream.current?.getTracks().forEach(track => track.stop());
  }, []);

  const submitWebAudio = async (audio: Blob, mimeType: string) => {
    setSubmitting(true);
    try {
      const answer = await askVoiceBlob(audio, mimeType);
      onAnswer(answer);
    } catch (error) {
      onError(getErrorMessage(error, 'Unable to submit this recording. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const startWebRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Voice recording is not supported in this browser. Use a supported browser or the mobile app.');
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
        onError('The browser could not record audio. Check microphone access and try again.');
        stream.getTracks().forEach(track => track.stop());
        mediaStream.current = null;
      };
      activeRecorder.onstop = () => {
        const audio = new Blob(audioChunks.current, {
          type: activeRecorder.mimeType || mimeType || 'audio/webm',
        });
        audioChunks.current = [];
        stream.getTracks().forEach(track => track.stop());
        mediaStream.current = null;
        if (!audio.size) {
          onError('No audio was recorded. Please try again.');
          return;
        }
        void submitWebAudio(audio, audio.type || 'audio/webm');
      };
      mediaRecorder.current = activeRecorder;
      activeRecorder.start();
      setRecording(true);
    } catch (error) {
      mediaStream.current?.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
      onError(getErrorMessage(error, 'Microphone access was not granted. Allow access and try again.'));
    }
  };

  const toggleRecording = async () => {
    onError('');
    if (Platform.OS === 'web') {
      if (recording) {
        if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
        else onError('The recording could not be stopped. Please try again.');
        setRecording(false);
      } else {
        await startWebRecording();
      }
      return;
    }

    if (!recording) {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          throw new Error(permission.canAskAgain
            ? 'Microphone permission was not granted. Allow access and try again.'
            : 'Microphone permission is blocked. Enable it in your device settings.');
        }
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      } catch (error) {
        onError(getErrorMessage(error, 'Unable to start audio recording.'));
      }
      return;
    }

    setRecording(false);
    setSubmitting(true);
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('The recording could not be opened. Please try again.');
      const answer = await askVoice(recorder.uri);
      onAnswer(answer);
    } catch (error) {
      onError(getErrorMessage(error, 'Unable to transcribe this recording. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = disabled || submitting;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop and submit voice recording' : 'Start voice recording'}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => void toggleRecording()}
      style={{
        minWidth: 48,
        height: 50,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: recording ? colors.destructive : colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      <Feather name={recording ? 'square' : 'mic'} size={19} color={recording ? '#FFFFFF' : colors.primary} />
      <Text style={{ color: recording ? '#FFFFFF' : colors.primary, fontSize: 12, fontWeight: '700' }}>
        {recording ? 'Stop' : submitting ? 'Sending' : 'Voice'}
      </Text>
    </Pressable>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
