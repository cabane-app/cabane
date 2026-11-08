# Performance measurements

## 2026-11-08 — Larch Observatory interaction hitches

[Investigation plan](performance-plan.md). The production harness opens the
checked-in Larch Observatory with 13 rooms on two floors and 315 placed items.
The connected scenario operates three existing Cathedral hall fixtures through
the real dashboard and Home Assistant client, backed by an in-memory server
fixture. Benchmark commands and profiles are in the
[measurement guide](performance.md#repeatable-local-measurements).

### What made the frames miss

- During Walk, a finished LOD wave replaced eight batch buffers in one frame.
  A profiled 235 ms gap repacked 2.89 million vertices, with 1.90 million in
  the largest batch. Packing spent about 165–168 ms on the CPU and WebGL
  submission spent 46–54 ms. This occurred with the gun equipped and during
  ordinary walking. The representative original worst gap was 287 ms.
- A warm Floor lamp toggle submitted four replacement buffers containing
  1.21–1.63 million vertices. The HA fixture responded within a millisecond,
  while the light took about 127–140 ms to appear. No shader compilation was
  observed during the toggles. Four arched bookcases and six parts of the
  diamond rug recreated extrusion geometry on each state update. The live
  status marker also changed which meshes belonged to static batches.
- One rotating ceiling fan invalidated the entire sun shadow map on every
  daylight frame. Isolating just its blade shadows cut the median Orbit load
  from 341 draws and 244,000 submitted triangles to 270 and 145,000.
  The housing retains its shadow and stationary blades still cast, including
  when reduced motion is enabled. Same-camera Orbit and Walk comparisons
  showed the change concentrated near the fan.
- At night the sun contributed zero direct light but still drew the map.
  Suspending just its shadow refresh removed 71 draws and about 97,000
  triangles per measured night frame. The engine can reuse the shader and
  refresh the map as the sun illuminates the scene again. In a separate
  same-page A/B/A, skipping the dormant caster fingerprint reduced median
  CPU time for that stage from 1.2–1.3 ms to 0.1 ms.

The point-slot, wall-plane, contour, toon-gradient and DPR ablations used the
same house and camera path. In the single night runs the reference p95 varied
from 9.6 to 11.8 ms. The contour blit, point-range guard and flat toon-gradient
variants measured 9.9, 10.5 and 11.2 ms respectively. The native shadow
comparisons gave the clearest workload signal. The Larch daylight scene had
61 preallocated point slots with zero intensity. Retaining slots lets warm
toggles reuse compiled shaders.

At a desktop drawing buffer of 1,800 × 1,200, the zero-intensity slots were
the expensive part of the fragment pass. Two three-second day references
measured p95 30.5 and 30.0 ms with the same 358 draws. Skipping their lighting
calculations measured 9.8 ms with all 61 slots still allocated. Removing the
slots as a control measured 9.2 ms. Disabling target MSAA and reducing DPR to 1
measured 25.2 and 23.7 ms respectively. These controls kept the camera path and
scene fixed. The shader guard keeps the point-light layout stable as fixtures
switch on and off.
In the production build, two matched five-second desktop captures moved from
29.8 to 9.6 ms p95 on direct Orbit and from 29.1 to 9.7 ms on room transitions.
The final worst intervals were 13.7 and 18.5 ms respectively.

### Comparisons

Chromium uses ANGLE Metal on an Apple M5 Pro. The emulated mobile Orbit
viewport is 390 × 844, device DPR 3 and effective DPR 1.25. Warm, unthrottled
day Orbit initially measured 10.8 ms p95 for direct camera motion and 11.3 ms
for the real touch replay, with no interval above 33.3 ms.
The final three-repeat mobile touch series measured 9.3 ms p95 by day and
9.6 ms with 61 active lamps at night. The worst intervals were 12.4 and
10.8 ms respectively. Room transitions measured 9.8 ms p95 and 21.3 ms
maximum. None of these captures replaced a static batch buffer.

| Larch interaction                                             | Before                  | Combined build        |
| ------------------------------------------------------------- | ----------------------- | --------------------- |
| Plain Walk, median p95 / median p99 / worst gap               | 12.7 / 15.4 / 225.1 ms  | 10.2 / 13.7 / 22.4 ms |
| Plain Walk, CPU ×2, p95 / worst gap                           | 26.6 / 45.9 ms          | 22.4 / 44.2 ms        |
| Six Floor lamp toggles during Orbit, frame p95 / p99 / max    | 23.5 / 125.2 / 174.5 ms | 11.6 / 27.3 / 33.9 ms |
| Floor lamp tap to first frame with new emitter intensity      | 126.6–139.7 ms          | 26.9–33.3 ms          |
| Six Hearth dimmer updates during Orbit, frame p95 / p99 / max | —                       | 9.8 / 12.4 / 28.0 ms  |
| Walk and fire together, median p95 / median p99 / worst gap   | 14.7 / 23.1 / 259.6 ms  | 13.9 / 22.1 / 48.2 ms |
| Walk through linked portals, frame p95 / p99 / max            | 38.7 / 41.9 / 62.2 ms   | 27.3 / 28.7 / 30.3 ms |
| Chromium touch Orbit, CPU ×4, median p95 across three runs    | 49.2 ms                 | 42.7 ms               |
| Playwright WebKit direct Orbit, median p95 across three runs  | 20 ms                   | 21 ms                 |

The dimmer replay verifies each Home Assistant brightness state and the
corresponding emitter intensity. Its action trace includes the dashboard's
command coalescing delay separately from the first rendered response.
The first 32k vertex limit removed the large Walk hitches but raised
steady CPU ×4 touch Orbit to 54.2 ms p95 and 482 median draws. With the 64k limit
and daylight shadow reuse that intermediate candidate submitted 306 draws and
143,000 triangles per frame, compared with 341 and 242,000 on the original.
The final CPU ×4 series still exceeds the working 60 Hz target, with 76.5%
of intervals above 33.3 ms versus 100% on the original. WebKit used an
effective DPR of 2 and averaged 60 FPS in both builds. All six WebKit captures
stayed below 33.3 ms and median submitted triangles dropped from 290,000
to 167,000.
An additional three-second WebKit check with the final point-light guard
measured 60 FPS, a p95 of 19 ms and a worst interval of 23 ms.

The three plain Walk replays used the normal touch joysticks at 844 × 390
with effective DPR 1.25. Median draws dropped from 246 to 206 and median
triangles from 1.48 million to 500,000. The candidate had zero gaps above
33.3 ms. The original CPU ×2 Walk capture lowered its DPR to 1 and then 0.85.
Three final runs held DPR at 1.25 and had 0.93–0.98% of intervals above
33.3 ms, with a median p95 of 22.4 ms. This stress check differs in DPR and
run count from the original.

At CPU ×2, the warmed Orbit candidate measured 20.7 ms p95 with touch and
20.6 ms with direct motion. Reusing serialized material grouping keys measured
20.0 and 18.7 ms respectively. The same touch replay with scene hover picking
suppressed measured 19.9 ms. All paths moved the camera with zero gaps above
33.3 ms, so the next changes stayed in the renderer.
The final daylight signature reads only positions and indices for a single
toon material without alpha clipping or displacement. In an A/B/A at CPU ×2
with 1,727 casters, the signature took 2.2–2.3 ms per frame in the original
path and 1.9 ms in the candidate, using medians. The whole-frame p95 stayed
near 20 ms in all three captures.

Walk and zap used three matched four-second captures per build at 844 × 390,
device DPR 3 and effective DPR 1.25. Every candidate shot was sent with
trusted touch input while both joysticks were active and produced visible
feedback. Six tasks of at least 50 ms in the original dropped to zero.
Occasional 42–48 ms intervals remained around third-finger input, with no
batch replacements in those intervals. The candidate stayed below 1% over
33.3 ms in each capture. Its peak pack was 65,512 vertices in one frame,
compared with 3.21 million in the original.

The linked portal comparison used one matched traversal per build with both
destination views rendering in every measured frame. Cropping each camera to
its aperture reduced the two passes' median draws from 2,917 to 1,515 and
triangles from 1.24 million to 687,000. The camera view preserves perspective
and the traversal reaches the paired exit.

Raw JSON, profiles and same-camera visual comparisons remain under ignored
`test-results/performance/`. These mobile captures use the Mac's GPU.
Safari iOS stayed on its first-launch screen while the Mac was locked.
Timing on a physical phone remains unverified.

## 2026-11-04: issue 106, apartment room transitions and native bundle

[Issue 106](https://github.com/cabane-app/cabane/issues/106) includes stationary
LOD switching, room-switching stalls and an AI analysis of an older panel build.
All five attached images and the linked analysis were reviewed. The screenshots
show FPS overlays, not the underlying trace; its timing attribution and 29-second
startup remain unverified.

The reported v0.3.25 panel uses `5c40fd1`. Released
[v0.3.26](https://github.com/cabane-app/cabane-home-assistant/blob/v0.3.26/custom_components/cabane/frontend/manifest.json)
uses `e5d6066`, including the earlier incremental-LOD and stable-constructor fixes.
A differential Node reproduction fails with the old LOD implementation: preparing
one unrelated mesh restores settled furniture to full detail. Current code keeps
its selected geometry and buffer family across repeated worker waves. The existing
LOD regression now composes the actual LOD and batcher wrappers to protect this.

The new synthetic `apartment` scenario has 12 small rooms and 96 catalog furniture
items. Current idle/orbit captures did not reproduce sustained stutters. The new
`rooms-v1` button replay did reveal hundreds of batch-buffer replacements: room
emphasis animates merged wall vertex colors, invalidating their static batch on
each frame. Wall colors now use dynamic attributes and keep their ordinary draw;
static furniture stays batched. The real wall-emphasis/batcher regression failed
with 23 wall buffers before the fix and passes while checking the submitted colors
still animate.

Captures below use `e5d6066` plus the new harness; candidates add the dynamic-wall
fix. Host: Apple M5 Pro CPU/ANGLE Metal GPU, Darwin 25.6.0, Chromium 151.0.7922.34,
headless and native GPU. Each run warms up for 3 seconds and captures 10 seconds.
Desktop is 1440×960 with an 1800×1200 drawing buffer. The mobile viewport is
390×844, device DPR 3, effective drawing buffer 487×1055 at DPR 1.25, CPU ×4.
No physical phone was measured.

| Room-button replay                          | Before      | Candidate |
| ------------------------------------------- | ----------- | --------- |
| Desktop, new batch buffers per run (3 runs) | 495/493/493 | 0/0/0     |
| Desktop, median frame p95                   | 9.0 ms      | 8.5 ms    |
| Desktop, median callback FPS                | 120         | 120       |
| Desktop, median/max draw calls              | 43/54       | 46/62     |
| Mobile CPU ×4, new batch buffers (1 run)    | 399         | 0         |
| Mobile CPU ×4, frame p95                    | 12.3 ms     | 10.7 ms   |
| Mobile CPU ×4, average callback FPS         | 108.0       | 114.7     |
| Mobile CPU ×4, CPU render submission p95    | 2.5 ms      | 2.1 ms    |
| Mobile CPU ×4, median/max draw calls        | 24/33       | 27/42     |

No room-replay interval exceeded 33.3 ms in either version. Eliminated buffer
replacement is the strong result. The desktop is already at its 120 Hz cadence;
its small p95 difference is not evidence of a stable speedup. The single throttled
pair is directional timing evidence. Direct wall draws increase calls but preserve
the highlight and avoid geometry repacking. The scenario has no live HA or rainy
weather, so it does not establish acceptance of the reporter's original apartment.

The native panel had a separate build problem: Vite ES-library mode preserved
formatted output and embedded large PNGs into JavaScript. Building the custom
element as an app retains its public entry/CSS names and emits images separately.
Same-source artifact comparison, including the entry script and worker:

| Native panel artifact                       | Before           | Candidate        |
| ------------------------------------------- | ---------------- | ---------------- |
| All JavaScript                              | 16,001,838 bytes | 4,167,727 bytes  |
| Main shared chunk                           | 5,797,534 bytes  | 2,518,557 bytes  |
| All JavaScript, individually gzipped        | 8,491,155 bytes  | 1,171,959 bytes  |
| Complete file inventory, before compression | 17,784,076 bytes | 13,535,381 bytes |

This is a 74% JavaScript-byte reduction, not a measured startup-latency claim.
The panel verifier rejects large embedded image data URLs and runs the existing
nested-path native-host smoke. The old bundle fails the new artifact check; the
application build passes. No release or deployment was performed for these changes.

Raw captures, HTML comparisons, native artifact inventories and screenshots stay
under ignored `test-results/`. Compact room-replay reports are retained in
`docs/performance-baselines/2026-11-04-issue106-*`.

## Resume here

The harness and first rendering fixes are ready to ship; mobile smoothness is
still unfinished. The target device is **iPhone 16e**, with no physical-device
capture yet. Latest Safari Simulator camera replay: **57.2 FPS, p95 27 ms,
p99 33 ms**. Latest Chromium CPU ×4 touch replay: **32.3 FPS, p95 40.9 ms**.
Our target remains **p95 ≤20 ms, p99 ≤33.3 ms, <1% above 33.3 ms**.

- Start with [the harness guide](performance.md) and the latest
  [Safari replay](performance-baselines/2026-11-03-current-ios-simulator-quiet.json)
  or [CPU stress baseline](performance-baselines/2026-11-03-deferred-preview-cpu4.json).
  Keep these separate series. Compact baselines are committed; raw arrays,
  charts, CPU traces, temporary HA sessions and private mappings are ignored.
- Keep the connected repo home, night, cloudy HA weather and ten lights on.
  Validate/refresh the local test session as described in the guide. Benchmark
  commands do not set up or change HA state.
- First compare the current renderer with a reference under the same host load.
  The extra culling change needs a contemporaneous comparison: the latest p95
  is worse than the earlier 19 ms checkpoint despite similar render submission
  timing. Do not claim a stable speedup from the best intermediate capture.
- Then profile steady CPU work in batching/material checks and scene traversal.
  Preserve the verified fixes for geometry replacement and thumbnail stalls.
  Validate continuous gestures on the iPhone 16e before declaring mobile success.
- Upstream changes were integrated for delivery after these captures. They add
  catalog/color behavior, including sofa color controls. The measurements retain
  their original source revisions; capture a fresh reference before the next
  optimization, and never bypass a scene/configuration mismatch.

Keep one row per useful experiment. Save raw JSON and charts in ignored
`test-results/performance/`; retain a small, synthetic baseline JSON alongside
this log when a comparison needs to survive checkout cleanup. Do not commit
household scenes, identifiers, credentials or screenshots.

Read [the measurement guide](performance.md) before comparing results. Lower p95
and fewer frames over 33.3 ms are the primary signals. A laptop mobile profile is
a regression proxy; a real phone validates mobile improvements.

## Original baseline and target

Use **Solstice + live dev HA + night + cloudy + 10 lights on** for subsequent
iterations. The old disconnected demo runs below are historical references.

| Metric                           | Original iOS Simulator baseline | Working 60 Hz target                |
| -------------------------------- | ------------------------------- | ----------------------------------- |
| **Frame interval p95 (primary)** | **26 ms**                       | **≤20 ms**, ideally near 16.7 ms    |
| Average callback FPS             | 44.6                            | Approximately 60                    |
| Frame interval p99               | 29 ms                           | ≤33.3 ms                            |
| Intervals above 33.3 ms          | 0.22%                           | <1%                                 |
| CPU render submission p95        | 5 ms                            | Diagnostic; not GPU time            |
| Draw calls / triangles (median)  | 299 / 418,022                   | Diagnostic; preserve visual quality |

The new [compact baseline](performance-baselines/2026-11-03-solstice-ha-night-cloudy-ios-simulator.json)
uses clean source `db5a7ea`, the current 239-item
`home/showcase/furnished.project.json`, 27 available mapped synthetic lights with
exactly 10 on, and 10 active rendered point lights. It uses the real standalone
HA runtime and private mappings; cloudy weather comes from HA, not a preview.
The selected weather source was also saved in the dev HA workspace.

Environment: iPhone 17 Pro simulator, iOS 26.1 (23B86), Safari, Apple M5 Pro host,
402 × 714 viewport, device DPR 3, effective canvas 502 × 892 at DPR 1.25. Three
ten-second captures followed three seconds of warmup each. Per-run FPS was
44.6 / 42.5 / 44.7, with p95 26 / 26 / 26 ms and p99 29 / 36 / 28 ms. The second
run had a transient peak of 2,144,085 submitted triangles and several >50 ms
intervals; the aggregate median-of-run maxima hides that outlier, so retain the
per-run evidence. Host background work, power and thermal state were not
controlled. No tests, builds, profiler or video recording ran during capture.

Raw samples and the chart are in ignored
`test-results/performance/2026-11-03-solstice-ha-night-cloudy-ios-simulator.{json,html}`.
The scenario differs from the earlier demo, so the difference is not a measured
code regression or an optimization result. It establishes a rendering shortfall
under the requested workload. The direct camera replay still bypasses actual
touch/gesture/picking work; reproduce that path after compaction before claiming
the reported mobile drag jank is understood.

The local dev HA was restored from this checkout because its previous mounts
referenced an unavailable worktree and all 27 mapped Solstice lights were
unavailable. Its account, volume and saved workspaces were retained. Fixture
installation now runs before startup. The 10-on/17-off states and cloudy weather
were applied once; a restart resets the demo weather, and preflight then refuses
to silently benchmark a different scene. Night is a benchmark browser preference.

The private, temporary HA session and preparation scripts remain only under
ignored `test-results/performance/`. Refresh the session if it expires. The
loopback harness is left running at
`http://127.0.0.1:4180/tests/performance-harness.html` for the next phase.

## First local rendering improvements

The [committed rendering comparison](performance-baselines/2026-11-03-incremental-lod-ios-simulator.json)
uses source `843663b`, the same iPhone simulator, configuration and live HA workload
as the original `db5a7ea` baseline. Three ten-second captures, without profiling:

| Metric                    | Before        | After         |
| ------------------------- | ------------- | ------------- |
| Callback FPS              | 44.6          | 59.6          |
| Frame interval p95        | 26 ms         | 19 ms         |
| Frame interval p99        | 29 ms         | 21 ms         |
| Intervals above 33.3 ms   | 0.22%         | 0.17%         |
| CPU render submission p95 | 5 ms          | 3 ms          |
| Calls / triangles, median | 299 / 418,022 | 268 / 212,915 |

The changes remove redundant grouping work, recognize the engine's fragment-only
lighting hook when reusing shadows, and preserve existing LOD families while new
meshes prepare. A regression test reproduced the whole-scene full-detail fallback
and family replacement before the fix. No multi-million-triangle bursts occurred
in the three new Safari captures. There was one isolated 71 ms interval in run 2;
the other run maxima were 40 and 24 ms. The aggregate passes the working targets,
but this does not establish zero hitches or physical-phone acceptance.

Native, continuous panning establishes a separate
[interaction baseline](performance-baselines/2026-11-03-native-pan-before.json),
source `692360d`: **57.3 FPS, p95 25 ms, p99 31 ms, 0.52% above 33.3 ms**.
The camera moved in all 574 measured frames; the longest interval was 38 ms.
Device Hub sent 60 repeated horizontal drags through the normal iOS touch path.
This exposes a remaining interaction shortfall even though the direct camera
path meets its target, but the control experiment below shows that this gap
cannot be attributed entirely to Cabane. The earlier 23%-movement capture is retained only in
ignored files and is not acceptance evidence. Raw reports/charts are in
`test-results/performance/2026-11-03-{incremental-lod-ios-simulator,native-pan-before}.{json,html}`.

The touch-hover experiment `a94bb46` recorded p95 26 ms versus 25 ms before,
with 100% movement coverage in both cases. It did not improve the timing and was
reverted. Its raw report is `test-results/performance/2026-11-03-native-pan-hover.json`.

Precomputing source picking bounds (`1294182`) avoids triangle visits for a
missed ray in the focused test, but did not demonstrate a frame-time win in this
native replay (p95 28 ms). It was also reverted. Keep the first measured renderer
improvements rather than retaining speculative changes.

### Native-input control

An [empty WebGL control](performance-baselines/2026-11-03-native-input-calibration.json)
used the same viewport, drawing buffer and drag commands, with only `gl.clear`
per animation frame. It measured **60 FPS / p95 17 ms idle**, and **60 FPS / p95
24 ms with automated dragging**. No drag interval exceeded 33.3 ms; max was 27 ms.
This is evidence of input/simulator scheduling noise and weakens the earlier
interpretation of the 25 ms app gesture result. It does not prove the user's
physical-phone stutter is fixed. The phone target remains p95 ≤20 ms.
The control source and raw JSON stay in ignored
`test-results/performance/diagnostics/input-control.html` and
`test-results/performance/native-input-control{,-idle}.json`.

## Camera gesture investigation, November 3

This checkpoint used the
[CPU ×4 report](performance-baselines/2026-11-03-solstice-touch-cpu4-after.json),
source `8114629`. The controlled comparison keeps the same current harness,
browser, workload and idle WebGL Simulator control in the background:

| Metric                    | Old renderer | Current renderer |
| ------------------------- | ------------ | ---------------- |
| Callback FPS              | 20.8         | 28.9             |
| Frame interval p95        | 55.1 ms      | 41.6 ms          |
| Frame interval p99        | 63.8 ms      | 54.9 ms          |
| Intervals above 33.3 ms   | 100%         | 52.8%            |
| CPU render submission p95 | 17.7 ms      | 13 ms            |

The [controlled old-renderer report](performance-baselines/2026-11-03-controlled-touch-before.json)
used the four renderer files from `ddc00e9` with the current harness. Its metadata
retains the mixed-source context and file hashes; those files were restored
after capture, and the working tree matches the committed current renderer.
The original baseline below had a heavier Simulator home running in the
background, so prefer this controlled comparison when judging the code change.
Host power, thermal state and other background applications remain uncontrolled.

This is a real improvement but **the stress case still fails** p95 ≤20 ms,
p99 ≤33.3 ms and <1% above 33.3 ms. The no-stutter goal remains open. Run maxima
were 58, 55.3 and 334 ms; the last outlier was unexplained at this checkpoint.
The investigation below identifies two sources of long camera-frame stalls.
Camera movement covered 100% of measured frames.
Remaining steady-frame CPU work is in batching/material eligibility and repeated scene
traversal; physical-phone validation is still needed for the reported gesture
problem. The harness now records trusted touch replays, manual gestures and
movement coverage. Forty-two focused regression tests, type checking, targeted
lint, formatting, import boundaries and unused-code checks passed.

```sh
npm run perf -- --path touch-orbit-v1 --cpu-rate 4 --label candidate --baseline docs/performance-baselines/2026-11-03-solstice-touch-cpu4-after.json --check
```

Raw JSON and the visual comparison are
`test-results/performance/2026-11-03-solstice-touch-cpu4-after.{json,html}`.

The input-inclusive `touch-orbit-v1` baseline uses trusted Chromium touch events:
one-finger pan, then two-finger rotation/pinch, repeating every four seconds.
It retains the same connected Solstice/night/cloudy/ten-light workload. The camera
and controls target are restored between runs. Source `ddc00e9` is the committed
harness before any rendering changes.

The [CPU ×4 touch baseline](performance-baselines/2026-11-03-solstice-touch-cpu4.json)
records **15.2 FPS, p95 85.2 ms, p99 102.6 ms, 100% above 33.3 ms** across three
ten-second captures. It is a laptop stress proxy, separate from the Safari series.
The opt-in `--check` fails reproducibly against the working smoothness target.
Short direct-camera and touch-only-pan probes both reached about 15.5 FPS under
CPU ×4, suggesting the shared frame work dominates rather than touch handling.

A diagnostic CPU profile attributed about 27% of sampled time to mesh batching
eligibility/key construction. The first changes separate LOD eligibility from
serialized material grouping, skip LOD checks for small/planar geometry, and reuse
membership checks within the same batch render while retaining fade, reflection
and shear fallbacks. Timed comparisons will determine the result; profiled runs
are diagnostic only. The scene contains 2,878 objects and 1,938 meshes/materials.

```sh
npm run perf -- --path touch-orbit-v1 --cpu-rate 4 --label candidate --baseline docs/performance-baselines/2026-11-03-solstice-touch-cpu4.json --check
```

## Geometry replacement and workspace thumbnail hitches, November 3

The reported physical device is **iPhone 16e**. No physical-phone report has been
captured yet; the Safari Simulator and Chromium stress runs remain proxies.

Temporary local tracing reproduced 300 ms camera-frame pauses. An 858-mesh batch
was repacked for about 250 ms after 19 sofa, chair and planter geometries changed
identity during ordinary React rerenders. Their constructor inputs were recreated
even when dimensions were unchanged. `33b3ebb` stabilizes those inputs in three
catalog components. The regression test failed on the five affected model types
before the fix and passes after it, including appearance changes and real resizing.
Follow-up tracing no longer saw these recurring 19-geometry replacements.

`92926bc` tested rejecting batched sources through camera layers before Three's
frustum and geometry work. Removing the existing material masking also prepared
unused lighting materials, so `5d82e4b` retains both masks. Children and animated
fallbacks keep their ordinary draws, and source state is restored after errors.
Its [first capture](performance-baselines/2026-11-03-early-rejection-masked-cpu4.json)
recorded 38.5 FPS / p95 31.2 ms / 3.8% above 33.3 ms, versus 32.6 FPS / p95
40.9 ms before this change. Later host variation means this steady-frame gain
needs a repeated comparison before treating its size as stable.

A separate approximately 140 ms pause came from the workspace thumbnail timer.
The CPU profile attributed about 108 ms to synchronous pixel readback, conversion
and image encoding inside a render callback. `633e840` waits until the camera has
been still for 500 ms before servicing initial or periodic preview requests.
It wakes a resting demand canvas once and cancels requests on unmount. The focused
regression failed before the fix and passes for pan, zoom, rotation and damping.
Preview refresh is deferred during movement; image quality and scene quality are
unchanged. Initial LOD preparation and packing remain separate startup costs.

Use the [latest CPU ×4 capture](performance-baselines/2026-11-03-deferred-preview-cpu4.json)
for the next iteration, source `633e840`, with the same live HA workload and
100% camera movement in all three ten-second captures:

| Metric                           | Before these fixes, `7e5e462` | Latest, `633e840` | Working target    |
| -------------------------------- | ----------------------------- | ----------------- | ----------------- |
| Callback FPS                     | 33.2                          | 32.3              | Approximately 60  |
| Frame p95                        | 38.1 ms                       | 40.9 ms           | ≤20 ms            |
| Frame p99                        | 46.6 ms                       | 51.3 ms           | ≤33.3 ms          |
| Above 33.3 ms                    | 12.1%                         | 27.9%             | <1%               |
| Worst interval per run           | 59 / 51 / 141 ms              | 73 / 62 / 95 ms   | Inspect every run |
| Intervals above 100 ms, all runs | 1                             | 0                 | Zero observed     |

The [fresh before capture](performance-baselines/2026-11-03-stable-shapes-before.json)
and latest capture use clean source, identical configuration and the idle WebGL
Simulator control in the background. No tests, build or profiler ran during
capture. Other host applications and thermal state were not controlled. AC power
was observed afterward; thermal status was unavailable. GPU submission timing
also varied across captures. **This does not establish a steady-frame speedup or
meet the stress target**, despite removing the two verified hitch triggers. The
latest per-run p95 values are 42.6 / 40.9 / 38.8 ms; a 95 ms interval still needs
attention. Keep individual maxima and long-hitch counts alongside percentiles.

The [latest native Safari pan](performance-baselines/2026-11-03-native-pan-current.json)
records **59.8 FPS / p95 24 ms / p99 30 ms**, with 100% movement over 598 frames,
max 37 ms and no >50 ms interval. The same 60 drag pairs previously measured
57.3 FPS / p95 25 ms. This small difference is not a robust speed claim; the empty
native-input control itself had p95 24 ms. It remains a Simulator result, not
acceptance on the iPhone 16e.

The final three-repeat `orbit-v1` Safari replay recorded 58.0 FPS / p95 26 ms /
p99 32 ms, with run maxima 43 / 34 / 43 ms. A
[quiet repeat](performance-baselines/2026-11-03-current-ios-simulator-quiet.json),
with no agent work during capture, recorded 57.2 FPS / p95 27 ms / p99 33 ms,
run maxima 40 / 38 / 38 ms. Both retain the same 268 median calls / 212,915 median
triangles and 3 ms CPU submission p95 as the earlier `843663b` replay. Neither
new capture had a >50 ms interval, but **both miss p95 ≤20 ms**. Do not substitute
the earlier 19 ms result for the current measurement. Isolate host variation
from possible steady-frame regressions with a contemporaneous reference capture
before claiming the added culling change is a stable improvement.

Forty-eight focused tests across catalog rerenders, batching, LOD, shadows,
preview scheduling and the measurement harness passed. Type checking, targeted
lint, formatting and import boundaries passed. All instrumentation and large
traces stay in ignored `test-results/performance/diagnostics/`; the temporary
instrumentation was removed from product and harness source.

```sh
npm run perf -- --path touch-orbit-v1 --cpu-rate 4 --label candidate --baseline docs/performance-baselines/2026-11-03-deferred-preview-cpu4.json --check
```

The matching raw JSON and HTML charts use the compact reports' `rawReport` paths.
The no-stutter goal remains open: reduce steady CPU work, repeat captures under
comparable host load, and validate continuous camera gestures on the iPhone 16e.

## Earlier measurements

| Date       | Experiment / source                                                                         | Environment                                 | Callback FPS | Frame p95 | >33.3 ms | Calls / triangles (median) | Interpretation                                                                         |
| ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------ | --------- | -------- | -------------------------- | -------------------------------------------------------------------------------------- |
| 2026-11-02 | [Initial mobile profile](performance-baselines/2026-11-02-mobile.json), `6e260f2`           | Apple M5 Pro, Chrome 151, CPU ×1            | 120.0        | 8.7 ms    | 0%       | 288 / 168,681              | Laptop is comfortably fluid. No phone acceptance yet.                                  |
| 2026-11-02 | [CPU sensitivity](performance-baselines/2026-11-02-mobile-cpu4.json), `6e260f2`             | Same host/browser, CPU ×4                   | 37.8         | 30.6 ms   | 1.1%     | 286 / 168,681              | Harness exposes reduced CPU headroom. Separate comparison series, no code improvement. |
| 2026-11-03 | [iOS Simulator](performance-baselines/2026-11-03-ios-simulator-iphone17pro.json), `d884338` | iPhone 17 Pro, iOS 26.1 Safari, M5 Pro host | 60.0         | 18.0 ms   | 0%       | 286 / 168,894              | Useful Safari regression baseline. Simulator speed uses the Mac's hardware.            |

Both measurements used a clean checkout, a production build, three ten-second
captures, and three seconds of warmup before each capture. Chrome was headless,
using ANGLE Metal on Apple M5 Pro with `WEBGL_multi_draw`. The emulated viewport
was 390 × 844, device DPR 3, touch/coarse pointer enabled; the app's actual canvas
was 487 × 1055 at DPR 1.25. Lighting time and timezone were fixed. AC power was
observed after the measurements; thermal state was not captured.

Per-run frame p95 ranged from **8.6–8.9 ms** unthrottled and **30.1–31.8 ms** at
CPU ×4. Median-of-run triangle maxima were 176,570 in both series. These counts
exceed the existing workload guardrails despite the laptop's smooth cadence.
Use them to guide diagnosis, not to infer a phone frame rate. Small count
differences between these runs reflect sampling and transient passes, not an
optimization.

The **iOS Simulator** measurement is a separate series: Safari on an iPhone 17 Pro
simulator, iOS 26.1 (23B86), running on the same Apple M5 Pro / Darwin 25.6.0 host.
The production benchmark ran without CPU throttling for three ten-second
captures, each with three seconds of warmup. Per-run p95 was 18, 17 and 18 ms;
p99 was about 19 ms overall. No sampled interval exceeded 33.3 ms. Safari reported
`Apple GPU` and `WEBGL_multi_draw`, with a 402 × 714 viewport, device DPR 3 and
an actual 502 × 892 canvas at DPR 1.25. Safari remained visible in Device Hub;
there was no video recording or profiler capture during measurement.

This result establishes approximately 60 Hz callback pacing in this simulator.
Do not treat the difference from desktop Chromium's 120 Hz baseline as a speed
regression: the browser, viewport and execution environment differ. Simulator
timings support iteration on this host, not an estimate of a physical iPhone's
GPU, battery or thermal behavior. Power and thermal state were not recorded for
this run. The raw JSON and HTML are
`test-results/performance/2026-11-03-ios-simulator-iphone17pro.{json,html}`.

The linked compact JSON files retain configuration, source, device context and
per-run summaries. They work as `--baseline` or as the first input to
`perf:compare`. Raw arrays and HTML charts remain in ignored files:

- `test-results/performance/2026-11-02-mobile.{json,html}`
- `test-results/performance/2026-11-02-mobile-cpu4.{json,html}`

Use a raw report as the second input when generating a chart:

```sh
npm run perf -- --label candidate --baseline docs/performance-baselines/2026-11-02-mobile.json
npm run perf:compare -- docs/performance-baselines/2026-11-02-mobile.json test-results/performance/candidate.json
```

For future entries, include the report filename, source commit, profile, browser
and GPU, device power/thermal state, what changed, visual tradeoffs, and whether
the same phone confirmed the improvement. Keep CPU-throttled results in a
separate comparison series. Do not claim a win from a difference smaller than
the variation between repeated runs.
