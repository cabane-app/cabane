import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export function developmentWorkload(project, session, states) {
  if (new Set(session.lights).size !== session.lights.length)
    throw new Error("Mapped benchmark lights must be distinct.");
  const lights = session.lights.map((id) => states.find((state) => state.entity_id === id));
  if (lights.length < 15 || lights.some((state) => !state || !["on", "off"].includes(state.state)))
    throw new Error("Dev HA needs at least 15 available mapped lights.");
  const on = lights.filter((state) => state.state === "on");
  if (on.length !== 10) throw new Error(`Expected 10 mapped lights on; found ${on.length}.`);
  const weather = states.find((state) => state.entity_id === session.weather);
  if (weather?.state !== "cloudy") throw new Error("Selected dev HA weather must report cloudy.");
  const fixtureHash = createHash("sha256")
    .update(
      JSON.stringify({
        profile: session.profile,
        lights: lights.map((state) => [state.entity_id, state.state, state.attributes]),
        weather: [weather.state, weather.attributes],
      }),
    )
    .digest("hex");
  return {
    scenario: "solstice-ha-night-cloudy-v1",
    home: "home/showcase/furnished.project.json",
    sceneItems: project.sceneItems.length,
    lighting: "night",
    weather: weather.state,
    weatherSource: "Home Assistant",
    mappedLights: lights.length,
    lightsOn: on.length,
    fixtureHash,
  };
}

export async function loadDevelopmentHome(repository) {
  let session;
  try {
    session = JSON.parse(
      await readFile(
        resolve(repository, "test-results/performance/dev-ha-session.local.json"),
        "utf8",
      ),
    );
  } catch {
    throw new Error(
      "Prepare the private dev HA session in test-results/performance/dev-ha-session.local.json first. Use --scenario demo for the old disconnected benchmark.",
    );
  }
  if (session.origin !== "http://127.0.0.1:8123")
    throw new Error("The dev benchmark only connects to loopback HA on port 8123.");
  if (!(session.expiresAt > Date.now() + 60_000))
    throw new Error("The temporary dev HA session expired. Refresh it before benchmarking.");
  const response = await fetch(`${session.origin}/api/states`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Dev HA returned HTTP ${response.status}.`);
  const states = await response.json();
  const project = JSON.parse(
    await readFile(resolve(repository, "home/showcase/furnished.project.json"), "utf8"),
  );
  return {
    origin: session.origin,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    profile: session.profile,
    workload: developmentWorkload(project, session, states),
  };
}
