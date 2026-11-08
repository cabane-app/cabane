import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { SolarLighting } = await load("/packages/engine/src/SceneLighting.tsx");
  const { deriveSolarLighting } = await load("/packages/engine/src/lighting.ts");
  const { transitionSolarDirection } = await load(
    "/packages/engine/src/solar-direction-transition.ts",
  );

  const { resolveSolarLighting } = await load("/packages/engine/src/lighting.ts");
  const { solarShadowFrame } = await load("/packages/engine/src/solar-shadow-frame.ts");
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  await test("geographic solar direction uses plan north and clockwise building rotation", () => {
    for (const [azimuth, expected] of [
      [0, [0, 0, -18]],
      [90, [18, 0, 0]],
      [180, [0, 0, 18]],
      [270, [-18, 0, 0]],
    ]) {
      const sun = { state: "above_horizon", attributes: { azimuth, elevation: 0 } };
      assert.ok(
        new Vector3(...deriveSolarLighting(sun).sunPosition).distanceTo(new Vector3(...expected)) <
          1e-8,
      );
      const rotated = deriveSolarLighting(sun, "live", 90);
      const next = deriveSolarLighting({
        ...sun,
        attributes: { azimuth: azimuth + 90, elevation: 0 },
      });
      assert.ok(
        new Vector3(...rotated.sunPosition).distanceTo(new Vector3(...next.sunPosition)) < 1e-8,
      );
    }
    assert.equal(
      deriveSolarLighting({ state: "below_horizon", attributes: { azimuth: 0, elevation: -2 } })
        .sunIntensity,
      0,
    );
  });
  await test("Auto source and night state agree when solar data is missing, invalid or stale", () => {
    const day = new Date(2026, 0, 1, 12),
      night = new Date(2026, 0, 1, 23);
    const sun = { state: "above_horizon", attributes: { azimuth: 0, elevation: 35 } };
    assert.deepEqual(resolveSolarLighting("live", sun, night), {
      mode: "live",
      night: false,
      source: "Home Assistant",
    });
    for (const invalid of [
      undefined,
      { ...sun, stale: true },
      { ...sun, available: false },
      { ...sun, attributes: { elevation: 35 } },
      { ...sun, state: "unknown" },
    ]) {
      assert.deepEqual(resolveSolarLighting("live", invalid, day), {
        mode: "day",
        night: false,
        source: "Local time",
      });
      assert.deepEqual(resolveSolarLighting("live", invalid, night), {
        mode: "night",
        night: true,
        source: "Local time",
      });
    }
    assert.deepEqual(resolveSolarLighting("night", sun, day), {
      mode: "night",
      night: true,
      source: "Preview",
    });
  });
  await test("solar shadows and Walk sky stay aligned on a translated multi-storey building", async () => {
    const floors = makeThreeFloorProject().floors.map((floor) => ({
      ...floor,
      coordinates: { ...floor.coordinates, origin: [-100, 50], metersPerPlanUnit: 2 },
    }));
    const frame = solarShadowFrame(floors);
    assert.ok(frame.distance > frame.radius);
    for (const floor of floors)
      for (const [x, z] of floor.footprint) {
        assert.ok(
          new Vector3((x + 100) * 2, 0, (z - 50) * 2).distanceTo(new Vector3(...frame.center)) <
            frame.radius,
        );
      }
    const renderer = await create(
      createElement(SolarLighting, {
        mode: "day",
        shadowMapSize: 1024,
        walkMode: true,
        floors,
        northAngleDegrees: 90,
      }),
    );
    try {
      await renderer.advanceFrames(180, 1 / 60);
      const sun = renderer.scene.children.find((node) => node.instance.isDirectionalLight).instance;
      const direction = sun.position.clone().sub(sun.target.position).normalize();
      assert.ok(
        direction.distanceTo(
          new Vector3(...deriveSolarLighting(undefined, "day", 90).sunPosition).normalize(),
        ) < 1e-6,
      );
      assert.ok(
        renderer.scene
          .findByProps({ name: "walk-sky" })
          .instance.material.uniforms.sunDirection.value.distanceTo(direction) < 1e-6,
      );
      assert.equal(sun.shadow.camera.right, frame.radius);
      assert.equal(sun.shadow.camera.far, frame.far);
    } finally {
      await renderer.unmount();
    }
  });

  await test("sun transitions remain finite and nonzero across opposite directions and azimuth wrap", () => {
    for (const [start, end] of [
      [
        [18, 0, 0],
        [-18, 0, 0],
      ],
      [
        [18, 0, -0.01],
        [18, 0, 0.01],
      ],
      [
        [0, 18, 0],
        [0, -18, 0],
      ],
    ]) {
      const current = new Vector3(...start);
      const target = new Vector3(...end);
      for (let i = 0; i < 100; i++) {
        transitionSolarDirection(current, target, 0.5);
        assert.ok(current.toArray().every(Number.isFinite));
        assert.ok(current.length() > 17.9);
      }
      assert.ok(current.distanceTo(target) < 0.001);
    }
  });

  await test("Walk sky follows rendered solar state, fallback, and mode transitions", async () => {
    const props = { mode: "day", shadowMapSize: 1024, walkMode: true };
    const renderer = await create(createElement(SolarLighting, props));
    try {
      for (const input of [
        { mode: "day" },
        { mode: "night" },
        { mode: "live" },
        { mode: "live", sunState: { state: "unknown", attributes: { elevation: "bad" } } },
        ...[-8, -1, 0, 4, 35].map((elevation) => ({
          mode: "live",
          sunState: {
            state: "above_horizon",
            attributes: { azimuth: 359, elevation },
          },
        })),
      ]) {
        await renderer.update(createElement(SolarLighting, { ...props, ...input }));
        await renderer.advanceFrames(1, 1 / 60);
        const sky = renderer.scene.findByProps({ name: "walk-sky" }).instance;
        const sun = renderer.scene.children.find(
          (node) => node.instance.isDirectionalLight,
        ).instance;
        assert.ok(
          sky.material.uniforms.sunDirection.value.distanceTo(sun.position.clone().normalize()) <
            1e-6,
        );
        assert.equal(sky.material.depthWrite, false);
        assert.equal(sky.castShadow, false);
        assert.equal(sky.frustumCulled, false);
        await renderer.advanceFrames(180, 1 / 60);
        const expected = deriveSolarLighting(input.sunState, input.mode);
        assert.ok(
          sun.position.distanceTo(
            new Vector3(...expected.sunPosition).normalize().multiplyScalar(18),
          ) < 0.01,
        );
        assert.ok(sky.material.uniforms.sunColor.value.equals(sun.color));
        assert.ok(
          Math.abs(sky.material.uniforms.daylight.value - expected.daylight) < 0.04,
          "GPU daylight must follow the solar transition",
        );
      }
      await renderer.update(createElement(SolarLighting, { ...props, walkMode: false }));
      assert.equal(renderer.scene.findAllByProps({ name: "walk-sky" }).length, 0);
    } finally {
      await renderer.unmount();
    }
  });
});
