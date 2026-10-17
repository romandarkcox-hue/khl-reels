import { loadFont } from "@remotion/google-fonts/Manrope";
import React from "react";
import { Img, staticFile } from "remotion";

export const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["cyrillic", "latin"],
});

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

// Зона, которую не перекрывает интерфейс Instagram (подпись и кнопки).
export const SAFE_TOP = 200;
export const SAFE_BOTTOM = 1480;

export const C = {
  bg: "#070B16",
  bg2: "#0E1730",
  accent: "#5CC8FF",
  text: "#F4F7FF",
  muted: "#93A0BD",
  up: "#4ADE80",
  down: "#F87171",
};

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const formatDay = (isoDay: string): string => {
  const [, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
};

export const Logo: React.FC<{ src: string | null; size: number; shadow?: string }> = ({
  src,
  size,
  shadow = "0 10px 40px rgba(0,0,0,0.35)",
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: "#FFFFFF",
      boxShadow: shadow,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    {src ? (
      <Img src={staticFile(src)} style={{ width: size * 0.78, height: size * 0.78, objectFit: "contain" }} />
    ) : null}
  </div>
);
