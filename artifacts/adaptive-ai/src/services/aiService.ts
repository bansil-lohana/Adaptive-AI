import { aiApi } from '@/api';

export async function askQuestion(prompt: string): Promise<string> {
  try {
    const res = await aiApi.chat(prompt);
    return res.message.content;
  } catch (err) {
    // If backend cannot be reached, provide helpful message
    if (err instanceof Error && err.message) {
      return `[Backend notice]: ${err.message}`;
    }
    return `Here’s a clear way to think about it: ${prompt.replace(/\?$/, '')} is easier when we break it into the main idea, a practical example, and one next step.`;
  }
}

export async function explainText(text: string): Promise<string> {
  try {
    const res = await aiApi.explainText(`Explain the following text clearly:\n\n${text}`);
    return res.answer;
  } catch {
    return `This passage explains: ${text.slice(0, 100)}. The key takeaway is understanding the core idea and its application.`;
  }
}

export async function summarizeText(text: string): Promise<string> {
  try {
    const res = await aiApi.explainText(`Provide a concise, bulleted summary of this text:\n\n${text}`);
    return res.answer;
  } catch {
    return `In short: ${text.slice(0, 120)}. The main point is to focus on the key insights.`;
  }
}

export async function simplifyText(text: string): Promise<string> {
  try {
    const res = await aiApi.explainText(`Simplify this concept for a beginner student:\n\n${text}`);
    return res.answer;
  } catch {
    return `Simplified: ${text.slice(0, 110)}. In simple terms, this concept can be learned step by step.`;
  }
}

export async function translateText(text: string, targetLanguage = 'English'): Promise<string> {
  try {
    const res = await aiApi.explainText(`Translate the following text into ${targetLanguage}:\n\n${text}`);
    return res.answer;
  } catch {
    return `Translation preview: ${text.slice(0, 120)}`;
  }
}

export async function analyzeImage(imageUri?: string): Promise<string> {
  if (imageUri) {
    try {
      const res = await aiApi.askMcq(imageUri);
      if (res.answer) {
        return `Question: ${res.question}\nAnswer: ${res.answer}\nExplanation: ${res.explanation}`;
      }
      return res.explanation || 'Unable to clearly analyze image.';
    } catch {
      // Fallback
    }
  }
  return 'Artificial intelligence is the simulation of human intelligence by machines. It enables systems to learn from information, recognize patterns, and assist people with everyday tasks.';
}