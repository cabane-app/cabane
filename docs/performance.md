# Measuring Cabane performance

Use `npm run perf` before and after a rendering change. It measures the production
app with the checked-in Casa Solstice development home, live dev HA, a repeatable
moving camera, and a small report. Keep the
same scene, settings, browser, and machine for comparisons. Confirm improvements
on a physical phone before calling them mobile improvements.

## What to follow

| Metric                             | What it tells us                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Frame interval p95                 | 95% of sampled frames arrive within this interval. Our primary smoothness metric; lower is better.                            |
| Frames over 33.3 ms / 50 ms        | How often conspicuous hitches occur. These are project heuristics, not universal pass/fail limits.                            |
| Frame interval p50 and average FPS | Typical cadence and a familiar summary. Average FPS can hide occasional stalls.                                               |
| CPU submission time                | Wall time inside the main canvas's `renderer.render()` calls. Excludes other frame callbacks and asynchronous GPU completion. |
| Draw calls and submitted triangles | Rendering workload. Useful for explaining a change, but they do not establish smoothness by themselves.                       |

A 60 Hz display has about 16.7 ms between frames; a 120 Hz display has about
8.3 ms. Frame pacing matters as well as average speed. These are
[`requestAnimationFrame` intervals](https://web.dev/articles/speed-rendering),
including browser scheduling and display cadence, rather than direct GPU timings.
The browser also needs time outside application work to produce each frame
([rendering performance](https://web.dev/articles/rendering-performance)).
Do not interpret CPU submission time or `1000 / p95` as GPU time or measured FPS.

Our working 60 Hz target is **frame interval p95 ≤20 ms, p99 ≤33.3 ms, and less
than 1% of sampled intervals above 33.3 ms**, with average cadence close to 60 FPS.
The ideal frame budget is 16.7 ms; 20 ms allows for timer precision and scheduling
variation. CPU submission, draw calls and triangles explain cost; they are
secondary metrics, not substitutes for smooth interaction.

The `orbit-v1` path directly moves the camera. It does **not** replay touch input,
picking, gestures, or first-use compilation. Passing this rendering baseline does
not resolve reports of jank during real camera dragging. The next investigation
must reproduce that interaction and measure its pacing/latency before claiming
mobile acceptance. Simulator timings use the host GPU and may hide phone limits.

Use `--path touch-orbit-v1` for input-inclusive Chromium measurements. CDP sends
trusted touch input at up to 60 Hz, alternating one-finger pan and two-finger
rotation/pinch. Normal pointer capture, picking and camera listeners run; the
harness verifies camera movement and restores the camera and target between runs.
Keep these reports separate from `orbit-v1`: the paths cover different views.
The browser button retains the direct camera path for Safari/device comparisons.

**Record my gestures** records one ten-second capture after a three-second warmup,
leaving the normal camera controls enabled. Start dragging, rotating or pinching
when the status says to, and keep moving until the controls return. The report
shows the fraction of sampled frames with camera movement and rejects captures
without any movement. This is an interaction check, with its own
`manual-gestures-v1` series; human gestures are not an identical replay and idle
frames can make the aggregate look better. Use the movement fraction when judging
the result. Native touch checks complement the repeatable CLI comparison.

Calibrate automated Simulator input before interpreting it: on this host, an
empty WebGL page recorded p95 17 ms idle and 24 ms under the same Device Hub drag
commands, despite averaging 60 FPS in both cases. The
[control measurement](performance-baselines/2026-11-03-native-input-calibration.json)
shows scheduling noise from the simulator/input path. A failing 20 ms target
under that automation does not by itself establish an application problem.
Keep the phone target unchanged and validate real gestures on a physical device.

## Current development scenario

The default `--scenario dev-home` opens
`home/showcase/furnished.project.json` as a normal connected workspace, not the
onboarding demo. The one-shot setup uses 27 mapped synthetic HA lights with
exactly 10 on, night lighting, and a selected HA weather entity reporting
`cloudy` (not a weather preview). The current source has 239 scene items.

The session and private mappings live only in ignored
`test-results/performance/dev-ha-session.local.json`. It contains `origin`, a
temporary `accessToken`, `expiresAt`, `profile`, `lights` and `weather`. The
fixture source, account and HA workspace remain separate. Use only the loopback
test HA on `127.0.0.1:8123`; credentials never enter the build or reports.
Refresh the temporary session when it expires. No benchmark command silently
changes HA lights or weather: preflight rejects unavailable lights, a count other
than ten on, or weather other than cloudy. Reports retain only counts and a hash
of private mappings/state, and verify the workload again after capture.

The cloudy weather override is a one-shot HA state update and resets after an HA
restart. Night mode is set in the benchmark's memory-only browser preferences.
The selected weather source is also saved in the existing dev HA workspace.
No periodic automation or production change is installed.

## Repeatable local measurements

```sh
npm run perf -- --label baseline
# Make a focused change, then compare with the saved report:
npm run perf -- --label candidate --baseline test-results/performance/baseline-TIMESTAMP.json
```

The default `mobile` profile uses a 390 × 844 CSS-pixel viewport, DPR 3, touch
input, and Chrome's normal GPU selection (recorded in the report). The production build runs in an isolated browser
workspace without household data. The harness uses fresh memory-only storage on
every page load, including preferences, so it opens this build's repo home with
the prepared HA mappings and night mode.
Each of three runs warms up for three seconds,
then measures ten seconds of the time-based `orbit-v1` camera path. Summary values
are medians across runs. This measures steady motion, not startup or every editor
interaction.

Useful options:

```sh
npm run perf -- --label desktop-baseline --profile desktop
npm run perf -- --label mobile-cpu4 --cpu-rate 4
npm run perf -- --label longer --seconds 20 --runs 3
npm run perf -- --label visible --headed
npm run perf -- --path touch-orbit-v1 --cpu-rate 4 --label touch-baseline
npm run perf -- --path touch-orbit-v1 --cpu-rate 4 --label touch-candidate --check
npm run perf -- --path touch-orbit-v1 --runs 1 --label diagnostic --cpu-profile
npm run perf -- --label candidate --output test-results/performance/candidate.json
npm run perf -- --scenario demo --label old-demo
npm run perf -- --scenario apartment --path idle-v1 --profile desktop --label apartment-idle
npm run perf -- --scenario apartment --path rooms-v1 --profile desktop --label apartment-rooms
```

The disconnected `apartment` scenario uses a synthetic 12-room plan with 96 native
furniture items, including round tables. It needs no HA session or private export.
`idle-v1` leaves the camera stationary and rejects captures with camera movement.
`rooms-v1` selects rooms through the normal room-navigation buttons, then returns
to overview. Keep these paths in separate comparison series. Like `orbit-v1`,
they warm up after geometry preparation; they do not measure startup or worker
queue latency. The LOD/batcher regression tests cover preparation across repeated
worker waves while settled furniture remains stationary.

Each run also records `newBatchBuffers` per sampled interval and their sum,
`batchBuffersCreated`. These count new batch-buffer identities observed at scene
submission during capture, excluding warmup. They diagnose repeated replacement
of GPU batches without instrumenting every mesh. They do not count worker jobs,
LOD switches, in-place buffer writes, or allocations outside the sampled frames.

`--check` is an opt-in check against the working 60 Hz targets above. It saves the
report even when the target is missed. `--cpu-profile` saves a Chrome `.cpuprofile`
beside the JSON for DevTools; harness source maps retain original source locations.
Use profiling to locate work, then measure without profiling for comparisons.

Reports contain raw frame samples and source, scene, browser, OS, GPU, viewport,
and drawing-buffer metadata. A companion HTML report visualizes frame intervals
and summarizes the measurements. Open the generated `.html` in a browser. Raw
reports live in ignored `test-results/performance/`; keep the useful result and
interpretation in [the performance log](performance-log.md).

The baseline comparison rejects incompatible configurations, home content, or
browser/OS/GPU metadata. Create a new baseline after changing those inputs. A
different label or source commit is expected when testing an improvement. Keep
power state, browser visibility, and competing CPU/GPU work consistent too.
Run the benchmark without tests, builds, screen recording, or other heavy work
running at the same time. Reuse passing measurements until relevant inputs change.

## Testing a real phone

### iOS Simulator baseline

An iOS Simulator run is useful for Safari/WebKit regression comparisons while a
physical phone is unavailable. Keep it in a separate series from Chromium and
physical-device runs. The [measurement log](performance-log.md) records the
initial iPhone 17 Pro / iOS 26.1 baseline and its host hardware.

1. Start `npm run perf:serve` and open the desired device in Xcode's Simulator /
   Device Hub. Keep the device and Safari visible.
2. Open `http://127.0.0.1:4180/tests/performance-harness.html` in simulator Safari.
   The simulator can reach the Mac's loopback server directly; no VPN is needed.
3. The connected repo home opens directly. Select **Run benchmark**. Keep Safari's toolbar,
   orientation and window visibility consistent. Do not record video or profile
   during the timing run.
4. Select **Download JSON**, then accept Safari's download prompt. The file is
   beneath the selected simulator's data directory in
   `Containers/Data/Application/*/Library/Safari/Downloads/*/cabane-performance.json`.
   Copy it into ignored `test-results/performance/` for analysis.
5. When importing the JSON, record `configuration.profile: "ios-simulator"`,
   `configuration.simulatorRuntime` (including build), and the environment's
   simulator device, host CPU and OS. Use the same context fields on future runs.
   The archived baseline demonstrates these fields; the browser's user agent can
   hide the true iOS version, so retain the runtime explicitly.

If `xcrun simctl` is missing because the active tools point to CommandLineTools,
use the installed Xcode for that command without changing system defaults:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl list devices available
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl openurl SIMULATOR_UDID http://127.0.0.1:4180/tests/performance-harness.html
```

Simulator rendering still uses the Mac's hardware. A useful simulator baseline
does not establish physical-phone performance.

### Physical device

Desktop emulation is useful for fast iteration. A mobile viewport and CPU slowdown
do not reproduce a phone's hardware, graphics driver, memory limits, or thermal
behavior. Chrome describes Device Mode as an
[approximation and recommends testing on an actual device](https://developer.chrome.com/docs/devtools/device-mode#limitations).
`--cpu-rate 4` means a desktop CPU slowdown, not a particular phone model. An iOS
Simulator also uses the Mac's hardware; use it for browser/UI checks, then confirm
rendering performance on a physical device.

Start the production harness on the development machine:

```sh
npm run perf:serve -- --scenario demo --host 0.0.0.0
```

On a phone on the same trusted LAN, open
`http://YOUR_COMPUTER_LAN_IP:4180/tests/performance-harness.html`. Select **Explore
the demo**, then **Run benchmark** and **Download JSON**. The harness wraps the
real app; the benchmark controls are absent from the normal product. The page
must remain visible while measuring. Stop the server when finished.

This LAN command serves the old disconnected demo. The live dev HA scenario
stays loopback-only so it does not expose its temporary credentials. A real phone
needs an appropriate authenticated HA/HTTPS route to measure that scenario;
desktop demo numbers cannot substitute for it.

Use a meaningful label such as `pixel-7-chrome-baseline`. Record the phone model,
OS/browser version, battery/charging state, and whether the device is cool or hot
in the performance log. Each click runs three captures; keep conditions similar. Preserve
the actual viewport, DPR, and drawing-buffer values from the report. Compare the
same device and browser, and include a short observation about touch/orbit
smoothness. No physical-phone result has been recorded yet.

Download a JSON before and after a change, then compare them on the computer:

```sh
npm run perf:compare -- before.json after.json
```

This generates `test-results/performance/comparison.html` without rerunning the
benchmark. Use `--output PATH` to keep several comparison charts.

For a deeper trace when a result needs explanation:

- **Android Chrome:** enable Developer Options and USB debugging, connect the
  phone, accept its trust prompt, then open `chrome://inspect#devices` in desktop
  Chrome and inspect the phone's page. Chrome documents
  [remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)
  and [port forwarding to a local server](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/).
- **iPhone/iPad Safari:** enable Settings → Apps → Safari → Advanced → Web
  Inspector, connect and trust the Mac, then select the phone's page in Safari's
  Develop menu. Enable Safari's developer features first. See Apple's
  [device inspection instructions](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios).

Use a Performance/Timelines recording to investigate CPU tasks, rendering, and
long stalls. Take the comparison benchmark separately without recording or
screencasting. No cloud device service or device farm is required to begin.

## Draw calls, triangles, LOD, and instancing

The advice to stay below 50 calls and 100,000 triangles is a useful starting
question, not a portable mobile guarantee. Shadows, materials, screen resolution,
transparency, and shader cost also matter. Reducing the drawing buffer or batching
draws can help different bottlenecks
([WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)).
Keep quality comparisons alongside timing comparisons.

`npm run measure:scene` remains the detailed Orbit, Walk, Construct, and Arrange
workload diagnostic. Its optional `--check` guardrails are currently **fewer than
50 draw calls and 150,000 submitted triangles**, including a forced shadow refresh.
It defaults to SwiftShader for counts; use `npm run perf` for native-GPU timing.
Counts include all main-canvas passes. Three.js normally resets
[`renderer.info` on each render call](https://threejs.org/docs/pages/WebGLRenderer.html),
so the harness accumulates the complete frame. Other canvases, such as catalog
thumbnails, are outside those counts.

- [`InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html) shares one
  geometry/material across transformed copies to reduce draw calls.
- [LOD](https://threejs.org/docs/pages/LOD.html) selects a simpler mesh when less
  detail is visible. [meshoptimizer](https://github.com/zeux/meshoptimizer) provides
  geometry simplification and optimization tools; adding it alone does not define
  the application's LOD policy.
- Cabane already has meshoptimizer-based geometry preparation in
  [`geometry-lod.ts`](../packages/engine/src/scene-batching/geometry-lod.ts), a
  [worker](../packages/engine/src/scene-batching/geometry-lod.worker.ts), and
  runtime selection in
  [`SceneGeometryLod`](../packages/engine/src/scene-batching/SceneGeometryLod.ts).
  [`SceneToonBatcher`](../packages/engine/src/scene-batching/SceneToonBatcher.ts)
  uses `BatchedMesh` for compatible geometry. Both are wired through
  [`StylizedScene`](../packages/engine/src/StylizedScene.tsx).

This harness adds measurement, not a new rendering optimization. For each future
iteration, save baseline/candidate reports, log the result and visual tradeoff,
and check the promising change on the affected phone. Expand the scenario only
when a specific interaction or view is not represented by the orbit benchmark.
