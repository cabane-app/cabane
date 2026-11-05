# Performance measurements

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

## 2026-11-04 · Solstice Atelier public demo readiness

The fresh-browser demo changes from the previous 165-item villa to the 363-item,
three-floor Atelier showcase. Its in-browser adapter maps the added devices and
provides local synthetic camera video. No furnishings or visual details were
removed for these measurements.

The production app was measured on the same Apple M5 Pro / Darwin host, Chromium
with ANGLE Metal and multi-draw, a 390 × 844 touch viewport, device DPR 3 and actual
canvas DPR 1.25. Each report contains three ten-second touch replays after
three-second warmups. Both homes start in their default ground-floor overview,
daylight, with no active point lights. Different home hashes and camera framing
are intentional: this compares the new demo's cost, not a renderer optimization.
The source commit is `5f3fdc3` plus the demo implementation recorded as a dirty
working tree. Power and thermal state were not recorded.

| Scenario              |  FPS | Frame p95 | Frame p99 | Above 33.3 ms |
| --------------------- | ---: | --------: | --------: | ------------: |
| Previous demo, CPU ×4 | 40.1 |   30.5 ms |   34.7 ms |          1.7% |
| Atelier demo, CPU ×4  | 16.4 |   73.4 ms |   87.4 ms |          100% |
| Atelier demo, CPU ×1  | 72.7 |   20.0 ms |   24.0 ms |            0% |

The unthrottled run passes the harness's working smoothness check. The CPU ×4
stress case regresses substantially: scene mesh count rises from 1,437 to 3,202,
median calls from 286 to 415 and median submitted triangles from 176,570 to 336,704.
This is a known performance limit for slower CPUs, not mobile acceptance. A real
phone was not measured; phone GPU, battery, thermal limits, first load, every
floor, night lighting and all editor gestures remain outside these results.

Commands: `npm run perf -- --scenario demo --path touch-orbit-v1 --cpu-rate 4`
and the same command at `--cpu-rate 1 --check`. Compact reports:

- [Previous demo CPU ×4](performance-baselines/2026-11-04-legacy-demo-touch-cpu4.json)
- [Atelier CPU ×4](performance-baselines/2026-11-04-atelier-demo-touch-cpu4.json)
- [Atelier CPU ×1](performance-baselines/2026-11-04-atelier-demo-touch.json)

Raw frame samples and HTML reports remain in ignored
`test-results/solstice-atelier/performance-{before,after,unthrottled}.{json,html}`.

## 2026-11-05 · Atelier interaction checkpoint on the locked desktop

The permanent `npm run perf:interactions` benchmark covers trusted item movement
and canvas deselection, cold/repeated floor switches, and WASD/mouse Walk input.
The candidate substantially reduces the editor pauses. **The strict smoothness
check remains red, and Walk fluidity has not been accepted.**

The [baseline](performance-baselines/2026-11-05-atelier-editor-walk-before.json)
uses frozen runtime `819001d`. The
[candidate](performance-baselines/2026-11-05-atelier-editor-walk-after.json)
records `1afac53` plus working-tree changes. Both use the same Atelier home hash
`ddc99322…a2fc9`, Chromium 151 on Apple M5 Pro / Darwin 25.6.0 with ANGLE Metal,
a headless 1440 × 960 desktop viewport, CPU ×1, three repetitions and the original
450 ms key holds. No profiler ran during these captures. Power and thermal state
were not recorded.

| Interaction                             |               Baseline |             Candidate |
| --------------------------------------- | ---------------------: | --------------------: |
| Arrange entry                           |                3.629 s |               3.834 s |
| Move item, maximum frame                |     1,566.7–1,567.1 ms |          66.5–66.8 ms |
| Deselect, maximum frames                | 35.0 / 34.9 / 433.4 ms | 35.1 / 34.6 / 99.9 ms |
| First floor, cold maximum frame         |             2,166.7 ms |              168.3 ms |
| Remaining floor switches, maximum frame |     2,099.8–2,233.3 ms |         66.6–100.0 ms |
| Walk frame p95                          |  66.8 / 66.8 / 66.7 ms | 66.7 / 66.7 / 66.9 ms |
| Walk callback FPS                       |     26.3 / 26.3 / 19.5 |    26.8 / 26.0 / 25.4 |
| Walk third repetition, maximum frame    |               733.4 ms |              100.0 ms |

