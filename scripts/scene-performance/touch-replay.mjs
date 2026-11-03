import { setTimeout } from "node:timers/promises";

// Trusted browser input through CDP: normal touch/pointer listeners, hit testing,
// pointer capture, R3F picking and OrbitControls all run. No camera writes.
export async function replayTouchOrbit(cdp, viewport, seconds) {
  // Alternate one-finger pan and two-finger rotation/pinch every four seconds.
  const points = (elapsed, pair) => {
    const x = viewport.width * (0.5 + (pair ? 0.12 : 0.22) * Math.sin(elapsed * Math.PI));
    const y = viewport.height * (0.65 + 0.035 * Math.sin(elapsed * Math.PI * 2));
    const radius = 40 * (1 + 0.2 * Math.sin(elapsed * Math.PI));
    return pair
      ? [
          { x: x - radius, y, id: 0 },
          { x: x + radius, y, id: 1 },
        ]
      : [{ x, y, id: 0 }];
  };
  const start = performance.now();
  let pair = false;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(0, pair) });
  try {
    let next = start;
    while (performance.now() - start < seconds * 1000) {
      next += 1000 / 60;
      await setTimeout(Math.max(0, next - performance.now()));
      const elapsed = (performance.now() - start) / 1000;
      const nextPair = Math.floor(elapsed / 4) % 2 === 1;
      if (nextPair !== pair) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        pair = nextPair;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: points(elapsed, pair),
        });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(elapsed, pair),
      });
      // Skip missed slots rather than burst events after a blocked main thread.
      next = Math.max(next, performance.now() - 1000 / 60);
    }
  } finally {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
}
