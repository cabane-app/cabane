# Performance measurements

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
