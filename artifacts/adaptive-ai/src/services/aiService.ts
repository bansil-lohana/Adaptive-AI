import { aiApi } from '@/api';

export async function askQuestion(prompt: string): Promise<string> {
  const res = await aiApi.chat(prompt);
  return res.message.content;
}

export async function generateAnswer(prompt: string): Promise<string> {
  const res = await aiApi.generateText(prompt);
  return res.answer;
}

export async function explainText(text: string): Promise<string> {
  const res = await generateText(`Explain the following text clearly:\n\n${text}`);
  return res.answer;
}

export async function summarizeText(text: string): Promise<string> {
  const res = await generateText(`Provide a concise, bulleted summary of this text:\n\n${text}`);
  return res.answer;
}

export async function simplifyText(text: string): Promise<string> {
  const res = await generateText(`Simplify this concept for a beginner student:\n\n${text}`);
  return res.answer;
}

export async function translateText(text: string, targetLanguage = 'English'): Promise<string> {
  const res = await generateText(`Translate the following text into ${targetLanguage}:\n\n${text}`);
  return res.answer;
}

export async function askVoice(audioUri: string): Promise<string> {
  const res = await aiApi.askVoice(audioUri);
  return res.answer;
}

export async function askVoiceBlob(audio: Blob, mimeType: string): Promise<string> {
  const res = await aiApi.askVoiceBlob(audio, mimeType);
  return res.answer;
}

export async function askVoiceTranscript(transcript: string): Promise<string> {
  const res = await aiApi.askVoiceTranscript(transcript);
  return res.answer;
}

export async function analyzeImage(
  imageUri?: string,
  mimeType = 'image/jpeg',
  fileName = 'study-image.jpg',
): Promise<string> {
  if (!imageUri) throw new Error('Choose an image before asking for an explanation.');
  const res = await aiApi.explainImage(imageUri, mimeType, fileName);
  return res.answer;
}

function generateText(content: string) {
  return aiApi.generateText(content);
}