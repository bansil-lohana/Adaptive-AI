import { z } from "zod";
import { logger } from "../lib/logger";
import { errors } from "../lib/errors";
import { extractedTimetableSchema, mcqResultSchema } from "../validation/schemas";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const TIMEOUT_MS = 35_000;

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string };
};

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw errors.gemini("Gemini is not configured. Set GEMINI_API_KEY on the server.");
  }
  return key;
}

function extractText(payload: GeminiResponse): string {
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw errors.gemini("The AI provider returned an empty response.");
  }
  return text;
}

function parseJsonPayload(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw errors.gemini("The AI provider returned invalid JSON.");
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContent(parts: GeminiPart[], attempts = 3): Promise<string> {
  const apiKey = getApiKey();
  const model = DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as GeminiResponse;
      if (!response.ok) {
        const message = payload.error?.message || `Gemini request failed (${response.status})`;
        if (isRetryable(response.status) && attempt < attempts) {
          logger.warn({ status: response.status, attempt }, "Retrying Gemini request");
          await sleep(400 * 2 ** (attempt - 1));
          continue;
        }
        throw errors.gemini(message);
      }
      return extractText(payload);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.name === "AbortError") {
        throw errors.gemini("The AI provider timed out. Please try again.");
      }
      if (attempt < attempts) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      if (error && typeof error === "object" && "code" in error) throw error;
      logger.error({ err: error }, "Gemini request failed");
      throw errors.gemini("Unable to reach the AI provider.");
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : errors.gemini("Unable to reach the AI provider.");
}

export async function generateText(prompt: string): Promise<string> {
  return generateContent([{ text: prompt }]);
}

export async function extractTimetableFromFile(input: {
  mimeType: string;
  data: string;
}) {
  const raw = await generateContent([
    {
      text: `Extract a university class timetable from this file.
Return JSON only in this exact shape:
{"entries":[{"subject":"","code":"","teacher":"","day":"Monday","startTime":"09:00","endTime":"10:00","room":""}]}
Rules:
- Use 24-hour HH:MM times.
- day must be a weekday name.
- Do not invent classes that are not visible.
- If nothing can be read, return {"entries":[]}.`,
    },
    { inlineData: { mimeType: input.mimeType, data: input.data } },
  ]);

  try {
    return extractedTimetableSchema.parse(parseJsonPayload(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw errors.validation("Timetable extraction did not match the expected schema.", error.flatten());
    }
    throw error;
  }
}

export async function analyzeMcqImage(input: { mimeType: string; data: string }) {
  const raw = await generateContent([
    {
      text: `Analyze this exam/MCQ image.
Return JSON only:
{"readable":true,"question":"","options":["A) ..."],"answer":"","explanation":"","confidence":0.0}
If the image is blurry, cropped, or unreadable, return:
{"readable":false,"question":null,"options":[],"answer":null,"explanation":"Unable to clearly read the question. Please capture a clearer image.","confidence":0}
Never guess when the question cannot be read clearly.`,
    },
    { inlineData: { mimeType: input.mimeType, data: input.data } },
  ]);

  try {
    return mcqResultSchema.parse(parseJsonPayload(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw errors.validation("MCQ analysis did not match the expected schema.", error.flatten());
    }
    throw error;
  }
}

export async function answerWithContext(prompt: string): Promise<string> {
  return generateText(prompt);
}
