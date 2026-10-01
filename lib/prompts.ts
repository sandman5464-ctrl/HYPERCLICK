import fs from "node:fs";
import path from "node:path";
import type { Brand } from "./brand";

/**
 * Words a small streetwear brand actually types, turned into set, light, and space.
 * "minimal" is the v1 guide's example. Edit the phrases here.
 * Unknown words are resolved in translateVibe. They are never returned raw.
 */
const VIBE_MAP: Record<string, string> = {
  minimal:
    "seamless backdrop, soft gradient, diffused directional light, generous negative space",
  clean: "clear ground, even light, no props, the garment isolated and readable",
  quiet: "hushed set, low contrast, soft falloff, almost no color in the room",
  calm: "still air, symmetrical frame, slow light, nothing rushing the garment",
  luxury: "quiet materials, low contrast, one reflective plane, unhurried light",
  premium: "dense cloth, a controlled highlight, one expensive surface, no clutter",
  oldmoney: "stone or plaster, low contrast, window light, the piece understated",
  gritty: "concrete and asphalt, hard side light, visible grain, unpolished surfaces",
  raw: "an unfinished wall, honest texture, light that does not flatter, the garment unstyled",
  street: "a city ground plane, late daylight, a wall or curb, no crowd",
  nocturnal: "low-key night set, a single hard rim light, deep shadow, cool black surroundings",
  night: "a night exterior reduced to one wall, a single practical, the garment in a pool of light",
  dark: "a black field, a narrow pool of light on the garment, edges falling off fast",
  precise: "tight registration, measured spacing, crisp edges, nothing extra in frame",
  sharp: "crisp edge light, a tight read of the cut, no haze, geometry in the set",
  bold: "one strong shape in the set, high separation between garment and ground, photographic not graphic",
  loud: "hard contrast in the room, one saturated edge of light, the garment free of type",
  soft: "wrapped light, low contrast, the cloth readable as touch, no hard shadow",
  airy: "high key, space above the garment, thin light, a pale seamless ground",
  warm: "a tungsten practical, amber falloff, plaster or wood underfoot, the garment's color left true",
  cold: "daylight-balanced hard light, a pale ground, steel or glass, the garment not recolored",
  golden: "low sun, a long shadow, a warm edge on the cloth, the set simple enough that the hour is the grade",
  sport: "a clean athletic volume, even overhead light, a floor with one line, no crowd",
  athletic: "performance cloth under a high even light, a plain court or track surface, no added marks",
  technical: "matte panels, seams visible, cool even light, a lab-clean ground",
  vintage: "aged plaster, a warm practical, gentle falloff, the garment not distressed by the grade",
  archive: "museum quiet, a neutral ground, even light, the piece presented as an object",
  heritage: "a worn-in room, wood and wool tones, window light, the piece shown with restraint",
  industrial: "warehouse volume, a cool practical, metal and concrete, the garment still the hero",
  brutalist: "cast concrete, hard geometry, one shaft of light, the garment as the only soft form",
  neon: "the room dark, one neon edge in the accent only, the garment lit separately so the color does not dye it",
  monochrome: "near-black and bone, one tonal range, texture doing the work, the accent only in the light",
  muted: "a desaturated room, the garment's true color left alone, soft light, no grade that repaints it",
  editorial: "a fashion-story frame, the object considered, negative space, light from a large source",
  campaign: "a finished advertising frame, one idea, the garment large, the set in support",
  cinematic: "motivated light, a little depth in the room, the garment in the focal plane, no title card",
  moody: "deep shadow, one motivated light, the garment emerging, no fog",
  noir: "black and a single hard light, the garment catching the edge, no street crowd",
  oversized: "the volume of the garment is the subject, room to see the drape, a low camera, ground visible",
  heavy: "weight in the cloth, a low camera, dense shadow under the hem, a dark ground",
  tailored: "a close read of shoulder and seam, controlled light, a plain wall, nothing slouching in the set",
  utility: "pockets and hardware visible, a bench or concrete, practical light, no costume styling",
  workwear: "work cloth under an honest practical, a plain bench, stitching readable, no prop pile",
  military: "utilitarian light, hardware readable, a sand or grey ground only if the garment is not already that color",
  skate: "low afternoon sun, smooth concrete, a hard shadow, the garment at rest, no trick",
  coastal: "open pale light, a wall washed by sun, clear air, no beach clutter",
  rainy: "wet ground, cool overcast, one reflection, the garment dry and sharp against the sheen",
  futuristic: "a smooth pale volume, one hard reflection, cool light, the construction of the garment still real",
  chrome: "one metal reflection, cool light, the garment matte against the shine",
  y2k: "a hard flash feel, a simple pale ground, the silhouette graphic, no prop pile",
  hype: "a tight hero, high clarity, a clean ground, the object desirable without a crowd or a caption",
  youth: "plain daylight, a simple urban corner, unfussy, the garment looking lived-with",
  serious: "formal stillness, a neutral ground, even light, no wink in the styling",
  playful: "one unexpected color in the light only, a simple set, the garment still an object",
  romantic: "window light, a soft edge, a warm-neutral wall, the garment close and unhurried",
  feminine: "a softer wrap of light, a pale ground, the silhouette given room, no cliché props",
  masculine: "harder side light, a darker ground, the shoulder's structure visible, no pose theater",
  denim: "the indigo stays in the cloth, a plain wall, daylight, the weave readable",
  leather: "a controlled highlight on the surface, a dark ground, the sheen real rather than plastic",
  silk: "light that slides, a quiet ground, the drape visible, nothing busy behind it",
  gorp: "open sky light, a rock or path edge, outdoor cloth, no expedition theater",
  gorpcore: "open sky light, a rock or path edge, outdoor cloth, no expedition theater",
};

