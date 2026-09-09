import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { GoogleGenAI, type GenerateContentParameters, type Schema } from "@google/genai";

import { env } from "../config/env";
import { AI_REQUEST } from "./ai.constants";

/** The one call this app makes to a model, injectable so tests never hit Vertex. */
export type GenerateContent = (
  request: GenerateContentParameters,
) => Promise<{ text?: string; usageMetadata?: unknown }>;

/** 429 and 5xx are the portal being busy; anything else is our own request. */
function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number; code?: number })?.status ?? (error as { code?: number })?.code;
  return status === 429 || (typeof status === "number" && status >= 500);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The single place that talks to Vertex AI. Callers hand it a document and a
 * schema and get parsed JSON back — model, region and credentials never leak
 * out of here. Credentials come from Application Default Credentials, so no key
 * passes through this code.
 */
@Injectable()
export class VertexClient {
  private readonly logger = new Logger(VertexClient.name);
  private generate: GenerateContent | null = null;

  /** False until a project is configured, so the app boots fine without GCP. */
  get isConfigured(): boolean {
    return Boolean(env.ai.projectId);
  }

  /** Tests (and a future local model) swap the transport without touching callers. */
  useTransport(generate: GenerateContent): void {
    this.generate = generate;
  }

  async extractJson<T>(
    instruction: string,
    prompt: string,
    document: { data: Buffer; mimeType: string },
    schema: Schema,
  ): Promise<T> {
    if (document.data.byteLength > AI_REQUEST.maxDocumentBytes) {
      throw new Error(`document is ${document.data.byteLength} bytes, over the inline limit`);
    }

    const generate = this.transport();
    const request: GenerateContentParameters = {
      model: env.ai.model,
      contents: {
        role: "user",
        parts: [
          { inlineData: { mimeType: document.mimeType, data: document.data.toString("base64") } },
          { text: prompt },
        ],
      },
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: AI_REQUEST.temperature,
        maxOutputTokens: AI_REQUEST.maxOutputTokens,
        thinkingConfig: { thinkingBudget: AI_REQUEST.thinkingBudget },
        abortSignal: AbortSignal.timeout(AI_REQUEST.timeoutMs),
      },
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < AI_REQUEST.maxRetries; attempt++) {
      try {
        const response = await generate(request);
        // One line per call, so spend can be reconciled against the bill.
        this.logger.log(`Vertex ${env.ai.model}: ${JSON.stringify(response.usageMetadata ?? {})}`);

        const text = response.text ?? "";
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new Error(`Vertex returned invalid JSON: ${text.slice(0, 200)}`);
        }
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === AI_REQUEST.maxRetries - 1) break;
        await sleep(2 ** attempt * 1000);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** Built on first use: constructing the client reads credentials from disk. */
  private transport(): GenerateContent {
    if (this.generate) return this.generate;
    if (!this.isConfigured) {
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่า Vertex AI");
    }

    const client = new GoogleGenAI({
      vertexai: true,
      project: env.ai.projectId,
      location: env.ai.location,
    });
    this.logger.log(`Vertex AI ready: ${env.ai.model} in ${env.ai.location}`);

    this.generate = (request) => client.models.generateContent(request);
    return this.generate;
  }
}
