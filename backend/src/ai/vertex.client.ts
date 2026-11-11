import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { GoogleGenAI, type GenerateContentParameters, type Schema } from "@google/genai";

import { env } from "../config/env";
import { AI_REQUEST } from "./ai.constants";

/** The one call this app makes to a model, injectable so tests never hit Vertex. */
export type GenerateContent = (
  request: GenerateContentParameters,
) => Promise<{ text?: string; usageMetadata?: unknown }>;

/** Texts in, one vector per text out, in the same order. Injectable for the same reason. */
export type EmbedTexts = (texts: string[]) => Promise<number[][]>;

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
  private embedder: EmbedTexts | null = null;

  /** False until a project is configured, so the app boots fine without GCP. */
  get isConfigured(): boolean {
    return Boolean(env.ai.projectId);
  }

  /** Tests (and a future local model) swap the transport without touching callers. */
  useTransport(generate: GenerateContent): void {
    this.generate = generate;
  }

  /** The embedding counterpart of useTransport. */
  useEmbedTransport(embed: EmbedTexts): void {
    this.embedder = embed;
  }

  /**
   * One vector per text, for comparing texts with each other. Every vector is
   * made for the same task (semantic similarity), so a stored TOR's vector can
   * be compared with a pasted project's as well as with another TOR's.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const embed = this.embedTransport();

    let lastError: unknown;
    for (let attempt = 0; attempt < AI_REQUEST.maxRetries; attempt++) {
      try {
        const vectors = await embed(texts);
        if (vectors.length !== texts.length || vectors.some((v) => v.length === 0)) {
          throw new Error(`Vertex returned ${vectors.length} embeddings for ${texts.length} texts`);
        }
        return vectors;
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === AI_REQUEST.maxRetries - 1) break;
        await sleep(2 ** attempt * 1000);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async extractJson<T>(
    instruction: string,
    prompt: string,
    /** Read together in one call, in the order the prompt names them. */
    documents: { data: Buffer; mimeType: string }[],
    schema: Schema,
    /** Writing, rather than extracting, wants a longer answer and some variety. */
    overrides: { maxOutputTokens?: number; temperature?: number } = {},
  ): Promise<T> {
    const bytes = documents.reduce((sum, doc) => sum + doc.data.byteLength, 0);
    if (bytes > AI_REQUEST.maxDocumentBytes) {
      throw new Error(`documents are ${bytes} bytes, over the inline limit`);
    }

    const generate = this.transport();
    const request: GenerateContentParameters = {
      model: env.ai.model,
      contents: {
        role: "user",
        parts: [
          ...documents.map((doc) => ({
            inlineData: { mimeType: doc.mimeType, data: doc.data.toString("base64") },
          })),
          { text: prompt },
        ],
      },
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: overrides.temperature ?? AI_REQUEST.temperature,
        maxOutputTokens: overrides.maxOutputTokens ?? AI_REQUEST.maxOutputTokens,
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
    const client = this.client();
    this.logger.log(`Vertex AI ready: ${env.ai.model} in ${env.ai.location}`);

    this.generate = (request) => client.models.generateContent(request);
    return this.generate;
  }

  private embedTransport(): EmbedTexts {
    if (this.embedder) return this.embedder;
    const client = this.client();
    this.logger.log(`Vertex embeddings ready: ${env.ai.embeddingModel} in ${env.ai.location}`);

    this.embedder = async (texts) => {
      const response = await client.models.embedContent({
        model: env.ai.embeddingModel,
        contents: texts,
        config: {
          taskType: "SEMANTIC_SIMILARITY",
          // A long TOR is cut by the model rather than refused.
          autoTruncate: true,
          abortSignal: AbortSignal.timeout(AI_REQUEST.timeoutMs),
        },
      });
      return (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
    };
    return this.embedder;
  }

  private sdk: GoogleGenAI | null = null;

  private client(): GoogleGenAI {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่า Vertex AI");
    }
    this.sdk ??= new GoogleGenAI({
      vertexai: true,
      project: env.ai.projectId,
      location: env.ai.location,
    });
    return this.sdk;
  }
}