const STEM_DIRECTION: Array<[RegExp, string]> = [
  [/warm|sun|gold|amber|honey/, "a tungsten practical, plaster or wood underfoot, long warm falloff, the garment's color left true"],
  [/cold|ice|cool|steel|silver|frost/, "cool hard light, a pale ground, one metal or glass plane, the garment not recolored"],
  [/dark|shadow|black|midnight/, "a black field, a narrow pool of light on the garment, edges falling off fast"],
  [/soft|calm|gentle|hush/, "wrapped light, low contrast, the cloth readable as touch, no hard shadow"],
  [/hard|rough|concrete|grit|urban/, "concrete underfoot, hard side light, visible grain, the garment unpolished by the grade"],
  [/fast|loud|bold|energy|flash/, "high separation, one graphic shape in the set, the garment held still and sharp"],
  [/neon|cyber|future|chrome/, "one hard reflection, cool light, the garment matte against a smooth volume"],
  [/vintage|archive|heritage|retro/, "aged plaster, window light, gentle falloff, the piece presented as an object"],
  [/rain|wet|storm/, "wet ground, cool overcast, one reflection, the garment dry and sharp"],
  [/earth|forest|moss|olive/, "a muted natural ground, open daylight, nothing crowding the garment"],
  [/pink|rose|blush/, "a pale warm ground, soft wrap light, the silhouette given room"],
  [/ocean|navy|sea/, "cool open light, a simple pale wall, no seascape props"],
];

const UNLISTED_DIRECTION =
  "one surface under the garment, one directional light, empty space around the piece, the accent used once in the light";

function normalizeVibe(word: string): string {
  return word.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function translateVibe(word: string): string {
  const key = normalizeVibe(word);
  if (key && VIBE_MAP[key]) return VIBE_MAP[key];

  const known = Object.keys(VIBE_MAP).sort((a, b) => b.length - a.length);
  for (const name of known) {
    if (name.length >= 5 && key.includes(name)) return VIBE_MAP[name];
  }

  for (const [pattern, phrase] of STEM_DIRECTION) {
    if (key && pattern.test(key)) return phrase;
  }

  return UNLISTED_DIRECTION;
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

function loadTasteFile(): string {
  const file = path.join(process.cwd(), "prompts", "seedance.md");
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Could not read prompts/seedance.md (${detail}).`);
  }
}

function section(name: "STILL" | "SEEDANCE"): string {
  const source = loadTasteFile();
  const match = source.match(new RegExp(`<!--\\s*${name}\\s*-->([\\s\\S]*?)(?=<!--\\s*(?:STILL|SEEDANCE)\\s*-->|$)`));
  if (!match) {
    throw new Error(`prompts/seedance.md is missing the ${name} section.`);
  }
  return match[1].replace(/<!--[\s\S]*?-->/g, "").trim();
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  const filled = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : token;
  });
  const leftover = filled.match(/\{[a-zA-Z0-9_]+\}/);
  if (leftover) {
    throw new Error(`Seedance template has an unfilled variable: ${leftover[0]}`);
  }
  return filled.replace(/\n{3,}/g, "\n\n").trim();
}

function logoNote(hasLogo: boolean, stage: "still" | "video"): string {
  if (stage === "still") {
    return hasLogo
      ? "A second reference image is the logo. Place it once, small, and undistorted. Never cover the garment's existing marks."
      : "No logo file was provided. Do not invent a wordmark, emblem, or slogan.";
  }
  return hasLogo
    ? "If a logo is already in the still, keep it still, small, and readable."
    : "Do not generate a logo or wordmark.";
}

export function buildStillPrompt(brand: Brand): string {
  const [primary, secondary, tertiary] = directions(brand);
  return fillTemplate(section("STILL"), {
    brandName: brand.name.trim(),
    primary,
    secondary,
    tertiary,
    accent: accent(brand),
    logoNote: logoNote(brand.hasLogo, "still"),
  });
}

export function buildVideoPrompt(brand: Brand): string {
  const [primary, secondary, tertiary] = directions(brand);
  return fillTemplate(section("SEEDANCE"), {
    brandName: brand.name.trim(),
    primary,
    secondary,
    tertiary,
    accent: accent(brand),
    logoNote: logoNote(brand.hasLogo, "video"),
  });
}
