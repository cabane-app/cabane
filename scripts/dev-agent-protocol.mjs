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
  }
  return requests;
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
