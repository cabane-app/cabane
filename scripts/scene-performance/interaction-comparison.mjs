const metrics = ["fps", "frameMsP50", "frameMsP95", "maxFrameMs", "maxLongTaskMs", "maxFeedbackMs"];
const context = [
  ["path"],
  ...["cpuRate", "runs", "walkHoldMs", "captureTailFrames", "viewport"].map((key) => [
    "configuration",
    key,
  ]),
  ["source", "homeHash"],
  ...["browser", "platform", "cpu", "gpu", "canvas", "headless"].map((key) => ["environment", key]),
];
const normalized = (value) => {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalized(value[key])]),
    );
  return value;
};
const canonical = (value) => JSON.stringify(normalized(value));

function scenarios(report) {
  if (!Array.isArray(report.results) || !report.results.length)
    throw new Error("Interaction report has no measured scenarios.");
  const entries = report.results.map((result) => {
    if (typeof result.name !== "string" || !result.name)
      throw new Error("Interaction scenario is missing its name.");
    for (const field of ["canvasStart", "canvasEnd"]) {
      const canvas = result[field];
      if (
        !canvas ||
        !Number.isInteger(canvas.width) ||
        canvas.width <= 0 ||
        !Number.isInteger(canvas.height) ||
        canvas.height <= 0 ||
        !Number.isFinite(canvas.dpr) ||
        canvas.dpr <= 0
      )
        throw new Error(`Missing or invalid interaction canvas ${result.name}.${field}.`);
    }
    if (
      result.canvasStable !== true ||
      canonical(result.canvasStart) !== canonical(result.canvasEnd)
    )
      throw new Error(`Interaction canvas changed during ${result.name}.`);
    for (const metric of metrics)
      if (!Number.isFinite(result[metric]) || result[metric] < 0)
        throw new Error(`Invalid interaction metric ${result.name}.${metric}.`);
    return [result.name, result];
  });
  const result = new Map(entries);
  if (result.size !== entries.length) throw new Error("Interaction scenario names must be unique.");
  return result;
}

/** Compare matching input workloads; labels, origins and source commits may differ. */
export function compareInteractionReports(report, baseline) {
  for (const path of context) {
    const current = path.reduce((value, key) => value?.[key], report);
    const previous = path.reduce((value, key) => value?.[key], baseline);
    if (current === undefined || previous === undefined)
      throw new Error(`Missing interaction context ${path.join(".")}.`);
    if (canonical(current) !== canonical(previous))
      throw new Error(`Interaction context ${path.join(".")} differs from the baseline.`);
  }
  const current = scenarios(report),
    previous = scenarios(baseline);
  if (current.size !== previous.size || [...current.keys()].some((name) => !previous.has(name)))
    throw new Error("Interaction scenario inventory differs from the baseline.");
  return Object.fromEntries(
    [...current].map(([name, result]) => {
      const beforeResult = previous.get(name);
      if (
        canonical(result.canvasStart) !== canonical(beforeResult.canvasStart) ||
        canonical(result.canvasEnd) !== canonical(beforeResult.canvasEnd)
      )
        throw new Error(`Interaction canvas ${name} differs from the baseline.`);
      return [
        name,
        Object.fromEntries(
          metrics.map((metric) => {
            const before = beforeResult[metric],
              after = result[metric],
              delta = after - before;
            return [
              metric,
              { before, after, delta, percent: before > 0 ? (100 * delta) / before : null },
            ];
          }),
        ),
      ];
    }),
  );
}
