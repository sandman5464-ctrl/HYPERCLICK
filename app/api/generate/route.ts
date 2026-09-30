import type { Brand } from "@/lib/brand";
import { isAccentHex } from "@/lib/brand";
import { buildStillPrompt, buildVideoPrompt } from "@/lib/prompts";
import {
  configurationMessage,
  generateStill,
  generateVideo,
  missingKeys,
  publicMessage,
  type StageImage,
} from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PRODUCT_BYTES = 12 * 1024 * 1024;
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

type GenerateEvent =
  | { step: "still"; label: "Building your scene…" }
  | { step: "motion"; label: "Directing the shot…" }
  | { step: "done"; videoUrl: string }
  | { step: "error"; message: string };

function jsonError(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error, message, ...extra }, { status });
}

async function readImage(
  entry: FormDataEntryValue | null,
  label: string,
  maxBytes: number,
  required: boolean,
): Promise<{ image?: StageImage; error?: string }> {
  if (entry == null || entry === "") {
    return required ? { error: `Add a ${label}.` } : {};
  }
  if (!(entry instanceof File) || entry.size === 0) {
    return required ? { error: `Add a ${label}.` } : {};
  }
  if (!IMAGE_TYPES.has(entry.type)) {
    return { error: `${label} must be a JPEG, PNG, or WebP.` };
  }
  if (entry.size > maxBytes) {
    return { error: `${label} is too large.` };
  }
  const bytes = Buffer.from(await entry.arrayBuffer());
  return { image: { bytes, mimeType: entry.type } };
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "validation", "The form could not be read. Nothing was generated.");
  }

  const name = String(form.get("brandName") ?? "").trim();
  const vibeValues = [form.get("vibe1"), form.get("vibe2"), form.get("vibe3")].map((value) =>
    String(value ?? "").trim(),
  );
  const accentColor = String(form.get("accentColor") ?? "").trim();

  if (!name || name.length > 80) {
    return jsonError(400, "validation", "Add a brand name. Nothing was generated.");
  }
  if (vibeValues.some((word) => word.length === 0 || word.length > 40)) {
    return jsonError(400, "validation", "Add three vibe words. Nothing was generated.");
  }
  if (!isAccentHex(accentColor)) {
    return jsonError(400, "validation", "Choose an accent color. Nothing was generated.");
  }

  const product = await readImage(form.get("product"), "product photo", MAX_PRODUCT_BYTES, true);
  if (product.error || !product.image) {
    return jsonError(400, "validation", product.error ?? "Add a product photo. Nothing was generated.");
  }
  const logo = await readImage(form.get("logo"), "logo", MAX_LOGO_BYTES, false);
  if (logo.error) {
    return jsonError(400, "validation", `${logo.error} Nothing was generated.`);
  }

  const brand: Brand = {
    name,
    vibes: [vibeValues[0] ?? "", vibeValues[1] ?? "", vibeValues[2] ?? ""],
    accentColor,
    hasLogo: Boolean(logo.image),
  };

  const stillPrompt = buildStillPrompt(brand);
  const videoPrompt = buildVideoPrompt(brand);
  console.log("\n=== KOVA still prompt ===\n" + stillPrompt);
  console.log("\n=== KOVA Seedance prompt ===\n" + videoPrompt);

  const missing = missingKeys();
  if (missing.length > 0) {
    return jsonError(503, "configuration", configurationMessage(missing), { missing });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerateEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        send({ step: "still", label: "Building your scene…" });
        const still = await generateStill({
          prompt: stillPrompt,
          product: product.image!,
          logo: logo.image,
        });

        send({ step: "motion", label: "Directing the shot…" });
        const videoUrl = await generateVideo({ prompt: videoPrompt, still });
        send({ step: "done", videoUrl });
      } catch (error) {
        console.error("KOVA generate failed:", publicMessage(error));
        send({ step: "error", message: `${publicMessage(error)} Nothing was generated.` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
