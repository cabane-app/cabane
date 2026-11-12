/** Match an in-place clip's planted-foot speed to actual ground travel. */
export function walkPlaybackRate(
  speed: number,
  cycleSeconds: number,
  strideLength: number,
  scale = 1,
) {
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  const distance = strideLength * scale;
  // Legacy/runtime host profiles may lack calibration. Keep their authored gait
  // running rather than silently freezing all feet while translating the actor.
  if (![cycleSeconds, distance].every(Number.isFinite) || distance <= 0 || cycleSeconds <= 0)
    return 1;
  return (Math.max(0, speed) * cycleSeconds) / distance;
}
