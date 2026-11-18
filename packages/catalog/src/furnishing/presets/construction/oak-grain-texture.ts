import { tintableFinishTexture } from "../../../materials/tintable-finish-texture";

const tau = 2 * Math.PI;

/** Long, low-contrast grain runs parallel to V. */
export const oakGrainTexture = tintableFinishTexture(128, "catalog-oak-grain", (u, v) => {
  const grain = u + Math.sin(tau * v) * 0.018 + Math.sin(tau * (u + 2 * v)) * 0.008;
  const figure = (1 + Math.sin(tau * grain * 5)) / 2;
  const growth = ((1 + Math.cos(tau * (grain * 13 + 0.3 * Math.sin(tau * grain * 3)))) / 2) ** 4;
  const pores = ((1 + Math.cos(tau * grain * 29)) / 2) ** 3;
  const poreBreaks = (1 + Math.cos(tau * (12 * v + 17 * u))) / 2;
  return 0.99 - 0.04 * figure - 0.07 * growth - 0.024 * pores * poreBreaks;
});
