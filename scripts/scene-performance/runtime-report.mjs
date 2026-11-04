const METRICS = {
  fps: ["Average callback FPS", "fps", 1],
  frameMsP50: ["Frame interval p50", "ms", 2],
  frameMsP95: ["Frame interval p95", "ms", 2],
  frameMsP99: ["Frame interval p99", "ms", 2],
  over33MsPercent: ["Frames over 33.3 ms", "%", 1],
  over50MsPercent: ["Frames over 50 ms", "%", 1],
  cpuSubmitMsP95: ["CPU render submission p95", "ms", 2],
  callsMedian: ["Draw calls median", "", 1],
  callsMax: ["Draw calls maximum", "", 0],
  trianglesMedian: ["Triangles median", "", 0],
  trianglesMax: ["Triangles maximum", "", 0],
};

function valuesOf(run, key, positive = false) {
  const values = run?.[key];
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.some((value) => !Number.isFinite(value) || (positive ? value <= 0 : value < 0))
  ) {
    throw new Error(
      `Invalid ${key}: expected a nonempty array of finite ${positive ? "positive" : "nonnegative"} numbers.`,
    );
  }
  return [...values].sort((a, b) => a - b);
}

const percentile = (sorted, fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
const median = (sorted) =>
  (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;

export function summarizeRun(run) {
  const intervals = valuesOf(run, "frameIntervalsMs", true);
  const cpu = valuesOf(run, "cpuSubmitMs");
  const calls = valuesOf(run, "calls");
  const triangles = valuesOf(run, "triangles");
  if ([cpu, calls, triangles].some((values) => values.length !== intervals.length)) {
    throw new Error(
      "Runtime measurement arrays must have the same length, with one entry per frame interval.",
    );
  }
  const over = (threshold) =>
    (100 * intervals.filter((value) => value > threshold).length) / intervals.length;
  return {
    fps: (1000 * intervals.length) / intervals.reduce((sum, value) => sum + value, 0),
    frameMsP50: percentile(intervals, 0.5),
    frameMsP95: percentile(intervals, 0.95),
    frameMsP99: percentile(intervals, 0.99),
    over33MsPercent: over(1000 / 30),
    over50MsPercent: over(50),
    cpuSubmitMsP95: percentile(cpu, 0.95),
    callsMedian: median(calls),
    callsMax: calls.at(-1),
    trianglesMedian: median(triangles),
    trianglesMax: triangles.at(-1),
  };
}

export function summarizeRuns(runs) {
  if (!Array.isArray(runs) || !runs.length) throw new Error("No runtime runs were measured.");
  const measured = runs.map((run) => ({ ...run, summary: summarizeRun(run) }));
  const summary = Object.fromEntries(
    Object.keys(METRICS).map((key) => [
      key,
      median(measured.map((run) => run.summary[key]).sort((a, b) => a - b)),
    ]),
  );
  return { runs: measured, summary };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

const same = (a, b) => JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));

export function compareRuntimeReports(current, baseline) {
  if (current.schemaVersion !== 1 || baseline.schemaVersion !== 1) {
    throw new Error("Runtime report schema differs or is unsupported.");
  }
  if (!same(current.configuration, baseline.configuration)) {
    throw new Error(
      "Baseline configuration differs. Use the same scene path, duration, viewport, DPR, profile and CPU rate.",
    );
  }
  if (!current.source?.homeHash || current.source.homeHash !== baseline.source?.homeHash) {
    throw new Error("Baseline homeHash differs or is missing. Measure the same home fixture.");
  }
  for (const key of [
    "userAgent",
    "gpu",
    "hardwareConcurrency",
    "coarsePointer",
    "browser",
    "platform",
    "cpuRate",
    "cpu",
    "headless",
  ]) {
    if (!same(current.environment?.[key], baseline.environment?.[key])) {
      throw new Error(
        `Baseline environment.${key} differs. Compare on the same device and browser.`,
      );
    }
  }
  return Object.fromEntries(
    Object.keys(METRICS).map((key) => {
      const before = baseline.summary?.[key];
      const after = current.summary?.[key];
      if (!Number.isFinite(before) || !Number.isFinite(after))
        throw new Error(`Invalid runtime summary metric ${key}.`);
      return [
        key,
        {
          before,
          after,
          delta: after - before,
          percent: before === 0 ? null : ((after - before) / before) * 100,
        },
      ];
    }),
  );
}

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const number = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : "—");
const metricValue = (key, value) =>
  `${number(value, METRICS[key][2])}${METRICS[key][1] ? ` ${METRICS[key][1]}` : ""}`;

