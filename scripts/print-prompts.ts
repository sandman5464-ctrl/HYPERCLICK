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
expect(translateVibe("unmapped-taste") === "unmapped-taste", "unknown vibes should pass through");

expect(still.includes("Northline"), "still prompt missing brand");
expect(still.includes(minimal), "still prompt missing the minimal direction");
expect(still.includes("#E7D7C1"), "still prompt missing accent");
expect(still.includes("Preserve it exactly"), "still prompt missing product lock");
expect(still.includes("9:16"), "still prompt missing vertical format");

expect(video.startsWith("[STYLE PREFIX PLACEHOLDER"), "style prefix placeholder missing");
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
expect(!video.includes("{subject}"), "unfilled {subject}");
expect(!video.includes("{stylePrefix}"), "unfilled {stylePrefix}");
expect(!/\{[a-zA-Z0-9_]+\}/.test(video), "a template variable was left unfilled");

console.log("=== STILL ===\n");
console.log(still);
console.log("\n=== SEEDANCE ===\n");
console.log(video);

if (failures.length > 0) {
  console.error("\nPrompt check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
