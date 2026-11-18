import { tintableFinishTexture } from "../../../materials/tintable-finish-texture";

export const thermometerSweep = Math.PI * 1.3;

const glyphs: Record<string, readonly string[]> = {
  "−": ["000", "000", "111", "000", "000"],
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "011", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
};
const cell = 0.0011;
const labels = ["−10", "0", "10", "20", "30", "40"].map((text, index) => {
  const angle = (index / 5 - 0.5) * thermometerSweep;
  return {
    text,
    left: 0.038 * Math.sin(angle) - ((text.length * 4 - 1) * cell) / 2,
    top: 0.038 * Math.cos(angle) + 2.5 * cell,
  };
});

export const dialPrint = tintableFinishTexture(256, "thermometer-scale", (u, v) => {
  const x = (u - 0.5) * 0.124;
  const y = (v - 0.5) * 0.124;
  for (const { left, top, text } of labels) {
    const column = Math.floor((x - left) / cell);
    const row = Math.floor((top - y) / cell);
    if (
      column >= 0 &&
      column < text.length * 4 &&
      glyphs[text[Math.floor(column / 4)]][row]?.[column % 4] === "1"
    )
      return 0.43;
  }
  return 1;
});
// ShapeGeometry supplies planar UV coordinates in metres.
dialPrint.repeat.setScalar(1 / 0.124);
dialPrint.offset.setScalar(0.5);