function frameChart(run, index, ceiling) {
  const intervals = run.frameIntervalsMs;
  const width = 900,
    height = 170,
    left = 48,
    right = 12,
    top = 12,
    bottom = 28;
  const duration = intervals.reduce((sum, value) => sum + value, 0);
  let elapsed = 0;
  const y = (value) => top + (height - top - bottom) * (1 - value / ceiling);
  const points = intervals
    .map((value) => {
      elapsed += value;
      return `${(left + ((width - left - right) * elapsed) / duration).toFixed(1)},${y(value).toFixed(1)}`;
    })
    .join(" ");
  const guides = [1000 / 60, 1000 / 30]
    .map(
      (value) =>
        `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" class="guide"/><text x="${left - 7}" y="${y(value) + 4}" text-anchor="end">${number(value)} ms</text>`,
    )
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Run ${index + 1} frame intervals over ${number(duration / 1000)} seconds">
    ${guides}<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.25"/>
    <text x="${left}" y="${height - 6}">0 s</text><text x="${width - right}" y="${height - 6}" text-anchor="end">${number(duration / 1000)} s</text>
    <text x="${left}" y="${top}" class="scale">Scale 0–${number(ceiling, 0)} ms</text>
  </svg>`;
}

export function renderRuntimeReport(report) {
  const title = report.label || "Cabane runtime performance";
  const comparison = report.comparison;
  const rows = Object.entries(METRICS)
    .map(([key, [label]]) => {
      const change = comparison?.[key];
      const delta = change
        ? `${change.delta > 0 ? "+" : ""}${metricValue(key, change.delta)}${change.percent === null ? "" : ` (${change.percent > 0 ? "+" : ""}${number(change.percent)}%)`}`
        : "—";
      return `<tr><th scope="row">${label}</th>${comparison ? `<td>${escape(metricValue(key, change?.before))}</td>` : ""}<td>${escape(metricValue(key, report.summary[key]))}</td>${comparison ? `<td>${escape(delta)}</td>` : ""}</tr>`;
    })
    .join("");
  const ceiling = Math.max(
    50,
    ...report.runs.map((run) => Math.ceil(Math.max(...run.frameIntervalsMs) / 10) * 10),
  );
  const runs = report.runs
    .map((run, index) => {
      const summary = run.summary || summarizeRun(run);
      const motion = Number.isFinite(run.movingFrames)
        ? ` · camera moved in ${number((100 * run.movingFrames) / run.frameIntervalsMs.length)}% of sampled frames`
        : "";
      const buffers = Number.isFinite(run.batchBuffersCreated)
        ? ` · ${number(run.batchBuffersCreated, 0)} new batch buffers observed during capture`
        : "";
      return `<article><h3>Run ${index + 1}</h3><p>${run.frameIntervalsMs.length} intervals · ${escape(metricValue("fps", summary.fps))} · p95 ${escape(metricValue("frameMsP95", summary.frameMsP95))} · ${escape(metricValue("over33MsPercent", summary.over33MsPercent))} over 33.3 ms${motion}${buffers}</p>${frameChart(run, index, ceiling)}</article>`;
    })
    .join("");
  const context = JSON.stringify(
    {
      configuration: report.configuration,
      environment: report.environment,
      source: report.source,
      scene: report.scene,
    },
    null,
    2,
  );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>
  :root{color-scheme:light dark;font-family:system-ui,sans-serif;color:#182128;background:#f6f7f9}body{max-width:1050px;margin:36px auto;padding:0 20px 40px}h1{font-size:1.8rem;margin-bottom:8px}h2{margin-top:32px;font-size:1.25rem}h3{font-size:1rem;margin-bottom:4px}p{line-height:1.5;max-width:85ch;color:#4d5b66}.metrics{overflow:auto}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:10px 14px;border-bottom:1px solid #dce1e6;text-align:right;white-space:nowrap}th:first-child{text-align:left}thead{background:#e8edf2}article{background:#fff;border:1px solid #dce1e6;border-radius:8px;padding:4px 16px 12px;margin:16px 0}article p{font-size:.85rem;margin-top:4px}svg{display:block;width:100%;color:#2c65c8}svg text{font:11px system-ui;fill:#566572}.guide{stroke:#adb9c6;stroke-dasharray:4 4}.scale{font-size:10px}pre{overflow:auto;font-size:.8rem;line-height:1.5;background:#e8edf2;padding:16px}summary{cursor:pointer}code{font-size:.9em}@media(prefers-color-scheme:dark){:root{color:#e7edf4;background:#141a21}p{color:#b4c0cc}table,article{background:#1c2530}th,td,article{border-color:#354251}thead,pre{background:#26313e}svg{color:#82afff}svg text{fill:#b4c0cc}.guide{stroke:#66768a}}@media(max-width:600px){body{margin-top:20px;padding:0 12px 24px}th,td{padding:9px}h1{font-size:1.5rem}article{padding:4px 8px}}
</style></head><body>
<h1>${escape(title)}</h1><p>${escape(report.configuration.profile ?? "physical browser")} · ${escape(report.configuration.path)} · ${report.runs.length} runs · ${escape(report.configuration.seconds)} seconds each · production build</p>
<h2>Median of run summaries</h2><p>Lower frame intervals and fewer slow frames indicate smoother motion. Average FPS alone can hide stutters. Each run has equal weight.</p>
<div class="metrics"><table><thead><tr><th scope="col">Metric</th>${comparison ? '<th scope="col">Before</th>' : ""}<th scope="col">${comparison ? "After" : "Measured"}</th>${comparison ? '<th scope="col">Change</th>' : ""}</tr></thead><tbody>${rows}</tbody></table></div>
<h2>Frame intervals</h2><p>Guides mark 60 Hz (16.7 ms) and 30 Hz (33.3 ms). This measures animation callback cadence, not confirmed display presentation. CPU submission excludes asynchronous GPU execution. Draw calls and triangles diagnose scene cost; they are not universal performance budgets.</p>
${runs}<details><summary>Measurement context</summary><pre>${escape(context)}</pre></details>
</body></html>`;
}
