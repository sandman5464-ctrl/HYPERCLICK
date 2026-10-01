import type { Brand } from "../lib/brand";
import { buildStillPrompt, buildVideoPrompt, translateVibe } from "../lib/prompts";

const brand: Brand = {
  name: "Northline",
  vibes: ["minimal", "nocturnal", "precise"],
  accentColor: "#E7D7C1",
  hasLogo: false,
};

const still = buildStillPrompt(brand);
const video = buildVideoPrompt(brand);

const minimal =
  "seamless backdrop, soft gradient, diffused directional light, generous negative space";

const failures: string[] = [];
function expect(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

expect(translateVibe("minimal") === minimal, "minimal translation drifted from the guide");
expect(translateVibe("MINIMAL") === minimal, "vibe lookup should ignore case");
expect(translateVibe("old money").includes("window light"), "multi-word vibe was not translated");

const unknown = translateVibe("unmapped-taste");
expect(unknown !== "unmapped-taste", "unknown vibe was echoed raw");
expect(!unknown.toLowerCase().includes("unmapped"), "unknown vibe leaked into the direction");
expect(unknown.split(/\s+/).length > 8, "unknown vibe did not become a specific direction");

const warm = translateVibe("sunbleached");
expect(warm !== "sunbleached", "stem match echoed the raw word");
expect(!warm.toLowerCase().includes("sunbleached"), "stem match leaked the raw word");

expect(still.includes("Northline"), "still prompt missing brand");
expect(still.includes(minimal), "still prompt missing the minimal direction");
expect(still.includes("#E7D7C1"), "still prompt missing accent");
expect(still.includes("Preserve it exactly"), "still prompt missing product lock");
expect(still.includes("9:16"), "still prompt missing vertical format");
expect(/no voice/i.test(still), "still prompt does not keep the picture silent");

expect(video.startsWith("Vertical streetwear ad."), "style prefix is not the streetwear default");
expect(!video.includes("STYLE PREFIX PLACEHOLDER"), "placeholder prefix is still in the prompt");
expect(video.includes("SUBJECT:"), "missing SUBJECT");
expect(video.includes("LOCATION:"), "missing LOCATION");
expect(video.includes("ACTION:"), "missing ACTION");
expect(video.includes("SHOT 1 (0:00–0:03)"), "shot timing is not coming from the skeleton");
expect(video.includes("SHOT 4 (0:11–0:15)"), "closing shot timing missing");
expect(video.includes("CAMERA: Vertical 9:16."), "camera line missing");
expect(video.includes("STYLE: 60%"), "60% style weight missing");
expect(video.includes("30%"), "30% style weight missing");
expect(video.includes("10%"), "10% style weight missing");
expect(video.includes("CONSTRAINTS:"), "missing CONSTRAINTS");
expect(/no voiceover/i.test(video), "video prompt does not forbid a voiceover");
expect(/no dialogue/i.test(video), "video prompt does not forbid dialogue");
expect(/no spoken words/i.test(video), "video prompt does not forbid spoken words");
expect(!/narrator|voiceover script|read this line|say the line/i.test(video), "video prompt asks for speech");
expect(!video.includes("{subject}"), "unfilled {subject}");
expect(!video.includes("{stylePrefix}"), "unfilled {stylePrefix}");
expect(!/\{[a-zA-Z0-9_]+\}/.test(video), "a template variable was left unfilled");
expect(!/\{[a-zA-Z0-9_]+\}/.test(still), "a still variable was left unfilled");

console.log("=== STILL ===\n");
console.log(still);
console.log("\n=== SEEDANCE ===\n");
console.log(video);
console.log("\n=== UNKNOWN VIBE ===\n");
console.log(unknown);

if (failures.length > 0) {
  console.error("\nPrompt check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
