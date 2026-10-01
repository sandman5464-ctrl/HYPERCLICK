import "server-only";
import { fal } from "@fal-ai/client";
import { GoogleGenAI, type Part } from "@google/genai";
import { VERTICAL } from "./format";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3-pro-image";
const IMAGE_SIZE = process.env.GEMINI_IMAGE_SIZE?.trim() || "2K";
const SEEDANCE_MODEL =
  process.env.SEEDANCE_MODEL?.trim() || "bytedance/seedance-2.0/image-to-video";

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

export type StageImage = {
  bytes: Buffer;
  mimeType: string;
};

export class PipelineConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(configurationMessage(missing));
    this.name = "PipelineConfigError";
    this.missing = missing;
  }
}

export function missingKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.GEMINI_API_KEY?.trim()) missing.push("GEMINI_API_KEY");
  if (!process.env.FAL_KEY?.trim()) missing.push("FAL_KEY");
  return missing;
}

export function configurationMessage(missing: string[]): string {
  const names = missing.join(" and ");
  return `KOVA cannot generate yet. Set ${names} on the server, then restart. No image or video was requested.`;
}

function requireConfig(): void {
  const missing = missingKeys();
  if (missing.length > 0) {
    throw new PipelineConfigError(missing);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Generation failed.";
  let message = raw;
  const secrets = [process.env.GEMINI_API_KEY, process.env.FAL_KEY];
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  return message;
}

export { publicMessage };

/**
 * Stage 1. Nano Banana Pro edits the product photo into a 9:16 still.
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 * SDK: @google/genai generateContent + imageConfig (current GenerateContentConfig).
 */
export async function generateStill(input: {
  prompt: string;
  product: StageImage;
  logo?: StageImage;
}): Promise<StageImage> {
  requireConfig();

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents: Part[] = [
    { text: input.prompt },
    {
      inlineData: {
        mimeType: input.product.mimeType,
        data: input.product.bytes.toString("base64"),
      },
    },
  ];

  if (input.logo) {
    contents.push({
      inlineData: {
        mimeType: input.logo.mimeType,
        data: input.logo.bytes.toString("base64"),
      },
    });
  }

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: VERTICAL.aspectRatio,
        imageSize: IMAGE_SIZE,
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (!data) continue;
    return {
      bytes: Buffer.from(data, "base64"),
      mimeType: part.inlineData?.mimeType || "image/png",
    };
  }

  throw new Error("The image model did not return a still. No video was started.");
}

/**
 * Stage 2. Seedance 2.0 image-to-video via fal.ai.
 * Docs: https://fal.ai/models/bytedance/seedance-2.0/image-to-video/api
 * Submit, poll status, then read the result. Listed price is $0.3024/sec,
 * about $4.54 for this 15s clip. This function is not called without FAL_KEY.
 */
export async function generateVideo(input: {
  prompt: string;
  still: StageImage;
}): Promise<string> {
  requireConfig();
  fal.config({ credentials: process.env.FAL_KEY });

  const imageUrl = await fal.storage.upload(
    new Blob([new Uint8Array(input.still.bytes)], { type: input.still.mimeType }),
  );

  const submitted = await fal.queue.submit(SEEDANCE_MODEL, {
    input: {
      prompt: input.prompt,
      image_url: imageUrl,
      resolution: VERTICAL.resolution,
      duration: VERTICAL.durationSeconds,
      aspect_ratio: VERTICAL.aspectRatio,
      // v1 is a silent picture. Do not add a voice or music bed here.
      generate_audio: false,
    },
  });

  const requestId = submitted.request_id;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  let status = await fal.queue.status(SEEDANCE_MODEL, { requestId, logs: true });
  while (status.status !== "COMPLETED") {
    if (Date.now() > deadline) {
      throw new Error("Seedance did not finish within 8 minutes. No video URL was returned.");
    }
    await sleep(POLL_INTERVAL_MS);
    status = await fal.queue.status(SEEDANCE_MODEL, { requestId, logs: true });
  }

  const result = await fal.queue.result(SEEDANCE_MODEL, { requestId });
  const url = (result.data as { video?: { url?: string } } | undefined)?.video?.url;
  if (!url || !isHttpUrl(url)) {
    throw new Error("Seedance finished without a video URL.");
  }
  return url;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