Preparing retained floors makes Arrange entry about **205 ms slower** in this
comparison. Cold first-use work remains visible separately from repeated floor
switches. The candidate still records a **153 ms cold-switch task**, a **129 ms
deferred task after deselection**, and a **127 ms late Walk task**. The probe keeps
two trailing RAF callbacks so those tasks remain part of the result.

The editor canvas is 1080 × 821 at DPR 1. Walk uses 1800 × 1200 at DPR 1.25.
Every repetition records stable start/end canvas dimensions. The compact reports
retain these per-scenario values, workload counters and all result summaries.
Raw input/frame/task arrays and diagnostic profiles remain in ignored
`test-results/performance/`.

The [contemporaneous empty WebGL input control](performance-baselines/2026-11-05-desktop-input-control.json)
records 30.0 FPS and p95 34.7 / 34.9 ms. Application Walk p95 remains about 66.7 ms.
This checkpoint was taken with the Mac locked. Its cadence is different from
the unlocked series below; do not compare callback FPS between them.

Full verification passed at this checkpoint, including **1,691 tests**.

## 2026-11-05 · Atelier interactions on the unlocked desktop

Fresh [baseline](performance-baselines/2026-11-05-atelier-editor-walk-unlocked-before.json)
and [candidate](performance-baselines/2026-11-05-atelier-editor-walk-unlocked-after.json)
captures use the same scene, Chromium/ANGLE Metal, viewport, CPU rate, stable
per-scenario canvas sizes and input replay as the locked checkpoint. The
[empty WebGL controls](performance-baselines/2026-11-05-desktop-input-control-unlocked.json)
recorded 120 FPS and p95 9.0–9.3 ms before and after the pair.
No profiler ran during the captures. The candidate is `468525c` plus the engine
and benchmark changes recorded alongside these reports.

| Interaction                       |           Baseline |    Candidate |
| --------------------------------- | -----------------: | -----------: |
| Arrange entry                     |            3.473 s |      3.817 s |
| Move item, maximum frame          | 1,358.3–1,400.5 ms | 74.2–91.6 ms |
| Third deselection, maximum frame  |           283.4 ms |      33.3 ms |
| First floor, cold maximum frame   |         1,699.9 ms |     141.6 ms |
| Remaining switches, maximum frame | 1,658.4–1,741.7 ms | 75.4–92.1 ms |
| Walk frame p95                    |            66.7 ms | 25.0–25.1 ms |
| Walk callback FPS                 |          42.1–47.5 |    55.8–58.0 |

Late LOD packing now advances between geometry jobs with a shared 6 ms budget
per render. A source keeps its full-detail geometry until its requested LOD is
ready. Bundled artwork textures initialize when loaded, including on retained
hidden floors. These changes reduce the stalls while preserving the scene and
resolution. Arrange entry costs about **344 ms more** in this pair.

Before the camera fix, Walk p95 stayed near 66.7 ms with native foreground
focus and even with the WebGL renderer reduced to a clear. The Chromium trace
showed the compositor selecting its 66.7 ms video-conference cadence once
pointer input subsided. Three parked camera elements each had a one-pixel strip
inside the viewport. Moving the elements fully outside the viewport keeps them
available to the 3D screens. In an isolated full-render A/B, Walk p95 fell from
66.7 to 17.6 ms while all three feeds continued decoding changing pixels and
both in-scene video textures updated. [Chromium frame interval matcher](https://chromium.googlesource.com/chromium/src.git/+/23a46edb04aea8e8b84d2ef0ba6e033f10ee93ed/components/viz/service/display/frame_interval_matchers.cc)

All 15 replay scenarios matched the baseline workload and canvas. Walk,
move/deselect and repeat switches meet their budgets. The optional strict check
still flags the first floor switch at **141.6 ms**, including an 81 ms
main-thread task. A resource trace found first-use toon shader variants as the
active floor's light count changed. A frozen-build diagnostic that suppressed
zero-intensity light slots still recorded a 133 ms cold frame versus 125 ms
in its own control. These captures used desktop Chromium.

Reproduce the unlocked comparison with:

```sh
npm run perf:interactions -- --label atelier-candidate --runs 3 --baseline docs/performance-baselines/2026-11-05-atelier-editor-walk-unlocked-before.json --check
```
