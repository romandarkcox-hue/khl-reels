import { ConferenceId } from "./standings";

export type Theme = {
  bgTop: string;
  bgBottom: string;
  glow: string;
  accent: string;
  text: string;
  muted: string;
  rowA: string;
  rowB: string;
  ptsBg: string;
  logoBg: string;
  logoShadow: string;
  up: string;
  down: string;
};

// Запад: светлый «лёд днём». Восток: тёмная «ночь» с тёплым янтарным акцентом.
export const THEMES: Record<ConferenceId, Theme> = {
  west: {
    bgTop: "#F7FAFE",
    bgBottom: "#D9E5F2",
    glow: "rgba(30,91,216,0.14)",
    accent: "#1E5BD8",
    text: "#0B1B33",
    muted: "#5B6C86",
    rowA: "rgba(255,255,255,0.85)",
    rowB: "rgba(255,255,255,0.55)",
    ptsBg: "rgba(30,91,216,0.12)",
    logoBg: "#FFFFFF",
    logoShadow: "0 2px 8px rgba(11,27,51,0.12)",
    up: "#15803D",
    down: "#DC2626",
  },
  east: {
    bgTop: "#12121C",
    bgBottom: "#050508",
    glow: "rgba(245,165,36,0.16)",
    accent: "#F5A524",
    text: "#F6F3EC",
    muted: "#8E8A99",
    rowA: "rgba(255,255,255,0.06)",
    rowB: "rgba(255,255,255,0.03)",
    ptsBg: "rgba(245,165,36,0.16)",
    logoBg: "#FFFFFF",
    logoShadow: "0 2px 10px rgba(0,0,0,0.5)",
    up: "#4ADE80",
    down: "#F87171",
  },
};
