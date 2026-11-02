import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, PerspectiveCamera, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const catalog = await load("/packages/catalog/src/device/index.ts");
  const architectureCatalog = await load("/packages/catalog/src/architecture/index.ts");
  const engine = await load("/packages/engine/src/index.ts");
  const validationCore = await load("/packages/engine/src/validation/core.ts");
  const fixtures = await load("/tests/fixtures/agent-home.tsx");
  const airflow = await load("/packages/catalog/src/device/visuals/airflow-waves.tsx");
  test("the activity inventory categorizes every preset exactly once", () => {
    const inventory = readFileSync(new URL("../docs/device-activity.md", import.meta.url), "utf8");
    const ids = inventory
      .split("\n")
      .filter((line) => line.startsWith("| "))
      .flatMap((line) => [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]));
    assert.deepEqual(ids.sort(), [...catalog.STABLE_DEVICE_MODEL_IDS].sort());
  });

  test("microwave glass and controls sit clearly ahead of their backing surfaces", async () => {
    for (const visualState of [
      "connected-active",
      "connected-inactive",
      "unavailable",
      "disconnected",
    ]) {
      const renderer = await create(
        createElement(catalog.stableDeviceRegistry.microwave.component, {
          visualState,
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
        }),
      );
      const root = renderer.scene.findByProps({ name: "catalog-microwave" }).instance;
      const front = (object) => new Box3().setFromObject(object).max.z;
      const housing = root.getObjectByName("microwave-housing");
      const door = root.getObjectByName("microwave-door");
      const glass = root.getObjectByName("microwave-window");
      const controls = root.getObjectByName("microwave-control-panel");
      const display = root.getObjectByName("microwave-display");
      assert.ok(front(door) - front(housing) > 0.001, "door must not be coplanar with housing");
      assert.ok(front(glass) - front(door) > 0.001, "glass must not be coplanar with door");
      assert.ok(front(controls) - front(housing) > 0.001, "control panel must clear housing");
      assert.ok(front(display) - front(controls) > 0.001, "display must clear control panel");
      await renderer.unmount();
    }
  });

  test("TV artwork keeps distinct depth layers from room and overview cameras", async () => {
    for (const id of ["television", "wall-television", "compact-wall-television"]) {
      const renderer = await create(
        createElement(catalog.stableDeviceRegistry[id].component, {
          visualState: "connected-active",
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
        }),
      );
      const picture = renderer.scene.findByProps({ name: "television-picture" }).instance;
      picture.updateWorldMatrix(true, true);
      const layers = [];
      picture.traverse((object) => {
        if (object.isMesh) layers.push(object);
      });
      for (const mesh of layers) {
        assert.equal(mesh.material.depthTest, true, "room geometry must still occlude the TV");
      }
      assert.equal(renderer.scene.findAllByProps({ name: "wall-television-reflection" }).length, 0);
      const target = picture.getWorldPosition(new Vector3());
      for (const distance of [2, 10, 30]) {
        for (const angle of [0, Math.PI / 3]) {
          const camera = new PerspectiveCamera(68, 1, 0.04, 120);
          camera.position
            .copy(target)
            .add(new Vector3(Math.sin(angle) * distance, 0, Math.cos(angle) * distance));
          camera.lookAt(target);
          camera.updateMatrixWorld();
          // Compare coincident screen points: 24-bit depth must keep each paint layer distinct.
          const depths = layers.map((mesh) => {
            const point = target.clone();
            point.z = mesh.getWorldPosition(new Vector3()).z;
            const depth = (point.project(camera).z + 1) / 2;
            const bias = mesh.material.polygonOffset ? mesh.material.polygonOffsetUnits : 0;
            return Math.round(depth * (2 ** 24 - 1) + bias);
          });
          for (let i = 1; i < depths.length; i++) {
            assert.ok(
              depths[i - 1] - depths[i] >= 2,
              `${id}: artwork depth collision at ${distance}m, angle ${angle}: ${depths}`,
            );
          }
        }
      }
      await renderer.unmount();
    }
  });

  test("TV flight stays inside the screen and reuses geometry for a complete loop", async () => {
    const renderer = await create(
      createElement(catalog.stableDeviceRegistry["wall-television"].component, {
        visualState: "connected-active",
        reducedMotion: false,
        walkMode: false,
        onInteract() {},
      }),
    );
    const picture = renderer.scene.findByProps({ name: "television-picture" }).instance;
    picture.updateWorldMatrix(true, true);
    const screen = new Box3().setFromObject(picture.children[0]);
    const meshes = [];
    picture.traverse((object) => {
      if (object.isMesh) meshes.push([object, object.geometry]);
    });
    for (let frame = 0; frame < 460; frame++) {
      await renderer.advanceFrames(1, 0.05);
      const bounds = new Box3().setFromObject(picture);
      assert.ok(bounds.min.x >= screen.min.x - 1e-6 && bounds.max.x <= screen.max.x + 1e-6);
      assert.ok(bounds.min.y >= screen.min.y - 1e-6 && bounds.max.y <= screen.max.y + 1e-6);
    }
    for (const [mesh, geometry] of meshes) assert.equal(mesh.geometry, geometry);
    await renderer.unmount();
  });

  test("device activity only animates active devices and freezes for reduced motion", async () => {
    for (const [id, effect, moving, axis] of [
      ["television", "television-picture", "television-picture-motion", "position"],
      ["wall-television", "television-picture", "television-picture-motion", "position"],
      ["compact-wall-television", "television-picture", "television-picture-motion", "position"],
      ["washing-machine", "laundry-drum", "laundry-drum", "rotation"],
      ["tumble-dryer", "laundry-drum", "laundry-drum", "rotation"],
      ["electric-kettle", "appliance-steam", "appliance-steam", "steam"],
      ["coffee-maker", "appliance-steam", "appliance-steam", "steam"],
      ...[
        "water-heater",
        "dishwasher",
        "smart-plug",
        "smart-power-strip",
        "pet-feeder",
        "robot-vacuum",
        "humidifier-dehumidifier",
        "air-purifier",
        "heated-towel-rail",
        "smart-panel-radiator",
        "bathroom-extractor-fan",
      ].map((id) => [id, "activity-hologram", "activity-hologram-float", "position"]),
    ]) {
      const render = (visualState = "connected-active", reducedMotion = false) =>
        createElement(catalog.stableDeviceRegistry[id].component, {
          visualState,
          reducedMotion,
          walkMode: false,
          onInteract() {},
        });
      const renderer = await create(render());
      const pose = () => {
        const object = renderer.scene.findByProps({ name: moving }).instance;
        return axis === "steam" ? object.children[0].position.toArray() : object[axis].toArray();
      };
      const initial = pose();
      await renderer.advanceFrames(5, 0.05);
      assert.notDeepEqual(pose(), initial, `${id} must animate`);
      await renderer.update(render("connected-active", true));
      const frozen = pose();
      await renderer.advanceFrames(5, 0.05);
      assert.deepEqual(pose(), frozen, `${id} must respect reduced motion`);
      for (const state of ["connected-inactive", "unavailable", "disconnected"]) {
        await renderer.update(render(state));
        assert.equal(renderer.scene.findAllByProps({ name: effect }).length, 0, `${id}: ${state}`);
      }
      await renderer.update(render());
      assert.equal(renderer.scene.findAllByProps({ name: effect }).length, 1);
      await renderer.unmount();
    }
  });

  const addedDeviceIds = [
    "heated-towel-rail",
    "smart-panel-radiator",
    "smart-thermostat",
    "smart-plug",
    "ceiling-light",
    "recessed-downlight",
    "wall-sconce",
    "illuminated-round-mirror",
    "motorized-curtain",
    "video-doorbell",
    "indoor-security-camera",
    "smoke-alarm",
    "carbon-monoxide-alarm",
    "humidity-sensor",
    "air-quality-monitor",
    "energy-monitor",
    "air-purifier",
    "bathroom-extractor-fan",
    "refrigerator",
    "smart-power-strip",
    "humidifier-dehumidifier",
    "robot-vacuum",
    "smart-lock",
    "alarm-keypad",
    "motorized-valve",
    "siren",
    "smart-button",
    "microwave",
    "coffee-maker",
    "electric-kettle",
    "freezer",
    "pet-feeder",
    "weather-station",
    "compact-car",
    "electric-sedan",
    "pickup-truck",
    "pergola-string-lights",
    "low-garden-lantern",
    "garden-lantern-pole",
    "table-lamp",
    "rattan-bell-pendant",
    "round-globe-wall-lamp",
    "wall-reading-spot",
    "oak-wall-uplight",
    "six-globe-ceiling-lamp",
    "astro-parallel-wall-light",
    "tubular-wall-lamp",
    "clip-reading-lamp",
    "woven-pendant",
    "children-pendant",
  ];

  test("irrigation sprinklers animate only while active and respect reduced motion", async () => {
    for (const id of ["pop-up-sprinkler", "rotating-sprinkler"]) {
      const definition = catalog.stableDeviceRegistry[id];
      const props = {
        visualState: "connected-active",
        reducedMotion: false,
        walkMode: false,
        onInteract() {},
      };
      const render = (overrides = {}) =>
        createElement(definition.component, { ...props, ...overrides });
      const renderer = await create(render());
      const water = () => renderer.scene.findByProps({ name: "sprinkler-water" }).instance;
      const start = water().children[0].position.clone();
      await renderer.advanceFrames(3, 0.016);
      assert.ok(start.distanceTo(water().children[0].position) > 0.001);
      await renderer.update(render({ reducedMotion: true }));
      const frozen = water().children[0].position.clone();
      await renderer.advanceFrames(3, 0.016);
      assert.deepEqual(water().children[0].position, frozen);
      for (const visualState of ["connected-inactive", "disconnected", "unavailable"]) {
        await renderer.update(render({ visualState, reducedMotion: true }));
        await renderer.advanceFrames(1, 0.016);
        assert.equal(renderer.scene.findAllByProps({ name: "sprinkler-water" }).length, 0);
        if (id === "pop-up-sprinkler")
          assert.equal(
            renderer.scene.findByProps({ name: "sprinkler-riser" }).instance.scale.y,
            0.08,
          );
      }
      await renderer.update(render({ reducedMotion: true }));
      await renderer.advanceFrames(1, 0.016);
      if (id === "pop-up-sprinkler")
        assert.equal(renderer.scene.findByProps({ name: "sprinkler-riser" }).instance.scale.y, 1);
      const meshes = renderer.scene.findAll((node) => node.type === "Mesh");
      assert.ok(meshes.length <= definition.complexity.visibleMeshes);
      let triangles = 0;
      for (const mesh of meshes) {
        assert.equal(mesh.instance.material.type, "MeshToonMaterial");
        triangles +=
          (mesh.instance.geometry.index?.count ??
            mesh.instance.geometry.attributes.position.count) / 3;
      }
      assert.ok(triangles <= definition.complexity.triangles, `${id}: ${triangles}`);
      await renderer.unmount();
    }
  });

  test("irrigation hardware fits its declared ground-contact envelope", async () => {
    for (const id of [
      "pop-up-sprinkler",
      "rotating-sprinkler",
      "smart-hose-timer",
      "soil-moisture-sensor",
    ]) {
      const definition = catalog.stableDeviceRegistry[id];
      const renderer = await create(
        createElement(definition.component, {
          visualState: "connected-active",
          reducedMotion: true,
        }),
      );
      for (const water of renderer.scene.findAllByProps({ name: "sprinkler-water" }))
        water.instance.removeFromParent();
      const bounds = new Box3().setFromObject(renderer.scene.instance);
      const size = bounds.getSize(new Vector3()).toArray();
      size.forEach((value, axis) =>
        assert.ok(
          Math.abs(value - definition.defaultSize[axis]) < 0.001,
          `${id}: axis ${axis} = ${value}`,
        ),
      );
      assert.ok(Math.abs(bounds.min.y) < 0.001);
      await renderer.unmount();
    }
  });

  const coverState = (state = "open", position = 35, extra = {}) => ({
    entityId: "cover.fixture_blind",
    state,
    available: true,
    stale: false,
    attributes: { current_position: position },
    ...extra,
  });
  const blindProps = {
    slot: {
      id: "fixture-blind",
      model: "motorized-blind",
      entitySlots: [],
      placement: { at: [0, 0], elevationMeters: 0, support: { kind: "surface" } },
    },
    visualState: "connected-active",
    reducedMotion: true,
    walkMode: false,
    onInteract() {},
  };

  test("normalizes cover positions without inventing progress or trusting stale attributes", () => {
    for (const [state, expected] of [
      [coverState("open", 35), 35],
      [coverState("closed", 0), 0],
      [coverState("opening", 76), 76],
      [coverState("closing", -5), 0],
      [coverState("open", 120), 100],
      [coverState("open", null, { attributes: {} }), 100],
      [coverState("closed", null), 0],
      [coverState("open", null), 100],
      [coverState("opening", null), null],
      [coverState("closing", "25"), null],
      [coverState("opening", NaN), null],
      [coverState("opening", Infinity), null],
      [coverState("unavailable", 35), null],
      [coverState("unknown", 35), null],
      [coverState("open", 35, { available: false }), null],
      [coverState("open", 35, { stale: true }), null],
      [undefined, null],
    ])
      assert.equal(engine.coverPosition(state), expected);
  });

  test("the closed blind matches its envelope and resized axes with bounded toon geometry", async () => {
    const definition = catalog.stableDeviceRegistry["motorized-blind"];
    for (const scale of [
      [1, 1, 1],
      [0.5, 1.4, 1],
      [2, 0.6, 1],
    ]) {
      const renderer = await create(
        createElement(
          "group",
          { scale },
          createElement(definition.component, { ...blindProps, state: coverState("closed", 0) }),
        ),
      );
      const bounds = new Box3().setFromObject(renderer.scene.instance);
      const size = bounds.getSize(new Vector3()).toArray();
      size.forEach((extent, axis) =>
        assert.ok(Math.abs(extent - definition.defaultSize[axis] * scale[axis]) < 0.001),
      );
      assert.ok(Math.abs(bounds.min.y) < 0.001);
      const meshes = renderer.scene.findAll((node) => node.type === "Mesh");
      assert.ok(meshes.length <= definition.complexity.visibleMeshes);
      let triangles = 0;
      for (const mesh of meshes) {
        assert.equal(mesh.instance.material.type, "MeshToonMaterial");
        triangles +=
          (mesh.instance.geometry.index?.count ??
            mesh.instance.geometry.attributes.position.count) / 3;
      }
      assert.ok(triangles <= definition.complexity.triangles, String(triangles));
      await renderer.unmount();
    }
  });

  test("the blind follows HA positions, freezes on loss, and honors reduced motion", async () => {
    const Component = catalog.MotorizedBlindModel;
    const element = (state, visualState = "connected-active", reducedMotion = true) =>
      createElement(Component, { ...blindProps, state, visualState, reducedMotion });
    const renderer = await create(element(coverState("closed", 0)));
    const rail = () => renderer.scene.findByProps({ name: "blind-bottom-rail" }).instance;
    assert.equal(rail().position.y, 0.02);
    await renderer.update(element(coverState("opening", 50)));
    assert.ok(Math.abs(rail().position.y - 0.74) < 1e-10);
    await renderer.update(element(coverState("open", 100), "connected-active", false));
    await renderer.advanceFrames(1, 0.016);
    assert.ok(rail().position.y > 0.74 && rail().position.y < 1.46);
    const frozen = rail().position.y;
    await renderer.update(element(coverState("unavailable", 0), "unavailable", false));
    await renderer.advanceFrames(20, 0.016);
    assert.equal(rail().position.y, frozen);
    await renderer.update(element(coverState("open", 100)));
    assert.equal(rail().position.y, 1.46);
    assert.equal(renderer.scene.findByProps({ name: "blind-fabric" }).instance.visible, false);
    await renderer.update(element(coverState("closed", 0, { stale: true }), "disconnected"));
    assert.equal(rail().position.y, 1.46);
    await renderer.update(element(coverState("closing", null)));
    assert.equal(rail().position.y, 1.46);
    await renderer.update(element(coverState("closed", 0)));
    assert.equal(rail().position.y, 0.02);
    assert.equal(renderer.scene.findByProps({ name: "blind-fabric" }).instance.visible, true);
    await renderer.unmount();
  });

  test("publishes the stable device definitions with bounded complexity", () => {
    assert.deepEqual(catalog.STABLE_DEVICE_MODEL_IDS, [
      "indoor-ac",
      "washing-machine",
      "tumble-dryer",
      "dishwasher",
      "oven",
      "water-heater",
      "speaker",
      "television",
      "under-cabinet-led-strip",
      "compact-wall-television",
      "wall-television",
      "camera-screen",
      "connected-frame-oak",
      "connected-frame-black",
      "floor-lamp",
      "rattan-bell-pendant",
      "round-globe-wall-lamp",
      "wall-reading-spot",
      "oak-wall-uplight",
      "six-globe-ceiling-lamp",
      "astro-parallel-wall-light",
      "tubular-wall-lamp",
      "clip-reading-lamp",
      "terracotta-pendant",
      "white-dome-pendant",
      "low-garden-lantern",
      "pergola-string-lights",
      "garden-lantern-pole",
      "table-lamp",
      "woven-pendant",
      "children-pendant",
      "wall-switch",
      "opening-contact",
      "thermometer",
      "motion-sensor",
      "motorized-blind",
      "integrated-roller-shutter",
      "leak-sensor",
      "ceiling-fan",
      "table-fan",
      "pedestal-fan",
      "heated-towel-rail",
      "smart-panel-radiator",
      "smart-thermostat",
      "smart-plug",
      "ceiling-light",
      "recessed-downlight",
      "wall-sconce",
      "illuminated-round-mirror",
      "motorized-curtain",
      "video-doorbell",
      "indoor-security-camera",
      "smoke-alarm",
      "carbon-monoxide-alarm",
      "humidity-sensor",
      "air-quality-monitor",
      "energy-monitor",
      "air-purifier",
      "bathroom-extractor-fan",
      "refrigerator",
      "smart-power-strip",
      "humidifier-dehumidifier",
      "robot-vacuum",
      "smart-lock",
      "alarm-keypad",
      "rotating-sprinkler",
      "smart-hose-timer",
      "soil-moisture-sensor",
      "pop-up-sprinkler",
      "motorized-valve",
      "siren",
      "smart-button",
      "built-in-microwave",
      "microwave",
      "coffee-maker",
      "electric-kettle",
      "freezer",
      "pet-feeder",
      "weather-station",
      "compact-car",
      "electric-sedan",
      "pickup-truck",
    ]);
    assert.deepEqual([...validationCore.STABLE_MODELS], catalog.STABLE_DEVICE_MODEL_IDS);
    for (const id of catalog.STABLE_DEVICE_MODEL_IDS) {
      const definition = catalog.getStableDeviceModel(id);
      assert.equal(catalog.isStableDeviceModelId(id), true);
      assert.equal(typeof definition.component, "function");
      assert.ok(
        definition.complexity.visibleMeshes <=
          (["pop-up-sprinkler", "rotating-sprinkler"].includes(id)
            ? 72
            : id === "integrated-roller-shutter"
              ? 35
              : id === "pergola-string-lights"
                ? 17
                : 16),
      );
      assert.ok(
        definition.complexity.triangles <=
          (["compact-car", "electric-sedan", "pickup-truck"].includes(id)
            ? 34_000
            : id === "rattan-bell-pendant"
              ? 40_000
              : id === "pergola-string-lights"
                ? 28_000
                : 5_000),
      );
      assert.ok(definition.bounds.min.every(Number.isFinite));
      assert.ok(definition.bounds.max.every(Number.isFinite));
    }
    assert.equal(catalog.isStableDeviceModelId("not-a-model"), false);
    assert.equal(catalog.airflowWaveState, undefined);
    assert.equal(catalog.createAirflowWaveGeometry, undefined);
  });

  test("resolves device models stable-first without inherited registry keys", () => {
    const stable = Object.create(null);
    const extensions = Object.create({ toString: catalog.stableDeviceRegistry.speaker });
    Object.defineProperty(stable, "__proto__", {
      value: catalog.stableDeviceRegistry.speaker,
      enumerable: true,
    });
    Object.defineProperty(extensions, "__proto__", {
      value: catalog.stableDeviceRegistry.television,
      enumerable: true,
    });
    assert.equal(
      engine.resolveDeviceModelDefinition("__proto__", stable, extensions),
      catalog.stableDeviceRegistry.speaker,
    );
    assert.equal(engine.resolveDeviceModelDefinition("toString", stable, extensions), undefined);
  });

  test("validates device editor metadata at the engine boundary", () => {
    for (const definition of Object.values(catalog.stableDeviceRegistry)) {
      assert.equal(validationCore.isDeviceModelDefinition(definition), true);
    }

    const valid = catalog.stableDeviceRegistry.television;
    assert.equal(
      validationCore.isDeviceModelDefinition({
        ...valid,
        category: "",
      }),
      false,
    );
    assert.equal(
      validationCore.isDeviceModelDefinition({
        ...valid,
        defaultSize: [1, 0, 1],
      }),
      false,
    );
    assert.equal(
      validationCore.isDeviceModelDefinition({
        ...valid,
        preferredPlacement: "unsupported",
      }),
      false,
    );
    assert.equal(
      validationCore.isDeviceModelDefinition({
        ...valid,
        resizePolicy: { kind: "axes", axes: [] },
      }),
      false,
    );
  });

  test("derives the custom airflow mode from the active climate action", () => {
    const climate = (state, hvacAction) => ({
      state,
      attributes: hvacAction ? { hvac_action: hvacAction } : {},
    });

    assert.equal(catalog.deriveClimateAirflowMode?.(climate("cool")), "cool");
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("heat")), "heat");
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("auto", "cooling")), "cool");
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("auto", "heating")), "heat");
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("dry")), "dry");
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("fan_only")), "fan");
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("heat_cool")), "auto");
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("off")), null);
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("idle")), null);
    assert.equal(catalog.deriveClimateAirflowMode?.(climate("unavailable")), null);
  });

  test("keeps the ported camera-screen geometry and reduced-motion pose", () => {
    assert.equal(catalog.CAMERA_SCREEN_WIDTH, 0.9);
    assert.equal(catalog.CAMERA_SCREEN_HEIGHT, 0.54);
    assert.equal(catalog.CAMERA_SCREEN_DEPTH, 0.012);
    assert.equal(catalog.CAMERA_SCREEN_FLOAT_GAP, 0.04);
    assert.equal(catalog.CAMERA_SCREEN_VISUAL_WIDTH, 0.98);
    assert.equal(catalog.CAMERA_SCREEN_VERTICAL_AMPLITUDE, 0.006);
    assert.equal(catalog.CAMERA_SCREEN_NORMAL_AMPLITUDE, 0.002);
    assert.equal(catalog.CAMERA_SCREEN_FLOAT_CYCLE_SECONDS, 5.6);
    assert.equal(catalog.CAMERA_SCREEN_ANIMATION_FPS, 12);
    assert.equal(catalog.CAMERA_SCREEN_GLASS_OPACITY, 0.035);
    assert.equal(catalog.CAMERA_SCREEN_VIDEO_OPACITY, 0.96);
    assert.deepEqual(catalog.cameraScreenPose(42, true), {
      verticalOffset: 0,
      normalOffset: 0,
      glowPulse: 0.5,
    });
    const moving = catalog.cameraScreenPose(1.4, false);
    assert.equal(moving.verticalOffset, 0.006);
    assert.ok(Math.abs(moving.normalOffset) < 1e-12);
  });

  test("television displays camera media while preserving its media-player fallback", async () => {
    const definition = catalog.stableDeviceRegistry.television;
    assert.deepEqual(definition.supportedDomains, ["camera", "media_player", "switch"]);
    assert.equal(definition.liveMedia.kind, "camera-stream");
    assert.equal(definition.interaction.target, "camera-viewer");
    const props = { ...blindProps, visualState: "connected-active" };
    const renderer = await create(createElement(definition.component, props));
    assert.equal(renderer.scene.findAllByProps({ name: "camera-screen-live-surface" }).length, 0);
    await renderer.update(
      createElement(definition.component, {
        ...props,
        liveMedia: {
          kind: "camera-stream",
          video: null,
          posterUrl: null,
          state: "connecting",
          transport: null,
          previewState: "poster",
          error: null,
        },
      }),
    );
    assert.equal(renderer.scene.findAllByProps({ name: "television-picture" }).length, 0);
    const surface = renderer.scene.findByProps({ name: "camera-screen-live-surface" });
    assert.equal(surface.instance.geometry.parameters.width, 1.405);
    assert.equal(surface.instance.geometry.parameters.height, 0.675);
    assert.equal(surface.instance.material.opacity, 1);
    await renderer.update(createElement(definition.component, props));
    assert.equal(renderer.scene.findAllByProps({ name: "camera-screen-live-surface" }).length, 0);
    await renderer.unmount();
  });

  test("large wall television has a full screen and no stand within its declared envelope", async () => {
    const definition = catalog.stableDeviceRegistry["wall-television"];
    const renderer = await create(
      createElement(definition.component, {
        ...blindProps,
        visualState: "connected-active",
      }),
    );
    const bounds = new Box3().setFromObject(renderer.scene.instance);
    const extent = bounds.getSize(new Vector3()).toArray();
    extent.forEach((value, axis) =>
      assert.ok(Math.abs(value - definition.defaultSize[axis]) < 0.001),
    );
    assert.equal(renderer.scene.findAllByProps({ name: "catalog-wall-television" }).length, 1);
    const shell = renderer.scene.findByProps({ name: "wall-television-shell" }).instance;
    const screen = renderer.scene.findByProps({ name: "wall-television-screen" }).instance;
    assert.ok(
      screen.position.z - screen.geometry.parameters.depth / 2 >
        shell.position.z + shell.geometry.parameters.depth / 2,
    );
    assert.equal(renderer.scene.findAllByProps({ name: "catalog-television" }).length, 0);
    await renderer.unmount();
  });

  test("publishes both connected-frame finishes with camera media geometry", async () => {
    assert.deepEqual(catalog.CONNECTED_FRAME_SIZE, [0.72, 0.52, 0.045]);
    const colors = [];
    for (const id of ["connected-frame-oak", "connected-frame-black"]) {
      const definition = catalog.stableDeviceRegistry[id];
      assert.deepEqual(definition.supportedDomains, ["camera"]);
      assert.equal(definition.liveMedia.kind, "camera-stream");
      assert.equal(definition.interaction.target, "camera-viewer");
      const renderer = await create(
        createElement(definition.component, {
          slot: {
            id: `fixture-${id}`,
            model: id,
            entitySlots: [],
            placement: {
              at: [0, 0],
              elevationMeters: 0,
              support: { kind: "surface" },
            },
          },
          visualState: "disconnected",
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
        }),
      );
      const bounds = new Box3().setFromObject(renderer.scene.instance);
      const size = bounds.getSize(new Vector3()).toArray();
      size.forEach((extent, axis) =>
        assert.ok(Math.abs(extent - definition.defaultSize[axis]) < 0.001),
      );
      const meshes = renderer.scene.findAll((node) => node.type === "Mesh");
      assert.ok(meshes.length <= definition.complexity.visibleMeshes);
      for (const mesh of meshes) assert.equal(mesh.instance.material.type, "MeshToonMaterial");
      colors.push(
        renderer.scene
          .findByProps({ name: "connected-frame-top-rail" })
          .instance.material.color.getHexString(),
      );
      await renderer.unmount();
    }
    assert.notEqual(colors[0], colors[1]);
  });

  test("keeps the exact custom airflow travel, spread, speed, and fade", () => {
    assert.equal(typeof airflow.airflowWaveState, "function");
    const wave = airflow.airflowWaveState(0.5, 2);
    const assertTupleClose = (actual, expected) => {
      assert.equal(actual.length, expected.length);
      actual.forEach((value, index) => {
        assert.ok(Math.abs(value - expected[index]) < 1e-12);
      });
    };

    assert.equal(wave.progress, 0.61);
    assertTupleClose(wave.position, [0, -0.4623, 0.7002]);
    assertTupleClose(wave.scale, [0.9996, 1, 1]);
    assert.ok(Math.abs(wave.opacity - 0.8550693844052114) < 1e-12);
  });

  test("keeps the exact custom airflow curve and tube geometry", () => {
    assert.equal(typeof airflow.createAirflowWaveGeometry, "function");
    const geometry = airflow.createAirflowWaveGeometry(0.84);
    const assertPointClose = (index, expected) => {
      const actual = geometry.parameters.path.points[index].toArray();
      actual.forEach((value, coordinate) => {
        assert.ok(Math.abs(value - expected[coordinate]) < 1e-12);
      });
    };
    try {
      assert.equal(geometry.parameters.tubularSegments, 48);
      assert.equal(geometry.parameters.radius, 0.014);
      assert.equal(geometry.parameters.radialSegments, 6);
      assert.equal(geometry.parameters.closed, false);
      assert.equal(geometry.parameters.path.points.length, 25);
      assertPointClose(0, [-0.2856, 0, 0]);
      assertPointClose(3, [-0.2142, 0.035, 0]);
      assertPointClose(24, [0.2856, 0, 0]);
    } finally {
      geometry.dispose();
    }
  });

  test("renders the five custom airflow waves with heat and cool palettes", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    const binding = room.devices.find((device) => device.model === "indoor-ac");
    const definition = catalog.stableDeviceRegistry["indoor-ac"];
    const coolState = fixtures.fixtureCatalogStates["climate.fixture_ac"];
    const cases = [
      {
        mode: "cool",
        state: coolState,
        color: "58c8ff",
        emissive: "147fc4",
      },
      {
        mode: "heat",
        state: {
          ...coolState,
          state: "auto",
          attributes: { ...coolState.attributes, hvac_action: "heating" },
        },
        color: "ff6d58",
        emissive: "b82f24",
      },
    ];

    for (const scenario of cases) {
      const renderer = await create(
        createElement(definition.component, {
          slot: binding,
          state: scenario.state,
          visualState: "connected-active",
          reducedMotion: false,
          walkMode: false,
          onInteract: () => undefined,
        }),
      );
      const groups = renderer.scene.findAll((node) =>
        node.props.name?.startsWith("flux-climatisation-"),
      );
      assert.equal(groups.length, 1);
      assert.equal(groups[0].props.name, `flux-climatisation-${scenario.mode}`);

      const waves = groups[0].children.filter((node) => node.type === "Mesh");
      assert.equal(waves.length, 5);
      for (const wave of waves) {
        assert.equal(wave.instance.geometry.type, "TubeGeometry");
        assert.equal(wave.instance.material.color.getHexString(), scenario.color);
        assert.equal(wave.instance.material.emissive.getHexString(), scenario.emissive);
        assert.equal(wave.instance.material.emissiveIntensity, 0.75);
        assert.equal(wave.instance.material.transparent, true);
        assert.equal(wave.instance.material.opacity, 0.8);
        assert.equal(wave.instance.material.depthWrite, false);
      }
      await renderer.unmount();
    }
  });

  test("hides AC airflow unless the climate entity is actively running", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    const binding = room.devices.find((device) => device.model === "indoor-ac");
    const definition = catalog.stableDeviceRegistry["indoor-ac"];
    const coolState = fixtures.fixtureCatalogStates["climate.fixture_ac"];
    const cases = [
      { state: { ...coolState, state: "off" }, visualState: "connected-inactive" },
      { state: { ...coolState, state: "unavailable" }, visualState: "unavailable" },
      { state: undefined, visualState: "disconnected" },
    ];

    for (const scenario of cases) {
      const renderer = await create(
        createElement(definition.component, {
          slot: binding,
          state: scenario.state,
          visualState: scenario.visualState,
          reducedMotion: false,
          walkMode: false,
          onInteract: () => undefined,
        }),
      );
      assert.equal(
        renderer.scene.findAll((node) => node.props.name?.startsWith("flux-climatisation-")).length,
        0,
      );
      await renderer.unmount();
    }
  });

  test("scales catalog light emitters from HA brightness and turns them off with HA", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    const cases = [
      ["floor-lamp", "floor-lamp-emitter", 0.65],
      ["terracotta-pendant", "terracotta-pendant-emitter", 0.9],
      ["rattan-bell-pendant", "opal-bulb", 0.18, "terracotta-pendant"],
    ];
    for (const [model, emitterName, maximumIntensity, fixtureModel = model] of cases) {
      const binding = room.devices.find((device) => device.model === fixtureModel);
      const definition = catalog.stableDeviceRegistry[model];
      const baseState =
        fixtures.fixtureCatalogStates[
          fixtures.equippedFixtureProfile.entityIdsBySlotId[binding.entitySlots[0].id]
        ];
      for (const scenario of [
        {
          state: { ...baseState, attributes: { ...baseState.attributes, brightness: 128 } },
          expected: (maximumIntensity * 128) / 255,
        },
        { state: { ...baseState, state: "off" }, expected: 0 },
        ...(model === "rattan-bell-pendant"
          ? [
              { state: baseState, visualState: "unavailable", expected: 0 },
              { state: baseState, visualState: "disconnected", expected: 0 },
            ]
          : []),
      ]) {
        const renderer = await create(
          createElement(definition.component, {
            slot: binding,
            state: scenario.state,
            visualState:
              scenario.visualState ??
              (scenario.state.state === "on" ? "connected-active" : "connected-inactive"),
            reducedMotion: true,
            walkMode: false,
            onInteract: () => undefined,
          }),
        );
        const emitter = renderer.scene.findByProps({ name: emitterName });
        assert.ok(
          Math.abs(emitter.instance.material.emissiveIntensity - scenario.expected) < 1e-12,
        );
        await renderer.unmount();
      }
    }
  });

  test("rattan pendant light sits in the broad shade chamber with restrained output", async () => {
    const definition = catalog.stableDeviceRegistry["rattan-bell-pendant"];
    const renderer = await create(
      createElement(definition.component, {
        visualState: "connected-active",
        state: { entityId: "light.test", state: "on", attributes: { brightness: 255 } },
      }),
    );
    const bulb = renderer.scene.findByProps({ name: "opal-bulb" }).instance;
    renderer.scene.instance.updateMatrixWorld(true);
    assert.deepEqual(
      definition.sceneLight.position,
      bulb.getWorldPosition(new Vector3()).toArray(),
    );
    assert.ok(
      bulb.position.y >= 0.18 && bulb.position.y <= 0.25,
      "bulb must sit below the narrow shoulder",
    );
    assert.ok(
      definition.sceneLight.maxIntensity <= 0.5,
      "woven shade must not be flooded by a high-intensity source",
    );
    assert.ok(bulb.material.emissiveIntensity <= 0.2, "bulb glow stays restrained");
    const socket = renderer.scene.findByProps({ name: "bulb-socket" }).instance;
    const socketBounds = new Box3().setFromObject(socket);
    const bulbBounds = new Box3().setFromObject(bulb);
    assert.ok(socketBounds.intersectsBox(bulbBounds), "lowered bulb stays connected to its socket");
    await renderer.unmount();
  });

  test("keeps physical HA light sources engine-owned and powered-off sources at zero intensity", async () => {
    const runtime = {
      ...fixtures.connectedCatalogRuntime,
      entityStates: {
        ...fixtures.connectedCatalogRuntime.entityStates,
        "light.fixture_floor_lamp": {
          ...fixtures.connectedCatalogRuntime.entityStates["light.fixture_floor_lamp"],
          attributes: { brightness: 128, rgb_color: [255, 64, 32] },
        },
        "light.fixture_terracotta_pendant": {
          ...fixtures.connectedCatalogRuntime.entityStates["light.fixture_terracotta_pendant"],
          state: "off",
        },
      },
    };
    const resolveLighting = (snapshot) =>
      engine.resolveHomeAssistantBindings(
        fixtures.equippedFixtureManifest,
        fixtures.equippedFixtureProfile,
        snapshot,
        catalog.stableDeviceRegistry,
      );
    const render = (snapshot) =>
      createElement(engine.HomeAssistantSceneLighting, {
        floor: fixtures.equippedFixtureManifest.floors[0],
        resolvedBindings: resolveLighting(snapshot),
        deviceModels: catalog.stableDeviceRegistry,
        extensionDeviceModels: {},
        sceneItems: [],
      });
    const renderer = await create(
      render({
        ...runtime,
        entityStates: {
          ...runtime.entityStates,
          "light.fixture_terracotta_pendant": {
            ...runtime.entityStates["light.fixture_terracotta_pendant"],
            state: "on",
          },
        },
      }),
    );
    const pendant = renderer.scene.findByProps({
      name: "ha-device-light-fixture-terracotta-pendant",
    }).instance;
    await renderer.update(render(runtime));
    const floorLamp = renderer.scene.findByProps({
      name: "ha-device-light-fixture-floor-lamp",
    });
    assert.ok(Math.abs(floorLamp.instance.intensity - (5 * 128) / 255) < 1e-12);
    assert.equal(floorLamp.instance.color.getHexString(), "ff4020");
    assert.equal(floorLamp.instance.castShadow, false);
    assert.equal(
      renderer.scene.findByProps({
        name: "ha-device-light-fixture-terracotta-pendant",
      }).instance.intensity,
      0,
    );
    assert.equal(
      renderer.scene.findByProps({ name: "ha-device-light-fixture-terracotta-pendant" }).instance,
      pendant,
    );
    await renderer.unmount();
  });

  test("keeps a static airflow cue when reduced motion is enabled", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    const binding = room.devices.find((device) => device.model === "indoor-ac");
    const definition = catalog.stableDeviceRegistry["indoor-ac"];
    const renderer = await create(
      createElement(definition.component, {
        slot: binding,
        state: fixtures.fixtureCatalogStates["climate.fixture_ac"],
        visualState: "connected-active",
        reducedMotion: true,
        walkMode: false,
        onInteract: () => undefined,
      }),
    );
    const groups = renderer.scene.findAll((node) => node.props.name === "flux-climatisation-cool");
    assert.equal(groups.length, 1);

    const waves = groups[0].children.filter((node) => node.type === "Mesh");
    assert.equal(waves.length, 5);
    const before = waves.map((wave) => wave.instance.position.toArray());
    assert.equal(new Set(before.map((position) => position.join(","))).size, 5);
    await renderer.advanceFrames(3, 1 / 60);
    assert.deepEqual(
      waves.map((wave) => wave.instance.position.toArray()),
      before,
    );
    await renderer.unmount();
  });

  test("disposes the AC airflow geometry when the effect unmounts", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    const binding = room.devices.find((device) => device.model === "indoor-ac");
    const definition = catalog.stableDeviceRegistry["indoor-ac"];
    const renderer = await create(
      createElement(definition.component, {
        slot: binding,
        state: fixtures.fixtureCatalogStates["climate.fixture_ac"],
        visualState: "connected-active",
        reducedMotion: false,
        walkMode: false,
        onInteract: () => undefined,
      }),
    );
    const waves = renderer.scene.findAll(
      (node) => node.parent?.props.name === "flux-climatisation-cool",
    );
    assert.equal(waves.length, 5);
    let disposeEvents = 0;
    waves[0].instance.geometry.addEventListener("dispose", () => {
      disposeEvents += 1;
    });

    await renderer.unmount();

    assert.equal(disposeEvents, 1);
  });

  test("new connected-home presets match declared envelopes and toon budgets", async () => {
    for (const id of addedDeviceIds) {
      const definition = catalog.stableDeviceRegistry[id];
      const slot = {
        id: `fixture-${id}`,
        model: id,
        entitySlots: [
          {
            id: `fixture-${id}-primary`,
            compatibleDomains: definition.supportedDomains,
            required: true,
            autoMap: "manual",
            deviceRole: "primary",
            presentation: { label: definition.label, dashboardRole: "primary" },
          },
        ],
        placement: { at: [2, 2], elevationMeters: 0, support: { kind: "surface" } },
      };
      const renderer = await create(
        createElement(definition.component, {
          slot,
          visualState: "disconnected",
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
        }),
      );
      const bounds = new Box3().setFromObject(renderer.scene.instance, true);
      for (const edge of ["min", "max"])
        bounds[edge].toArray().forEach((value, axis) => {
          assert.ok(
            Math.abs(value - definition.bounds[edge][axis]) <= 0.001,
            `${id} ${edge}[${axis}] ${value} != ${definition.bounds[edge][axis]}`,
          );
        });
      definition.defaultSize.forEach((size, axis) =>
        assert.ok(
          Math.abs(size - (definition.bounds.max[axis] - definition.bounds.min[axis])) <= 0.001,
          `${id} size[${axis}]`,
        ),
      );
      const meshes = renderer.scene.findAll((node) => node.type === "Mesh");
      assert.ok(
        meshes.length <= definition.complexity.visibleMeshes,
        `${id}: ${meshes.length} > ${definition.complexity.visibleMeshes} meshes`,
      );
      let triangles = 0;
      for (const mesh of meshes) {
        assert.equal(mesh.instance.material.type, "MeshToonMaterial", id);
        triangles +=
          (mesh.instance.geometry.index?.count ??
            mesh.instance.geometry.attributes.position.count) / 3;
      }
      assert.ok(
        triangles <= definition.complexity.triangles,
        `${id}: ${triangles} > ${definition.complexity.triangles} triangles`,
      );
      assert.equal(renderer.scene.findAll((node) => node.instance.isLight).length, 0);
      await renderer.unmount();
    }
  });

  test("vehicle bodywork leaves wheel wells open and glazing exposed in every connection state", async () => {
    for (const [id, tireRadius, axles, belt] of [
      ["compact-car", 0.3, [-1.26, 1.25], 0.94],
      ["electric-sedan", 0.33, [-1.48, 1.43], 0.905],
      ["pickup-truck", 0.4, [-1.75, 1.75], 1.13],
    ])
      for (const visualState of [
        "connected-active",
        "connected-inactive",
        "disconnected",
        "unavailable",
      ]) {
        const definition = catalog.stableDeviceRegistry[id];
        const renderer = await create(
          createElement(definition.component, {
            visualState,
            reducedMotion: true,
            walkMode: false,
            onInteract() {},
          }),
        );
        renderer.scene.instance.updateMatrixWorld(true);
        const meshes = renderer.scene
          .findAll((node) => node.type === "Mesh")
          .map((node) => node.instance);
        const body = meshes.filter((mesh) => mesh.name.includes("-body-finish-"));
        for (const z of axles) {
          const ray = new Raycaster(new Vector3(3, tireRadius, z), new Vector3(-1, 0, 0));
          assert.equal(
            ray.intersectObjects(body, false).length,
            0,
            `${id}: painted body fills a wheel well`,
          );
        }
        for (const direction of [-1, 1]) {
          const ray = new Raycaster(
            new Vector3(0, belt + 0.3, direction * 4),
            new Vector3(0, 0, -direction),
          );
          const hit = ray.intersectObjects(body, false)[0];
          assert.equal(
            hit?.object.material.color.getHexString(),
            "496874",
            `${id}: glass is buried in painted bodywork`,
          );
        }
        if (id === "electric-sedan") {
          const roofHits = new Raycaster(
            new Vector3(0, 3, -0.2),
            new Vector3(0, -1, 0),
          ).intersectObjects(body, false);
          const glass = roofHits.find(
            (hit) => hit.object.material.color.getHexString() === "496874",
          );
          const paint = roofHits.find(
            (hit) => hit.object.material.color.getHexString() === "e1e5e0",
          );
          assert.ok(glass && paint, "roof glazing and backing must both exist");
          for (const position of [
            [24, 24, 35],
            [31, 25, 35],
            [21, 12, 23],
          ]) {
            const camera = new PerspectiveCamera(38, 16 / 9, 0.06, 250);
            camera.position.set(...position);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();
            const depthGap =
              (paint.point.clone().project(camera).z - glass.point.clone().project(camera).z) / 2;
            assert.ok(
              depthGap > 1 / 2 ** 24,
              "roof layers must resolve separately in a 24-bit overview depth buffer",
            );
          }
        }
        assert.ok(
          meshes.length <= definition.complexity.visibleMeshes,
          `${id} ${visualState}: mesh budget`,
        );
        const triangles = meshes.reduce(
          (count, mesh) =>
            count + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3,
          0,
        );
        assert.ok(
          triangles <= definition.complexity.triangles,
          `${id} ${visualState}: triangle budget`,
        );
        const bounds = new Box3().setFromObject(renderer.scene.instance, true);
        for (const edge of ["min", "max"])
          bounds[edge].toArray().forEach((value, axis) => {
            assert.ok(
              Math.abs(value - definition.bounds[edge][axis]) <= 0.001,
              `${id} ${visualState}: ${edge}[${axis}]`,
            );
          });
        await renderer.unmount();
      }
  });

  test("fan geometry matches placement bounds and declared toon complexity in every state", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    for (const id of ["ceiling-fan", "table-fan", "pedestal-fan"]) {
      const definition = catalog.stableDeviceRegistry[id];
      const binding = room.devices.find((device) => device.model === id);
      assert.deepEqual(definition.supportedDomains, ["fan"]);
      for (const visualState of [
        "disconnected",
        "unavailable",
        "connected-inactive",
        "connected-active",
      ]) {
        const renderer = await create(
          createElement(definition.component, {
            slot: binding,
            visualState,
            reducedMotion: true,
            walkMode: false,
            onInteract() {},
            state:
              fixtures.fixtureCatalogStates[
                fixtures.equippedFixtureProfile.entityIdsBySlotId[binding.entitySlots[0].id]
              ],
          }),
        );
        // Airflow is an effect outside the physical placement/collision envelope.
        const body =
          id === "ceiling-fan"
            ? renderer.scene.instance
            : renderer.scene.findByProps({ name: "fan-body" }).instance;
        const bounds = new Box3().setFromObject(body, true);
        for (const edge of ["min", "max"])
          bounds[edge].toArray().forEach((value, axis) => {
            assert.ok(
              Math.abs(value - definition.bounds[edge][axis]) < 0.001,
              `${id}/${visualState} ${edge}[${axis}]: ${value}`,
            );
          });
        definition.defaultSize.forEach((size, axis) =>
          assert.ok(
            Math.abs(size - (definition.bounds.max[axis] - definition.bounds.min[axis])) < 0.001,
          ),
        );
        const meshes = renderer.scene.findAll((node) => node.type === "Mesh");
        assert.ok(
          meshes.length <= definition.complexity.visibleMeshes,
          `${id}: ${meshes.length} meshes`,
        );
        let triangles = 0;
        for (const mesh of meshes) {
          assert.equal(mesh.instance.material.type, "MeshToonMaterial");
          const geometry = mesh.instance.geometry;
          triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
        }
        assert.ok(triangles <= definition.complexity.triangles, `${id}: ${triangles} triangles`);
        assert.equal(
          renderer.scene.findAll((node) => node.props.name?.startsWith("fan-blade-")).length,
          id === "ceiling-fan" ? 4 : 3,
        );
        assert.equal(renderer.scene.findAll((node) => node.instance.isLight).length, 0);
        assert.equal(body.userData?.walkCollider, id === "ceiling-fan" ? undefined : true);
        await renderer.unmount();
      }
    }
  });

  test("fan rotors follow HA speed and stop when off, disconnected, unavailable or motion is reduced", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    for (const id of ["ceiling-fan", "table-fan", "pedestal-fan"]) {
      const definition = catalog.stableDeviceRegistry[id];
      const binding = room.devices.find((device) => device.model === id);
      const baseState =
        fixtures.fixtureCatalogStates[
          fixtures.equippedFixtureProfile.entityIdsBySlotId[binding.entitySlots[0].id]
        ];
      const props = {
        slot: binding,
        visualState: "connected-active",
        reducedMotion: false,
        walkMode: false,
        onInteract() {},
      };
      const snapshot = (percentage, state = "on") => ({
        ...baseState,
        state,
        attributes: { ...baseState.attributes, percentage },
      });
      const renderer = await create(
        createElement(definition.component, { ...props, state: snapshot(25) }),
      );
      const rotor = renderer.scene.findByProps({ name: "fan-rotor" }).instance;
      await renderer.advanceFrames(1, 0.02);
      const slow = Math.abs(rotor.rotation.z);
      assert.ok(slow > 0);
      await renderer.update(
        createElement(definition.component, { ...props, state: snapshot(100) }),
      );
      const beforeFast = rotor.rotation.z;
      await renderer.advanceFrames(1, 0.02);
      assert.ok(Math.abs(Math.abs(rotor.rotation.z - beforeFast) - slow * 4) < 1e-6);
      for (const scenario of [
        { state: snapshot(0) },
        { state: snapshot(50, "off"), visualState: "connected-inactive" },
        { state: snapshot(50), visualState: "unavailable" },
        { state: undefined, visualState: "disconnected" },
        { state: snapshot(50), reducedMotion: true },
      ]) {
        await renderer.update(createElement(definition.component, { ...props, ...scenario }));
        const stoppedAt = rotor.rotation.z;
        await renderer.advanceFrames(2, 0.02);
        assert.equal(rotor.rotation.z, stoppedAt, `${id}: ${JSON.stringify(scenario)}`);
      }
      await renderer.unmount();
    }
  });

  test("portable fans project the AC cold waves forward only while producing airflow", async () => {
    const room = fixtures.equippedFixtureManifest.floors[0].rooms[0];
    for (const id of ["ceiling-fan", "table-fan", "pedestal-fan"]) {
      const definition = catalog.stableDeviceRegistry[id];
      const slot = room.devices.find((device) => device.model === id);
      const state =
        fixtures.fixtureCatalogStates[
          fixtures.equippedFixtureProfile.entityIdsBySlotId[slot.entitySlots[0].id]
        ];
      const props = {
        slot,
        state,
        visualState: "connected-active",
        reducedMotion: false,
        walkMode: false,
        onInteract() {},
      };
      const renderer = await create(createElement(definition.component, props));
      const effects = renderer.scene.findAll((node) => node.props.name === "fan-airflow-waves");
      assert.equal(effects.length, id === "ceiling-fan" ? 0 : 1);
      if (id === "ceiling-fan") {
        await renderer.unmount();
        continue;
      }
      const waves = effects[0].children.filter((node) => node.type === "Mesh");
      assert.equal(waves.length, 5);
      for (const wave of waves) {
        assert.equal(wave.instance.material.color.getHexString(), "58c8ff");
        assert.equal(wave.instance.material.emissive.getHexString(), "147fc4");
        assert.equal(wave.instance.material.depthWrite, false);
        assert.equal(wave.instance.position.y, 0);
        assert.ok(wave.instance.position.z > 0.16);
      }
      const initial = waves.map((wave) => wave.instance.position.toArray());
      await renderer.advanceFrames(1, 0.02);
      assert.notDeepEqual(
        waves.map((wave) => wave.instance.position.toArray()),
        initial,
      );
      await renderer.update(createElement(definition.component, { ...props, reducedMotion: true }));
      const reduced = waves.map((wave) => wave.instance.position.toArray());
      await renderer.advanceFrames(2, 0.02);
      assert.deepEqual(
        waves.map((wave) => wave.instance.position.toArray()),
        reduced,
      );
      let disposed = 0;
      waves[0].instance.geometry.addEventListener("dispose", () => disposed++);
      for (const scenario of [
        { visualState: "connected-inactive", state: { ...state, state: "off" } },
        { visualState: "unavailable" },
        { visualState: "disconnected", state: undefined },
        { state: { ...state, attributes: { percentage: 0 } } },
      ]) {
        await renderer.update(createElement(definition.component, { ...props, ...scenario }));
        assert.equal(renderer.scene.findAll((node) => node.props.name === "fan-airflow").length, 0);
      }
      assert.equal(disposed, 1);
      await renderer.unmount();
    }
  });

  test("applies the single floor transform, elevation, rotation, and uniform scale", () => {
    const binding = {
      ...fixtures.equippedFixtureManifest.floors[0].rooms[0].devices[1],
      placement: {
        at: [5, 7],
        elevationMeters: 1.2,
        rotationYRadians: 0.4,
        scale: 2,
        support: { kind: "surface" },
      },
    };
    assert.deepEqual(
      engine.deviceWorldTransform(binding, {
        origin: [1, 2],
        metersPerPlanUnit: 0.5,
        scaleBasis: "measured",
      }),
      {
        position: [2, 1.2, 2.5],
        rotationYRadians: 0.4,
        scale: 2,
      },
    );
  });

  test("routes a 3D device tap through its exact active-profile slot and entity", async () => {
    const targets = [];
    const resolvedBindings = engine.resolveHomeAssistantBindings(
      fixtures.equippedFixtureManifest,
      fixtures.equippedFixtureProfile,
      fixtures.connectedCatalogRuntime,
      catalog.stableDeviceRegistry,
    );
    const renderer = await create(
      createElement(engine.ArchitectureScene, {
        manifest: fixtures.equippedFixtureManifest,
        selectedRoomId: "fixture-studio",
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings,
        architectureModels: architectureCatalog.stableArchitectureModelRegistry,
        deviceModels: catalog.stableDeviceRegistry,
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: (target) => targets.push(target),
      }),
    );
    const device = renderer.scene.findByProps({ name: "device-fixture-speaker" });
    const pointer = {
      pointerId: 4,
      nativeEvent: { clientX: 100, clientY: 100 },
    };
    await renderer.fireEvent(device, "pointerDown", pointer);
    await renderer.fireEvent(device, "pointerUp", pointer);
    assert.deepEqual(targets, [
      {
        id: "fixture-speaker",
        label: "Speaker",
        slotId: "fixture-speaker-entity",
      },
    ]);
    await renderer.unmount();
  });

  test("routes a camera-screen tap directly to the live viewer intent", async () => {
    const targets = [];
    const resolvedBindings = engine.resolveHomeAssistantBindings(
      fixtures.equippedFixtureManifest,
      fixtures.equippedFixtureProfile,
      fixtures.connectedCatalogRuntime,
      catalog.stableDeviceRegistry,
    );
    const renderer = await create(
      createElement(engine.ArchitectureScene, {
        manifest: fixtures.equippedFixtureManifest,
        selectedRoomId: "fixture-studio",
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings,
        architectureModels: architectureCatalog.stableArchitectureModelRegistry,
        deviceModels: catalog.stableDeviceRegistry,
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: (target) => targets.push(target),
      }),
    );
    const device = renderer.scene.findByProps({ name: "device-fixture-camera-screen" });
    const pointer = { pointerId: 5, nativeEvent: { clientX: 80, clientY: 80 } };
    await renderer.fireEvent(device, "pointerDown", pointer);
    await renderer.fireEvent(device, "pointerUp", pointer);
    assert.deepEqual(targets, [
      {
        id: "fixture-camera-screen",
        label: "Studio camera",
        slotId: "fixture-camera-entity",
        intent: "camera-viewer",
      },
    ]);
    await renderer.unmount();
  });

  test("subtly brightens device colours on hover and restores them on pointer exit", async () => {
    const resolvedBindings = engine.resolveHomeAssistantBindings(
      fixtures.equippedFixtureManifest,
      fixtures.equippedFixtureProfile,
      fixtures.connectedCatalogRuntime,
      catalog.stableDeviceRegistry,
    );
    const renderer = await create(
      createElement(engine.ArchitectureScene, {
        manifest: fixtures.equippedFixtureManifest,
        selectedRoomId: "fixture-studio",
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings,
        architectureModels: architectureCatalog.stableArchitectureModelRegistry,
        deviceModels: catalog.stableDeviceRegistry,
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: () => undefined,
      }),
    );
    const device = renderer.scene.findByProps({ name: "device-fixture-speaker" });
    const materials = [];
    device.instance.traverse((object) => {
      if (object.isMesh && object.material?.isMeshToonMaterial) materials.push(object.material);
    });
    assert.ok(materials.length > 0);
    const originalColors = materials.map((material) => material.color.clone());

    const originalDocument = globalThis.document;
    globalThis.document = { body: { style: { cursor: "crosshair" } } };
    try {
      await renderer.fireEvent(device, "pointerOver");
      assert.ok(materials.some((material, index) => !material.color.equals(originalColors[index])));
      assert.equal(
        renderer.scene.findAllByProps({ name: "device-hover-outline-fixture-speaker" }).length,
        0,
      );
      assert.equal(globalThis.document.body.style.cursor, "pointer");

      await renderer.fireEvent(device, "pointerOut");
      materials.forEach((material, index) =>
        assert.ok(material.color.equals(originalColors[index])),
      );
      assert.equal(globalThis.document.body.style.cursor, "crosshair");
    } finally {
      await renderer.unmount();
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
  });

  test("shows room pointer affordance and cancels a dragged press", async () => {
    const resolvedBindings = engine.resolveHomeAssistantBindings(
      fixtures.equippedFixtureManifest,
      fixtures.equippedFixtureProfile,
      fixtures.connectedCatalogRuntime,
      catalog.stableDeviceRegistry,
    );
    const selected = [];
    const renderer = await create(
      createElement(engine.ArchitectureScene, {
        manifest: fixtures.equippedFixtureManifest,
        selectedRoomId: null,
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings,
        architectureModels: architectureCatalog.stableArchitectureModelRegistry,
        deviceModels: catalog.stableDeviceRegistry,
        openingPositions: {},
        onSelectRoom: (roomId) => selected.push(roomId),
        onInteract: () => undefined,
      }),
    );
    const room = renderer.scene.findByProps({ name: "room-fixture-studio" });
    const originalDocument = globalThis.document;
    globalThis.document = { body: { style: { cursor: "crosshair" } } };
    try {
      await renderer.fireEvent(room, "pointerOver", { stopPropagation() {} });
      assert.equal(globalThis.document.body.style.cursor, "pointer");
      assert.equal(
        renderer.scene.findByProps({ name: "room-fixture-studio-interaction" }).props.visible,
        true,
      );
      const pointer = {
        pointerId: 9,
        nativeEvent: { clientX: 20, clientY: 20 },
        stopPropagation() {},
      };
      await renderer.fireEvent(room, "pointerDown", pointer);
      assert.equal(
        renderer.scene.findByProps({ name: "room-fixture-studio-interaction" }).instance.material
          .opacity,
        0.28,
      );
      await renderer.fireEvent(room, "pointerMove", {
        ...pointer,
        nativeEvent: { clientX: 50, clientY: 20 },
      });
      await renderer.fireEvent(room, "pointerUp", {
        ...pointer,
        nativeEvent: { clientX: 50, clientY: 20 },
      });
      assert.deepEqual(selected, []);

      await renderer.fireEvent(room, "pointerDown", pointer);
      await renderer.fireEvent(room, "pointerUp", pointer);
      assert.deepEqual(selected, ["fixture-studio"]);
      await renderer.fireEvent(room, "pointerOut", { stopPropagation() {} });
      assert.equal(globalThis.document.body.style.cursor, "crosshair");
    } finally {
      await renderer.unmount();
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
  });

  test("keeps selected-room feedback visible and removes room handlers in walk mode", async () => {
    const resolvedBindings = engine.resolveHomeAssistantBindings(
      fixtures.equippedFixtureManifest,
      fixtures.equippedFixtureProfile,
      fixtures.connectedCatalogRuntime,
      catalog.stableDeviceRegistry,
    );
    const render = (selectedRoomId, walkMode) =>
      create(
        createElement(engine.ArchitectureScene, {
          manifest: fixtures.equippedFixtureManifest,
          selectedRoomId,
          walkMode,
          wallFadeEnabled: false,
          reducedMotion: true,
          resolvedBindings,
          architectureModels: architectureCatalog.stableArchitectureModelRegistry,
          deviceModels: catalog.stableDeviceRegistry,
          openingPositions: {},
          onSelectRoom: () => undefined,
          onInteract: () => undefined,
        }),
      );

    const selected = await render("fixture-studio", false);
    assert.equal(
      selected.scene.findByProps({ name: "room-fixture-studio-interaction" }).instance.material
        .opacity,
      0.055,
    );
    assert.equal(
      selected.scene.findAllByProps({ name: "room-selection-fixture-studio" }).length,
      0,
    );
    await selected.unmount();

    const walking = await render(null, true);
    const room = walking.scene.findByProps({ name: "room-fixture-studio" });
    assert.equal(room.props.onPointerOver, undefined);
    assert.equal(room.props.onPointerDown, undefined);
    assert.equal(room.props.onPointerUp, undefined);
    await walking.unmount();
  });
});
