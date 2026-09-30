import fs from "node:fs";
import path from "node:path";
import type { Brand } from "./brand";
import { VERTICAL } from "./format";

/**
 * PLACEHOLDER. Not a style prefix.
 * Sandman: replace this string with your verbatim Style Prefix.
 * Leave it short. Do not invent a long fake prefix here.
 */
export const STYLE_PREFIX =
  "[STYLE PREFIX PLACEHOLDER — replace with Sandman's verbatim prefix]";

/**
 * STARTER MAP — replace this with Sandman's taste. It is the product.
 * "minimal" is the example from the v1 build guide.
 * Unmapped words are returned as typed so the gap stays visible.
 */
const VIBE_STARTER_MAP: Record<string, string> = {
  minimal:
    "seamless backdrop, soft gradient, diffused directional light, generous negative space",
  nocturnal:
    "low-key night set, a single hard rim light, deep shadow, cool black surroundings",
  precise:
    "tight registration, measured spacing, crisp edges, nothing extra in frame",
  gritty:
    "concrete and asphalt, hard side light, visible grain, unpolished surfaces",
  luxury:
    "quiet materials, low contrast, one reflective plane, unhurried light",
};

export function translateVibe(word: string): string {
  const key = word.trim().toLowerCase();
  return VIBE_STARTER_MAP[key] ?? word.trim();
}

function directions(brand: Brand): [string, string, string] {
  return [
    translateVibe(brand.vibes[0]),
    translateVibe(brand.vibes[1]),
    translateVibe(brand.vibes[2]),
  ];
}

function accent(brand: Brand): string {
  return brand.accentColor.trim().toUpperCase();
}

export function buildStillPrompt(brand: Brand): string {
  const [primary, secondary, tertiary] = directions(brand);
  const color = accent(brand);
  const logo = brand.hasLogo
    ? "A second reference image is the logo. Place it once, small, and undistorted. Never lay it over the product's existing marks."
    : "No logo file was provided. Do not invent a wordmark, emblem, or slogan.";

  return [
    `Vertical ${VERTICAL.aspectRatio} campaign still for ${brand.name.trim()}.`,
    "The attached photograph is the product. Preserve it exactly: same silhouette, construction, color, hardware, and any markings already on it. Do not redesign, recolor, or replace it. Build the scene around that product.",
    `Art direction, in this order:\n1. ${primary}\n2. ${secondary}\n3. ${tertiary}`,
    `Accent color ${color} is used once, in the light or a single set element. It is not applied to the product.`,
    logo,
    "One hero product. Photographic. Social-story framing. No headline, no body copy, no extra products, no collage, no warped labels.",
  ].join("\n\n");
}

function loadSeedanceTemplate(): string {
  const file = path.join(process.cwd(), "prompts", "seedance.md");
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Could not read prompts/seedance.md (${detail}).`);
  }
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  const filled = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
  const leftover = filled.match(/\{[a-zA-Z0-9_]+\}/);
  if (leftover) {
    throw new Error(`Seedance template has an unfilled variable: ${leftover[0]}`);
  }
  return filled.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildVideoPrompt(brand: Brand): string {
  const [primary, secondary, tertiary] = directions(brand);
  const name = brand.name.trim();
  const color = accent(brand);
  const template = loadSeedanceTemplate().replace(/<!--[\s\S]*?-->/g, "");

  const constraints = [
    "Match the still. Do not invent a new product or a new setting.",
    "No morphing, no melting fabric, no extra limbs, no duplicate products.",
    "No on-screen captions, subtitles, or generated slogans.",
    `Vertical ${VERTICAL.aspectRatio} only. Duration ${VERTICAL.durationSeconds} seconds.`,
    brand.hasLogo
      ? "If the logo is in the still, keep it stable, small, and readable."
      : "Do not generate a logo or wordmark.",
  ].join("\n");

  return fillTemplate(template, {
    stylePrefix: STYLE_PREFIX,
    subject: `The ${name} product as it appears in the still. Identity is locked: silhouette, materials, color, and markings do not change.`,
    location: `The set already in the still. Hold this art direction: ${primary}.`,
    shot1: `Locked hero. The product is still. Accent ${color} settles in the light and nowhere else — ${primary}.`,
    shot2: `A slow push-in — ${secondary}. The product does not deform.`,
    shot3: `A short lateral drift, then ease — ${tertiary}. The background stays behind the product.`,
    shot4: `Return to a held hero frame. ${name} is the only subject. End on stillness.`,
    camera: "Single camera, slow and weighted. No handheld shake, no crash zoom, no whip pan.",
    stylePrimary: primary,
    styleSecondary: secondary,
    styleAccent: `one occurrence of accent ${color} in the light`,
    constraints,
  });
}
