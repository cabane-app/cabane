# Performance measurements

Keep one row per useful experiment. Save raw JSON and charts in ignored
`test-results/performance/`; retain a small, synthetic baseline JSON alongside
this log when a comparison needs to survive checkout cleanup. Do not commit
household scenes, identifiers, credentials or screenshots.

Read [the measurement guide](performance.md) before comparing results. Lower p95
and fewer frames over 33.3 ms are the primary signals. A laptop mobile profile is
a regression proxy; a real phone validates mobile improvements.

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
