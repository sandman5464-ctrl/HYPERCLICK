export type Brand = {
  name: string;
  vibes: [string, string, string];
  accentColor: string;
  hasLogo: boolean;
};

export function isAccentHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
