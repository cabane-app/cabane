// Authored, slanted block lettering: real vector letterforms, with no font or texture fetch.

import { PORTAL_COLORS } from "../portals/portal-contract";

const EXCLAMATION = " M222 35H237L229 69H219Z M218 76H231L228 88H215Z";
const WORDS = [
  {
    label: "PEW!",
    letters:
      "M48 88V35H73Q93 35 93 53Q93 71 72 71H64V88ZM64 48V58H72Q78 58 78 53Q78 48 72 48Z M99 35H137V48H115V55H134V67H115V75H138V88H99Z M143 35H159L162 64L171 42H184L187 64L197 35H213L192 88H177L174 64L164 88H149Z",
    highlights: "M51 40V62M103 40H129M148 40L151 55M225 40H230",
  },
  {
    label: "ZAP!",
    letters:
      "M48 35H94V47L68 74H94V88H47V75L73 49H48Z M99 88L116 35H135L152 88H136L133 78H116L113 88ZM120 65H129L124 48Z M159 88V35H184Q207 35 207 53Q207 72 183 72H175V88ZM175 48V59H183Q191 59 191 53Q191 48 183 48Z",
    highlights: "M53 40H84M118 41L111 63M163 40V61M225 40H230",
  },
  {
    label: "POW!",
    letters:
      "M48 88V35H73Q93 35 93 53Q93 71 72 71H64V88ZM64 48V58H72Q78 58 78 53Q78 48 72 48Z M119 34Q141 34 141 61Q141 89 119 89Q97 89 97 61Q97 34 119 34ZM119 48Q112 48 112 61Q112 75 119 75Q126 75 126 61Q126 48 119 48Z M143 35H159L162 64L171 42H184L187 64L197 35H213L192 88H177L174 64L164 88H149Z",
    highlights: "M51 40V62M107 48Q110 40 120 40M148 40L151 55M225 40H230",
  },
];

const PALETTES = [
  { paper: "#ffe15a", shade: "#f39436", ink: "#fff9dd" },
  { paper: "#6cecf3", shade: "#279fc7", ink: "#fffceb" },
  { paper: "#ff967c", shade: "#d64d72", ink: "#fff4cf" },
  { paper: "#ccadff", shade: "#8b65d3", ink: "#fff5a8" },
];

/** Golden-ratio offsets vary the motion; portal shots inherit the fired portal's color. */
export function pewArt(shotId: number, shotColor?: string) {
  const word = WORDS[Math.max(0, shotId - 1) % WORDS.length];
  const palette = shotColor
    ? {
        paper: shotColor,
        shade: shotColor === PORTAL_COLORS.gold ? "#bd7322" : "#279fc7",
        ink: "#fffceb",
      }
    : PALETTES[shotId % PALETTES.length];
  const seed = (shotId * 0.61803398875) % 1;
  const tips = 10 + (shotId % 3);
  const points = Array.from({ length: tips * 2 }, (_, i) => {
    const angle = (i * Math.PI) / tips;
    const radius =
      i % 2 ? 0.69 + 0.08 * Math.sin(i + shotId) : 0.94 + 0.06 * Math.cos(i * 3 + shotId);
    return `${(140 + Math.cos(angle) * 128 * radius).toFixed(1)},${(64 + Math.sin(angle) * 58 * radius).toFixed(1)}`;
  }).join(" ");
  return {
    ...palette,
    ...word,
    letters: word.letters + EXCLAMATION,
    points,
    angle: -13 + seed * 21,
    drift: -18 + seed * 36,
    lift: -20 - seed * 14,
    scale: 0.94 + seed * 0.12,
  };
}
