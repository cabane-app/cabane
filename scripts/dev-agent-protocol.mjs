// Development transport only. Editor action validation belongs to the shared executor.
export function devAgentRoomRequests(size) {
  if (!size) return [];
  const dimensions = size.split("x").map(Number);
  if (dimensions.length !== 2 || dimensions.some((value) => !Number.isFinite(value) || value <= 0))
    throw new Error("--room must be positive WIDTHxDEPTH in metres, for example 6x4.");
  const [width, depth] = dimensions;
  const points = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];
  return points.map((from, index) => ({
    method: "execute_action",
    params: { action: { type: "add-wall", from, to: points[(index + 1) % points.length] } },
  }));
}

export function devAgentRequests(input) {
  const requests = Array.isArray(input) ? input : [input];
  if (requests.length < 1 || requests.length > 100)
    throw new Error("Send between 1 and 100 requests per batch.");
  const names = new Set();
  for (const request of requests) {
    if (
      !request ||
      typeof request !== "object" ||
      typeof request.method !== "string" ||
      !request.method.trim() ||
      (request.params !== undefined &&
        (!request.params || typeof request.params !== "object" || Array.isArray(request.params)))
    )
      throw new Error("Each request needs a method and optional object params.");
    mapReferences(request.params, (reference) => {
      if (!names.has(reference.split(".")[0]))
        throw new Error(`Reference ${reference} must name an earlier request in this batch.`);
    });
    if (request.as !== undefined) {
      if (typeof request.as !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/i.test(request.as))
        throw new Error(
          "as must be a name of up to 64 letters, digits, underscores or hyphens, starting with a letter.",
        );
      if (names.has(request.as)) throw new Error(`Duplicate batch name: ${request.as}.`);
      names.add(request.as);
    }
  }
  return requests;
}

function mapReferences(value, resolve) {
  if (Array.isArray(value)) return value.map((entry) => mapReferences(entry, resolve));
  if (!value || typeof value !== "object") return value;
  if (Object.hasOwn(value, "$ref")) {
    if (
      Object.keys(value).length !== 1 ||
      typeof value.$ref !== "string" ||
      !/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*$/i.test(value.$ref)
    )
      throw new Error('A batch reference must contain only {$ref: "name.result.path"}.');
    return resolve(value.$ref);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, mapReferences(entry, resolve)]),
  );
}

export async function executeDevAgentBatch(input, execute, { full = false } = {}) {
  const results = [];
  const named = new Map();
  try {
    for (const request of devAgentRequests(input)) {
      const params = mapReferences(request.params ?? {}, (reference) => {
        const [name, ...path] = reference.split(".");
        let value = named.get(name);
        for (const key of path) {
          if (!value || typeof value !== "object" || !Object.hasOwn(value, key))
            throw new Error(
              `Batch reference ${reference} was not returned. Inspect before continuing.`,
            );
          value = value[key];
        }
        return value;
      });
      const result = await execute({ method: request.method, params });
      const compact = compactDevAgentResult(result);
      results.push(full ? result : compact);
      if (request.as) named.set(request.as, compact);
    }
    return { results };
  } catch (error) {
    return { error: error.message, completed: results.length, results };
  }
}

export function compactDevAgentResult(result) {
  if (!result?.inspection) return result;
  const { inspection, ...rest } = result;
  return {
    ...rest,
    draftRevision: inspection.draftRevision,
    activeFloorId: inspection.activeFloorId,
    errorCount: inspection.validation.filter((issue) => issue.severity !== "warning").length,
    warningCount: inspection.validation.filter((issue) => issue.severity === "warning").length,
  };
}

export function authorizeDevAgent(request, token, host) {
  return (
    request.headers.host === host &&
    !request.headers.origin &&
    !request.headers["sec-fetch-site"] &&
    request.headers.authorization === `Bearer ${token}`
  );
}
