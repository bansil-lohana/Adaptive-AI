import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AnalysisState = 'idle' | 'capturing' | 'error';

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const capturingRef = useRef(false);
  const closingRef = useRef(false);
  const mountedRef = useRef(true);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [error, setError] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedUri, setCapturedUri] = useState('');

  const handleStopCamera = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    capturingRef.current = false;
    cameraRef.current = null;
    if (mountedRef.current) {
      setAnalysisState('idle');
      setIsCameraOpen(false);
      setCameraReady(false);
    }
    closeTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) router.back();
    }, 80);
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleStopCamera();
      return true;
    });

    return () => {
      mountedRef.current = false;
      backSubscription.remove();
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      capturingRef.current = false;
      cameraRef.current = null;
    };
  }, [handleStopCamera]);

  const capturePreview = async () => {
    if (!isCameraOpen || !cameraRef.current || !cameraReady || capturingRef.current || closingRef.current) return;
    setError('');
    setAnalysisState('capturing');
    capturingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (mountedRef.current) {
        setCapturedUri(photo.uri);
        setAnalysisState('idle');
      }
    } catch {
      if (mountedRef.current) {
        setAnalysisState('error');
        setError(`Capture error: ${getErrorMessage(error)}`);
      }
    } finally {
      capturingRef.current = false;
    }
  };

  const requestCameraAccess = async () => {
    setError('');
    try {
      const result = await requestPermission();
      if (!result.granted) {
        setError(result.canAskAgain ? 'Camera permission was not granted. Allow access and try again.' : 'Camera permission is blocked. Enable camera access in your browser or device settings.');
      }
    } catch (permissionError) {
      setError(`Permission error: ${getErrorMessage(permissionError)}`);
    }
  };

  if (!permission?.granted) {
    return <View style={styles.permissionScreen}><StatusBar style="light" /><View style={{ paddingTop: insets.top + 16, paddingHorizontal: 24 }}><Pressable accessibilityRole="button" accessibilityLabel="Close live camera" onPress={handleStopCamera} style={styles.headerButton}><Feather name="arrow-left" size={21} color="#FFF" /></Pressable><Text style={styles.permissionTitle}>Live AI Camera</Text><Text style={styles.permissionText}>Allow camera access so you can preview study material with Adaptive AI.</Text>{error ? <Text accessibilityRole="alert" style={styles.permissionError}>{error}</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel="Allow camera access" onPress={requestCameraAccess} style={styles.permissionButton}><Feather name="camera" size={19} color="#102B3F" /><Text style={styles.permissionButtonText}>Allow camera access</Text></Pressable></View></View>;
  }

  if (!isCameraOpen) return <View style={styles.cameraScreen} />;

  const isCapturing = analysisState === 'capturing';
  return <View style={styles.cameraScreen}>
    <StatusBar style="light" />
    <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" flash={flash} onCameraReady={() => { setCameraReady(true); setError(''); }} onMountError={(event) => { setCameraReady(false); setAnalysisState('error'); setError(`Camera mount error: ${getErrorMessage(event)}`); }}>
      <View style={styles.scrim} pointerEvents="box-none">
        <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="Close live camera" onPress={handleStopCamera} style={({ pressed }) => [styles.headerButton, { opacity: pressed ? .7 : 1 }]}><Feather name="arrow-left" size={21} color="#FFF" /></Pressable>
          <Text style={styles.headerTitle}>LIVE CAMERA</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'} onPress={() => setFlash(value => value === 'on' ? 'off' : 'on')} style={({ pressed }) => [styles.headerButton, { opacity: pressed ? .7 : 1 }]}><Feather name="zap" size={19} color={flash === 'on' ? '#7EE5D5' : '#FFF'} /></Pressable>
        </View>
        <View style={styles.previewContent} pointerEvents="box-none">
           <View style={styles.statusPill}><View style={[styles.statusDot, { backgroundColor: isCapturing ? '#F07D6D' : '#7EE5D5' }]} /><Text style={styles.statusText}>{isCapturing ? 'CAPTURING PREVIEW' : 'CAMERA PREVIEW'}</Text></View>
           <View style={styles.recognitionFrame}><View style={[styles.corner, styles.cornerTopLeft]} /><View style={[styles.corner, styles.cornerTopRight]} /><View style={[styles.corner, styles.cornerBottomLeft]} /><View style={[styles.corner, styles.cornerBottomRight]} /><View style={styles.frameHint}><Feather name="maximize" size={18} color="#D7EBE9" /><Text style={styles.frameHintTitle}>{isCapturing ? 'Capturing study material...' : cameraReady ? 'Point at a question or study material' : 'Starting camera preview...'}</Text>{!isCapturing && <Text style={styles.frameHintText}>AI vision analysis will be available when connected.</Text>}</View></View>
        </View>
        <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 18) }]} pointerEvents="box-none">
           <View style={styles.responsePanel}><View style={styles.responseHeader}><View style={styles.responseBrand}><View style={styles.responseIcon}><Feather name="zap" size={16} color="#102B3F" /></View><Text style={styles.responseBrandText}>Adaptive AI</Text></View><Text style={styles.responseState}>{isCapturing ? 'CAPTURING' : cameraReady ? 'PREVIEW READY' : 'STARTING'}</Text></View><ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 74 }}><Text style={styles.responseText}>{error || capturedUri ? (error || 'Preview captured. Vision analysis is not connected in this prototype.') : 'Camera preview is ready. Vision analysis is not connected in this prototype.'}</Text>{error && <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={() => { setError(''); setAnalysisState('idle'); }} style={styles.tryAgain}><Text style={styles.tryAgainText}>Try again</Text></Pressable>}</ScrollView></View>
           <Pressable accessibilityRole="button" accessibilityLabel={isCapturing ? 'Capturing camera preview' : 'Capture camera preview'} onPress={capturePreview} disabled={!cameraReady || isCapturing} style={({ pressed }) => [styles.recordButtonWrap, { opacity: !cameraReady || isCapturing ? .5 : pressed ? .8 : 1 }]}><View style={[styles.recordButton, isCapturing && styles.recordButtonActive]}>{isCapturing ? <ActivityIndicator color="#102B3F" /> : <Feather name="camera" size={26} color="#102B3F" />}</View><Text style={styles.recordLabel}>{isCapturing ? 'Capturing…' : 'Capture Preview'}</Text></Pressable>
        </View>
      </View>
    </CameraView>
  </View>;
}

