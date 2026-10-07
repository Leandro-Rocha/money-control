// Preferências de aparência guardadas em cookie, lidas no layout (sem piscar).
// Mesmo padrão do cookie de privacidade (money_control_privacy_active).

export const ACCENT_COOKIE = "money_control_accent";
export const MOTION_COOKIE = "money_control_motion";
export const COUNTUP_COOKIE = "money_control_countup";

export type AccentId = "teal" | "verde" | "cobalto" | "grafite" | "violeta" | "terracota";

export interface AccentPreset {
  id: AccentId;
  label: string;
  accent: string;
  soft: string;
  ink: string;
}

// Os mesmos valores estão em src/app/globals.css (blocos [data-accent]);
// globals.test.ts confere que batem.
export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: "teal", label: "Verde-azulado", accent: "#0d9488", soft: "#e6f7f5", ink: "#0f766e" },
  { id: "verde", label: "Verde-sinal", accent: "#0e9f6e", soft: "#e7f6ef", ink: "#0b7a55" },
  { id: "cobalto", label: "Cobalto", accent: "#2563eb", soft: "#eaf1ff", ink: "#1d4ed8" },
  { id: "grafite", label: "Grafite", accent: "#111827", soft: "#eef0f3", ink: "#111827" },
  { id: "violeta", label: "Violeta", accent: "#7c3aed", soft: "#f3edff", ink: "#6d28d9" },
  { id: "terracota", label: "Terracota", accent: "#c2552d", soft: "#fdf0ea", ink: "#a3431f" },
];

export const DEFAULT_ACCENT: AccentId = "teal";

export type MotionPref = "on" | "off";
export type CountUpPref = "on" | "off";

export function parseAccent(v: string | null | undefined): AccentId {
  return ACCENT_PRESETS.find((p) => p.id === v)?.id ?? DEFAULT_ACCENT;
}

export function parseMotion(v: string | null | undefined): MotionPref {
  return v === "off" ? "off" : "on";
}

export function parseCountUp(v: string | null | undefined): CountUpPref {
  return v === "off" ? "off" : "on";
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
}

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

export function applyAccent(id: AccentId) {
  writeCookie(ACCENT_COOKIE, id);
  const root = document.documentElement;
  const set = () => {
    root.dataset.accent = id;
  };
  const doc = document as DocWithVT;
  if (doc.startViewTransition && !root.classList.contains("motion-off")) doc.startViewTransition(set);
  else set();
}

export function applyMotion(pref: MotionPref) {
  writeCookie(MOTION_COOKIE, pref);
  document.documentElement.classList.toggle("motion-off", pref === "off");
}

export function applyCountUp(pref: CountUpPref) {
  writeCookie(COUNTUP_COOKIE, pref);
  document.documentElement.classList.toggle("countup-off", pref === "off");
}
