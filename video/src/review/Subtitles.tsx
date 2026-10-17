import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, SAFE_BOTTOM } from "./shared";

// Субтитры: текст сцены делится на предложения, каждое показывается
// пропорционально своей длине (так примерно совпадает с озвучкой).
export const Subtitles: React.FC<{ text: string; frames: number }> = ({ text, frames }) => {
  const frame = useCurrentFrame();
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const total = sentences.reduce((sum, s) => sum + s.length, 0);

  let start = 0;
  for (const s of sentences) {
    const length = (s.length / total) * frames;
    const end = start + length;
    if (frame >= start && frame < end) {
      const opacity = interpolate(frame, [start, start + 5, end - 4, end], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            bottom: 1920 - SAFE_BOTTOM,
            display: "flex",
            justifyContent: "center",
            opacity,
          }}
        >
          <div
            style={{
              padding: "18px 30px",
              borderRadius: 22,
              background: "rgba(4,7,16,0.78)",
              color: C.text,
              fontSize: 44,
              fontWeight: 700,
              lineHeight: 1.25,
              textAlign: "center",
            }}
          >
            {s}
          </div>
        </div>
      );
    }
    start = end;
  }
  return null;
};
