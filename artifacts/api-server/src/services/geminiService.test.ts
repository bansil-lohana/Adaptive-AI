import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
import { errorHandler } from "../middleware/error";
import { generateText } from "./geminiService";

test("Gemini rate limits return a clear JSON error", async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    let providerError: unknown;
    await assert.rejects(generateText("test prompt"), (error: unknown) => {
      providerError = error;
      return error instanceof AppError;
    });

    assert.equal(attempts, 3);
    assert.ok(providerError instanceof AppError);
    let responseStatus = 0;
    let responseBody: unknown;
    const response = {
      status(status: number) {
        responseStatus = status;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      },
    } as unknown as Response;

    errorHandler(
      providerError,
      { path: "/api/ai/chat" } as Request,
      response,
      () => undefined,
    );

    assert.equal(responseStatus, 429);
    assert.deepEqual(responseBody, {
      success: false,
      error: {
        code: "AI_RATE_LIMITED",
        message: "The AI service is temporarily rate-limited. Please try again later.",
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});
