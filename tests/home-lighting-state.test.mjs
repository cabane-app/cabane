import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const engine = await load("/packages/engine/src/index.ts");
  const { homeManifest } = await load("/tests/fixtures/bundled-home.ts");
  const { homeExtensions, ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { KitchenLighting } = await load("/home/src/extensions/kitchen/kitchen-lighting.tsx");

  test("pergola variants switch physical strings and lighting without changing bindings", async () => {
    const definition = stableDeviceRegistry["pergola-string-lights"];
    const floor = homeManifest.floors[0];
    const base = {
      id: "pergola",
      floorId: floor.id,
      modelId: "pergola-string-lights",
      kind: "device",
      lightState: "always-on",
      entitySlots: [],
      size: definition.defaultSize,
      placement: { kind: "absolute", at: [-5, -5], elevationMeters: 0, rotationYRadians: 0 },
    };
    for (const variant of [undefined, "plain", "string-lights"]) {
      const item = { ...base, variant };
      const model = await create(
        createElement(engine.SceneItemRenderer, {
          item,
          floor,
          deviceModels: stableDeviceRegistry,
          furnishingModels: {},
          entityStatesBySlotId: {},
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
          liveMediaByEntityId: {},
        }),
      );
      assert.equal(
        model.scene.findAllByProps({ name: "pergola-string-lights" }).length,
        variant === "plain" ? 0 : 1,
      );
      const lighting = await create(
        createElement(engine.HomeAssistantSceneLighting, {
          floor,
          resolvedBindings: { rooms: {}, openings: {}, issues: [] },
          deviceModels: stableDeviceRegistry,
          extensionDeviceModels: {},
          sceneItems: [item],
        }),
      );
      assert.equal(
        lighting.scene.findAllByProps({ name: "ha-device-light-pergola" }).length,
        variant === "plain" ? 0 : 1,
      );
      await lighting.unmount();
      await model.unmount();
    }
  });

  test("cozy sectional renders colored cushions inside its existing envelope", async () => {
    const definition = homeExtensions.furnishingModels["sectional-sofa"];
    for (const variant of [undefined, "cozy", "right", "cozy-right"]) {
      const renderer = await create(
        createElement(definition.component, {
          variant,
          size: definition.defaultSize,
          entityStatesBySlotId: {},
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
        }),
      );
      assert.equal(
        renderer.scene.findAllByProps({ name: "cozy-sofa-cushions" }).length,
        variant === "cozy" || variant === "cozy-right" ? 1 : 0,
      );
      renderer.scene.instance.updateMatrixWorld(true);
      const chaise = renderer.scene.findByProps({ name: "chaise-seat-cushion" }).instance;
      const chaiseX = chaise.getWorldPosition(new Vector3()).x;
      assert.ok(variant === "right" || variant === "cozy-right" ? chaiseX > 0 : chaiseX < 0);
      const box = new Box3().setFromObject(renderer.scene.instance);
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(box.min.toArray()[axis] - definition.bounds.min[axis]) < 0.001);
        assert.ok(Math.abs(box.max.toArray()[axis] - definition.bounds.max[axis]) < 0.001);
      }
      await renderer.unmount();
    }
  });

  test("variants round-trip for furniture and devices and reject malformed values", () => {
    const project = structuredClone(ownerHomeProject);
    project.sceneItems.find((item) => item.modelId === "sectional-sofa").variant = "cozy";
    const device = project.sceneItems.find((item) => item.kind === "device");
    device.variant = "default";
    const parsed = engine.parseHomeProject(engine.serializeHomeProject(project));
    assert.equal(parsed.valid, true);
    assert.deepEqual(parsed.project, project);
    assert.equal(
      engine
        .composeHomeManifest(parsed.project, homeExtensions)
        .sceneItems.find((item) => item.modelId === "sectional-sofa").variant,
      "cozy",
    );
    for (const invalid of [null, 1, [], ""]) {
      device.variant = invalid;
      assert.equal(engine.parseHomeProject(engine.serializeHomeProject(project)).valid, false);
    }
  });

  test("dashboard light updates retain emitters for off, unavailable and stale states", async () => {
    const floor = homeManifest.floors[0];
    const room = floor.rooms[0];
    const render = (state) =>
      createElement(engine.HomeAssistantSceneLighting, {
        floor,
        resolvedBindings: {
          rooms: {
            [room.id]: {
              devices: [],
              sections: { primary: [{ slotId: "test-light", domain: "light", state }] },
            },
          },
          openings: {},
          issues: [],
        },
        deviceModels: {},
        extensionDeviceModels: {},
      });
    const on = { state: "on", available: true, stale: false, attributes: {} };
    const renderer = await create(render(on));
    try {
      const emitter = renderer.scene.findByProps({ name: "ha-room-light-test-light" }).instance;
      for (const state of [
        { ...on, state: "off" },
        { ...on, available: false },
        { ...on, stale: true },
        on,
      ]) {
        await renderer.update(render(state));
        const current = renderer.scene.findByProps({ name: "ha-room-light-test-light" }).instance;
        assert.equal(current, emitter);
        assert.equal(current.intensity, state === on ? 5 : 0);
      }
    } finally {
      await renderer.unmount();
    }
  });

  test("outdoor always-on lanterns illuminate without rooms or HA bindings", async () => {
    const floor = { ...homeManifest.floors[0], rooms: [] };
    for (const modelId of ["low-garden-lantern", "garden-lantern-pole"]) {
      const definition = stableDeviceRegistry[modelId];
      const item = {
        id: "outdoor-lantern",
        floorId: floor.id,
        kind: "device",
        modelId,
        lightState: "always-on",
        placement: { kind: "absolute", at: [-3, -2], elevationMeters: 0, rotationYRadians: 0.5 },
        size: definition.defaultSize,
        entitySlots: [],
      };
      const lightingProps = {
        floor,
        resolvedBindings: { rooms: {}, openings: {}, issues: [] },
        deviceModels: stableDeviceRegistry,
        extensionDeviceModels: {},
        sceneItems: [item],
      };
      const renderer = await create(
        createElement(engine.HomeAssistantSceneLighting, lightingProps),
      );
      const light = renderer.scene.findByProps({ name: "ha-device-light-outdoor-lantern" });
      const position = engine.resolveItemTransform(item.placement, floor).position;
      assert.deepEqual(light.props.position, [
        position[0],
        definition.sceneLight.position[1],
        position[2],
      ]);
      assert.equal(light.props.intensity, 1.4);
      assert.equal(light.props.distance, 2.5);
      assert.equal(light.props.decay, 2);
      assert.equal(light.props.castShadow, false);
      const model = await create(
        createElement(engine.SceneItemRenderer, {
          item,
          floor,
          deviceModels: stableDeviceRegistry,
          furnishingModels: {},
          entityStatesBySlotId: {},
          reducedMotion: true,
          walkMode: false,
          onInteract: () => {},
          liveMediaByEntityId: {},
        }),
      );
      assert.ok(
        model.scene.findByProps({ name: "garden-lantern-bulb" }).instance.material
          .emissiveIntensity > 0,
      );
      for (const lightState of ["always-off", "connected"]) {
        await renderer.update(
          createElement(engine.HomeAssistantSceneLighting, {
            ...lightingProps,
            sceneItems: [{ ...item, lightState }],
          }),
        );
        assert.equal(
          renderer.scene.findByProps({ name: "ha-device-light-outdoor-lantern" }).instance
            .intensity,
          0,
        );
      }
      await model.unmount();
      await renderer.unmount();
    }
  });

  test("hides physical lights on inactive floors without changing the item state", async () => {
    const definition = stableDeviceRegistry["table-lamp"];
    const floor = homeManifest.floors[1];
    const item = ownerHomeProject.sceneItems.find(
      (candidate) => candidate.id === "primary-bedroom-north-table-lamp",
    );
    const props = {
      floor,
      resolvedBindings: { rooms: {}, openings: {}, issues: [] },
      deviceModels: stableDeviceRegistry,
      extensionDeviceModels: {},
      sceneItems: [{ ...item, lightState: "always-on" }],
    };
    const renderer = await create(
      createElement(engine.HomeAssistantSceneLighting, {
        ...props,
        enabled: false,
      }),
    );
    assert.equal(renderer.scene.findAllByProps({ name: `ha-device-light-${item.id}` }).length, 0);
    await renderer.update(createElement(engine.HomeAssistantSceneLighting, props));
    const light = renderer.scene.findByProps({ name: `ha-device-light-${item.id}` });
    assert.equal(light.props.intensity, definition.sceneLight.maxIntensity);
    assert.equal(light.props.castShadow, false);
    await renderer.unmount();
  });

  test("near-wall table lamps retain upward and wall-side emission as elevation changes", async () => {
    const floor = {
      ...homeManifest.floors[0],
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      rooms: [
        {
          ...homeManifest.floors[0].rooms[0],
          polygon: [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        },
      ],
      walls: [
        {
          id: "exterior",
          from: [0, 0],
          to: [4, 0],
          thicknessMeters: 0.1,
          classification: "exterior",
        },
      ],
      openings: [],
    };
    const definition = stableDeviceRegistry["table-lamp"];
    const render = (elevationMeters, wallDistance) =>
      createElement(engine.HomeAssistantSceneLighting, {
        floor,
        resolvedBindings: { rooms: {}, openings: {}, issues: [] },
        deviceModels: stableDeviceRegistry,
        extensionDeviceModels: {},
        sceneItems: [
          {
            id: "near-wall-lamp",
            floorId: floor.id,
            kind: "device",
            modelId: "table-lamp",
            size: definition.defaultSize,
            lightState: "always-on",
            entitySlots: [],
            placement: {
              kind: "absolute",
              at: [2, wallDistance],
              elevationMeters,
              rotationYRadians: 0,
            },
          },
        ],
      });
    const renderer = await create(render(0.6, 0.59));
    try {
      for (const elevationMeters of [0.6, 1.25, 0]) {
        for (const wallDistance of [0.59, 0.6]) {
          await renderer.update(render(elevationMeters, wallDistance));
          const light = renderer.scene.findByProps({
            name: "ha-device-light-near-wall-lamp",
          }).instance;
          assert.equal(
            light.isPointLight,
            true,
            "the shade's upper and wall-facing sides must receive light before the wall",
          );
          assert.ok(Math.abs(light.position.y - elevationMeters - 0.42) < 1e-9);
          const plane = light.userData.cabaneLightWallPlane;
          if (wallDistance < 0.6) {
            assert.deepEqual(plane, [0, 0, 1, -0.05]);
            assert.ok(
              plane[2] * 0.1 + plane[3] > 0,
              "the space between the bulb and wall remains lit",
            );
            assert.ok(plane[2] * -0.1 + plane[3] < 0, "the wall still blocks receivers behind it");
          } else assert.equal(plane, null);
        }
      }
    } finally {
      await renderer.unmount();
    }
  });

  test("primary bedroom bedside lamps cannot illuminate the gallery behind their wall", async () => {
    const floor = homeManifest.floors.find((candidate) => candidate.id === "first-floor");
    const items = ownerHomeProject.sceneItems
      .filter(
        (item) =>
          item.id === "primary-bedroom-north-table-lamp" ||
          item.id === "primary-bedroom-south-table-lamp",
      )
      .map((item) => ({ ...item, lightState: "always-on" }));
    const renderer = await create(
      createElement(engine.HomeAssistantSceneLighting, {
        floor,
        resolvedBindings: { rooms: {}, openings: {}, issues: [] },
        deviceModels: stableDeviceRegistry,
        extensionDeviceModels: {},
        sceneItems: items,
      }),
    );
    for (const item of items) {
      const light = renderer.scene.findByProps({ name: `ha-device-light-${item.id}` }).instance;
      assert.equal(light.isPointLight, true);
      const plane = light.userData.cabaneLightWallPlane;
      assert.ok(plane, `${item.id} should keep its room's wall mask`);
      assert.ok(plane[0] * light.position.x + plane[2] * light.position.z + plane[3] > 0);
      assert.ok(
        plane[0] * 10.5 + plane[2] * light.position.z + plane[3] < 0,
        `${item.id} must not illuminate the gallery`,
      );
      assert.equal(light.castShadow, false);
    }
    await renderer.update(
      createElement(engine.HomeAssistantSceneLighting, {
        floor,
        resolvedBindings: { rooms: {}, openings: {}, issues: [] },
        deviceModels: stableDeviceRegistry,
        extensionDeviceModels: {},
        sceneItems: [
          {
            ...items[0],
            placement: {
              ...items[0].placement,
              at: [9.716, 2.5],
            },
          },
        ],
      }),
    );
    assert.equal(
      renderer.scene.findByProps({ name: `ha-device-light-${items[0].id}` }).instance.isPointLight,
      true,
      "the bedroom doorway must remain an opening for light",
    );
    assert.equal(
      renderer.scene.findByProps({ name: `ha-device-light-${items[0].id}` }).instance.userData
        .cabaneLightWallPlane,
      null,
    );
    await renderer.unmount();
  });

  test("stair floor changes never relocate another floor's light sources", async () => {
    const sceneItems = homeManifest.sceneItems.map((item) =>
      item.kind === "device" ? { ...item, lightState: "always-on" } : item,
    );
    const rooms = Object.fromEntries(
      homeManifest.floors
        .flatMap((floor) => floor.rooms)
        .map((room) => [
          room.id,
          {
            room,
            sections: {},
            devices: room.devices.map((slot) => ({
              slot,
              entities: slot.entitySlots
                .filter((entitySlot) => entitySlot.compatibleDomains.includes("light"))
                .map((entitySlot) => ({
                  slotId: entitySlot.id,
                  domain: "light",
                  state: {
                    state: "on",
                    attributes: {},
                    available: true,
                    stale: false,
                  },
                })),
              issues: [],
            })),
          },
        ]),
    );
    const props = {
      resolvedBindings: { rooms, openings: {}, issues: [] },
      deviceModels: stableDeviceRegistry,
      extensionDeviceModels: homeExtensions.deviceModels,
    };
    const forFloor = (floor) => ({
      ...props,
      floor,
      sceneItems: sceneItems.filter((item) => item.floorId === floor.id),
    });
    const renderer = await create(
      createElement(engine.HomeAssistantSceneLighting, {
        ...forFloor(homeManifest.floors[0]),
      }),
    );
    try {
      for (const floor of [...homeManifest.floors, homeManifest.floors[0]]) {
        await renderer.update(createElement(engine.HomeAssistantSceneLighting, forFloor(floor)));
        const lights = renderer.scene.instance.children[0].children.filter(
          (child) => child.isPointLight || child.isSpotLight,
        );
        assert.ok(lights.length > 0);
        for (const light of lights) {
          const item = sceneItems.find((item) => light.name === `ha-device-light-${item.id}`);
          assert.equal(item.floorId, floor.id, `${item.id} must not illuminate ${floor.id}`);
        }
      }
    } finally {
      await renderer.unmount();
    }
  });

  test("keeps the two-floor demo within the existing unshadowed light path", async () => {
    for (const floor of homeManifest.floors) {
      const sceneItems = homeManifest.sceneItems
        .filter((item) => item.floorId === floor.id && item.kind === "device")
        .map((item) => ({ ...item, lightState: "always-on" }));
      const renderer = await create(
        createElement(engine.HomeAssistantSceneLighting, {
          floor,
          resolvedBindings: { rooms: {}, openings: {}, issues: [] },
          deviceModels: stableDeviceRegistry,
          extensionDeviceModels: homeExtensions.deviceModels,
          sceneItems,
        }),
      );
      const lights = renderer.scene.instance.children[0].children.filter(
        (child) => child.isPointLight || child.isSpotLight,
      );
      assert.ok(lights.length > 0);
      assert.ok(lights.length <= sceneItems.length, `${floor.id} must not multiply light sources`);
      assert.ok(
        lights.every((light) => !light.castShadow),
        `${floor.id} must not allocate physical-light shadow maps`,
      );
      await renderer.unmount();
    }
  });

  test("round-trips all light states and rejects unknown states", () => {
    for (const mode of ["always-off", "always-on", "connected"]) {
      const project = structuredClone(ownerHomeProject);
      const item = project.sceneItems.find((item) => item.kind === "device");
      item.lightState = mode;
      const parsed = engine.parseHomeProject(engine.serializeHomeProject(project));
      assert.equal(parsed.valid, true);
      assert.deepEqual(parsed.project, project);
      assert.equal(
        engine
          .composeHomeManifest(parsed.project, homeExtensions)
          .sceneItems.find((candidate) => candidate.id === item.id).lightState,
        mode,
      );
      for (const invalid of ["invalid", ["always-on"], null, true]) {
        item.lightState = invalid;
        assert.equal(engine.parseHomeProject(engine.serializeHomeProject(project)).valid, false);
      }
    }
  });

  test("drives custom cabinet lighting from its supplied light state", async () => {
    const kitchenState = {
      entityId: "light.fixture_kitchen",
      state: "on",
      attributes: { brightness: 64 },
      available: true,
      stale: false,
    };
    const renderer = await create(createElement(KitchenLighting, { state: kitchenState }));

    const expectedRatio = 64 / 255;
    const kitchenLight = renderer.scene.findByProps({ name: "kitchen-light-strip-emitter" });
    assert.ok(
      Math.abs(kitchenLight.instance.material.emissiveIntensity - 0.27 * expectedRatio) < 1e-12,
    );
    await renderer.unmount();
  });

  test("renders the kitchen cabinet device's configured light source in the engine", async () => {
    const manifest = engine.composeHomeManifest(ownerHomeProject, homeExtensions);
    const floor = manifest.floors[0];
    const room = floor.rooms.find((candidate) => candidate.id === "open-plan-living");
    const device = room.devices.find((candidate) => candidate.model === "kitchen-cabinet-lighting");
    assert.ok(device);
    const state = {
      entityId: "light.fixture_kitchen",
      state: "on",
      attributes: { brightness: 64 },
      available: true,
      stale: false,
    };
    const binding = {
      entityId: state.entityId,
      domain: "light",
      path: "fixture",
      label: "Kitchen lights",
      roomId: room.id,
      slotId: device.entitySlots[0].id,
      deviceSlotId: device.id,
      state,
      areaId: null,
      deviceId: null,
      issues: [],
    };
    const renderer = await create(
      createElement(engine.HomeAssistantSceneLighting, {
        floor,
        resolvedBindings: {
          rooms: {
            [room.id]: {
              room,
              displayName: room.name,
              pictureUrl: null,
              sections: { primary: [], secondary: [], diagnostic: [] },
              devices: [{ slot: device, entities: [binding], issues: [] }],
              issues: [],
            },
          },
          openings: {},
          issues: [],
        },
        deviceModels: {},
        extensionDeviceModels: homeExtensions.deviceModels,
        sceneItems: manifest.sceneItems.map((item) =>
          item.id === device.id ? { ...item, lightState: "connected" } : item,
        ),
      }),
    );
    const light = renderer.scene.findByProps({
      name: `ha-device-light-${device.id}`,
    });
    assert.ok(Math.abs(light.instance.intensity - (5 * 64) / 255) < 1e-12);
    await renderer.unmount();
  });

  test("scales a declarative device light with its scene item", async () => {
    const floor = structuredClone(homeManifest.floors[0]);
    const room = floor.rooms[0];
    const entitySlot = {
      id: "fixture-scaled-light-slot",
      compatibleDomains: ["light"],
      required: true,
      autoMap: "unique-compatible",
      section: "primary",
      deviceRole: "primary",
      presentation: { label: "Scaled light" },
    };
    const deviceSlot = {
      id: "fixture-scaled-light",
      model: "fixture-light-model",
      entitySlots: [entitySlot],
      placement: {
        at: room.polygon[0],
        elevationMeters: 1,
        rotationYRadians: 0,
        support: { kind: "surface" },
      },
    };
    const state = {
      entityId: "light.fixture_scaled",
      state: "on",
      attributes: { brightness: 255 },
      available: true,
      stale: false,
    };
    const definition = {
      component: () => null,
      label: "Fixture light",
      category: "Lighting",
      defaultRoomType: "living-room",
      defaultSize: [1, 1, 1],
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
      resizePolicy: { kind: "uniform" },
      preferredPlacement: "absolute",
      outlineContact: false,
      complexity: { visibleMeshes: 1, triangles: 12 },
      supportedDomains: ["light"],
      mountKind: "surface",
      interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
      sceneLight: {
        position: [1, 0.5, 0],
        color: "#ffffff",
        maxIntensity: 10,
        distance: 4,
      },
    };
    const props = {
      floor,
      resolvedBindings: {
        rooms: {
          [room.id]: {
            room,
            displayName: room.name,
            pictureUrl: null,
            sections: { primary: [], secondary: [], diagnostic: [] },
            devices: [
              {
                slot: deviceSlot,
                entities: [
                  {
                    entityId: state.entityId,
                    domain: "light",
                    path: "fixture",
                    label: "Scaled light",
                    roomId: room.id,
                    slotId: entitySlot.id,
                    deviceSlotId: deviceSlot.id,
                    state,
                    areaId: null,
                    deviceId: null,
                    issues: [],
                  },
                ],
                issues: [],
              },
            ],
            issues: [],
          },
        },
        openings: {},
        issues: [],
      },
      deviceModels: { "fixture-light-model": definition },
      extensionDeviceModels: {},
      sceneItems: [
        {
          id: deviceSlot.id,
          floorId: floor.id,
          kind: "device",
          modelId: deviceSlot.model,
          placement: {
            kind: "absolute",
            at: deviceSlot.placement.at,
            elevationMeters: 1,
            rotationYRadians: 0,
          },
          size: [2, 2, 2],
          entitySlots: [entitySlot],
        },
      ],
    };
    const renderer = await create(createElement(engine.HomeAssistantSceneLighting, props));
    const light = renderer.scene.findByProps({ name: "ha-device-light-fixture-scaled-light" });
    const [baseX, baseZ] = engine.planPointToWorld(deviceSlot.placement.at, floor.coordinates);
    assert.deepEqual(light.props.position, [baseX + 2, 2, baseZ]);
    assert.equal(light.props.distance, 8);
    for (const [mode, liveState, expected] of [
      ["always-off", state, 0],
      ["always-on", undefined, 10],
      ["always-on", { ...state, state: "off", attributes: { brightness: 0 } }, 10],
      ["connected", undefined, 0],
      ["connected", { ...state, attributes: { brightness: 64 } }, (10 * 64) / 255],
    ]) {
      const item = { ...props.sceneItems[0], lightState: mode };
      const resolvedRoom = props.resolvedBindings.rooms[room.id];
      const device = resolvedRoom.devices[0];
      const resolvedDevice = {
        ...device,
        entities: liveState ? [{ ...device.entities[0], state: liveState }] : [],
      };
      await renderer.update(
        createElement(engine.HomeAssistantSceneLighting, {
          ...props,
          sceneItems: [item],
          resolvedBindings: {
            ...props.resolvedBindings,
            rooms: {
              [room.id]: { ...resolvedRoom, devices: [resolvedDevice] },
            },
          },
        }),
      );
      const lights = renderer.scene.findAllByProps({
        name: "ha-device-light-fixture-scaled-light",
      });
      assert.equal(lights.length, 1, mode);
      assert.equal(lights[0].instance, light.instance, "toggles retain the physical emitter");
      assert.equal(lights[0].props.intensity, expected);
      let observedState;
      const modelRenderer = await create(
        createElement(engine.SceneItemRenderer, {
          item,
          floor,
          furnishingModels: {},
          deviceModels: {
            [item.modelId]: {
              ...definition,
              component: (props) => {
                observedState = props.state;
                return null;
              },
            },
          },
          resolvedDevice,
          entityStatesBySlotId: {},
          reducedMotion: true,
          walkMode: false,
          onInteract: () => {},
          liveMediaByEntityId: {},
        }),
      );
      assert.equal(engine.lightBrightnessRatio(observedState) > 0, expected > 0, mode);
      await modelRenderer.unmount();
    }
    await renderer.unmount();
  });
});