const styles = StyleSheet.create({
  cameraScreen: { flex: 1, backgroundColor: '#0B202B' },
  scrim: { flex: 1, backgroundColor: '#07192344', justifyContent: 'space-between' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#102B3FCC', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 13, fontWeight: '700', letterSpacing: 2.2 },
  previewContent: { flex: 1, alignItems: 'center', paddingTop: 18, paddingHorizontal: 26 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#102B3FCC' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  recognitionFrame: { width: '100%', maxWidth: 330, height: 210, marginTop: 46, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#7EE5D5', borderWidth: 2 },
  cornerTopLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  cornerTopRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 10 },
  cornerBottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 10 },
  cornerBottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 10 },
  frameHint: { alignItems: 'center', paddingHorizontal: 26 },
  frameHintTitle: { color: '#FFF', textAlign: 'center', fontSize: 15, fontWeight: '600', marginTop: 10 },
  frameHintText: { color: '#D7EBE9', textAlign: 'center', fontSize: 12, marginTop: 7 },
  bottomArea: { paddingHorizontal: 20, alignItems: 'center' },
  responsePanel: { width: '100%', borderRadius: 18, padding: 16, backgroundColor: '#102B3FEE', borderWidth: 1, borderColor: '#7EE5D555', marginBottom: 18 },
  responseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  responseBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  responseIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#7EE5D5', alignItems: 'center', justifyContent: 'center' },
  responseBrandText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  responseState: { color: '#7EE5D5', fontSize: 9, fontWeight: '700', letterSpacing: .7 },
  responseText: { color: '#D7EBE9', fontSize: 13, lineHeight: 19, marginTop: 12 },
  tryAgain: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  tryAgainText: { color: '#7EE5D5', fontWeight: '700' },
  recordButtonWrap: { alignItems: 'center', minHeight: 96, justifyContent: 'flex-start' },
  recordButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF', borderWidth: 6, borderColor: '#7EE5D5', alignItems: 'center', justifyContent: 'center' },
  recordButtonActive: { borderColor: '#F07D6D', backgroundColor: '#FFF' },
  stopIcon: { width: 22, height: 22, borderRadius: 5, backgroundColor: '#F07D6D' },
  recordLabel: { color: '#FFF', fontSize: 13, fontWeight: '700', marginTop: 8 },
  recordingLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  recordingLineText: { color: '#F6CDBD', fontSize: 11, fontWeight: '600' },
  permissionScreen: { flex: 1, backgroundColor: '#102B3F' },
  permissionTitle: { color: '#FFF', fontSize: 28, fontWeight: '700', marginTop: 28 },
  permissionText: { color: '#D7EBE9', fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 340 },
  permissionButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#7EE5D5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 28 },
  permissionButtonText: { color: '#102B3F', fontWeight: '700', fontSize: 15 },
  permissionError: { color: '#FFD0C7', fontSize: 13, lineHeight: 19, marginTop: 18 },
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  if (error && typeof error === 'object' && 'nativeEvent' in error) {
    const nativeEvent = error.nativeEvent;
    if (nativeEvent && typeof nativeEvent === 'object' && 'message' in nativeEvent && typeof nativeEvent.message === 'string') return nativeEvent.message;
  }
  return 'The camera operation failed.';
}