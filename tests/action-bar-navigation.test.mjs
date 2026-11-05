import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withStorageDom } from "./dom-test-environment.mjs";
import { connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { resolveActionBarDestination, openActionBarDestination } = await load(
    "/packages/engine/src/action-bar/action-bar-navigation.ts",
  );
  const engine = await load("/packages/engine/src/index.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const { interactionFloor } = await load("/tests/fixtures/interaction-floor.ts");
  const { useDashboardController } = await load("/packages/engine/src/useDashboardController.ts");
  const manifest = {
    floors: [
      { id: "ground", rooms: [{ id: "hall", devices: [] }] },
      { id: "upper", rooms: [{ id: "study", devices: [{ id: "desk-lamp" }] }] },
    ],
  };

  test("resolves exact room and upper-floor device destinations", () => {
    assert.deepEqual(resolveActionBarDestination(manifest, { kind: "room", roomId: "study" }), {
      floorId: "upper",
      roomId: "study",
    });
    assert.deepEqual(
      resolveActionBarDestination(manifest, { kind: "device", deviceId: "desk-lamp" }),
      { floorId: "upper", roomId: "study", deviceId: "desk-lamp" },
    );
    assert.equal(
      resolveActionBarDestination(manifest, { kind: "device", deviceId: "deleted" }),
      null,
    );
  });

  test("opens exact upper-floor device from Walk in navigation order", () => {
    const events = [];
    openActionBarDestination(
      { floorId: "upper", roomId: "study", deviceId: "desk-lamp" },
      {
        walkMode: true,
        leaveWalkMode: () => events.push("leave Walk"),
        selectFloor: (id) => events.push(`floor ${id}`),
        selectRoom: (id) => events.push(`room ${id}`),
        openDevice: (roomId, deviceId) => events.push(`device ${roomId}/${deviceId}`),
      },
    );
    assert.deepEqual(events, ["leave Walk", "floor upper", "room study", "device study/desk-lamp"]);
  });
  test("outside-room controls open without selecting an architectural room", () =>
    withStorageDom(async (dom) => {
      const project = engine.createEmptyHomeProject("outside-shortcut", "Outdoor shortcut");
      const upperFloor = engine.neutralDemoManifest.floors[0];
      const groundRoomId = `outside-rooms:${interactionFloor.id}`;
      const upperRoomId = "outside-rooms:upper";
      project.floors = [
        {
          ...interactionFloor,
          rooms: [{ ...interactionFloor.rooms[0], id: groundRoomId }],
          ceilings: interactionFloor.ceilings.map((ceiling) => ({
            ...ceiling,
            roomIds: [groundRoomId],
          })),
        },
        {
          ...upperFloor,
          id: "upper",
          rooms: [{ ...upperFloor.rooms[0], id: upperRoomId }],
          ceilings: upperFloor.ceilings.map((ceiling) => ({ ...ceiling, roomIds: [upperRoomId] })),
        },
      ];
      project.sceneItems = [
        {
          id: "garden-lamp",
          kind: "device",
          modelId: "table-lamp",
          floorId: interactionFloor.id,
          placement: { kind: "absolute", at: [20, 20], elevationMeters: 0, rotationYRadians: 0 },
          size: [0.32, 0.52, 0.32],
          entitySlots: [
            {
              id: "garden-light",
              deviceRole: "primary",
              compatibleDomains: ["light"],
              required: true,
              autoMap: "manual",
              presentation: { label: "Garden light", dashboardRole: "primary" },
            },
          ],
        },
      ];
      const manifest = engine.composeHomeManifest(project, {
        deviceModels: stableDeviceRegistry,
        furnishingModels: {},
        openingModels: {},
      });
      const target = { kind: "device", deviceId: "garden-lamp" };
      const destination = resolveActionBarDestination(manifest, target);
      assert.equal(destination.floorId, interactionFloor.id);
      assert.equal(destination.deviceId, "garden-lamp");
      const outsideId = destination.roomId;
      assert.notEqual(outsideId, groundRoomId);
      const profile = {
        ...engine.createEmptyRuntimeBindingProfile(project.home.id),
        entityIdsBySlotId: { "garden-light": "light.demo_ceiling" },
      };
      const runtime = connectedRuntimeFixture();
      dom.window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      });
      let controller;
      function Harness() {
        controller = useDashboardController({
          manifest,
          architectureModels: {},
          deviceModels: stableDeviceRegistry,
          bindingManager: { profile, loaded: true, hasStoredProfile: true, save() {} },
          fallbackDemo: false,
          setupOpen: false,
        });
        return null;
      }
      await dom.mount(() => {
        const root = createRoot(dom.document.body.appendChild(dom.document.createElement("div")));
        root.render(
          React.createElement(
            engine.FloorNavigationProvider,
            null,
            React.createElement(
              engine.HomeAssistantRuntimeValueProvider,
              { value: runtime },
              React.createElement(Harness),
            ),
          ),
        );
        return { unmount: () => root.unmount() };
      });
      assert.equal(controller.resolvedBindings.rooms[outsideId].devices[0].slot.id, "garden-lamp");
      assert.deepEqual(controller.resolvedBindings.rooms[groundRoomId].devices, []);
      for (const [open, deviceId] of [
        [() => controller.openDevicePanel(outsideId, null), null],
        [
          () => controller.handleExtensionInteraction({ id: "garden-lamp", label: "Garden lamp" }),
          "garden-lamp",
        ],
        [() => controller.runConfiguredAction({ id: "garden", target }), "garden-lamp"],
      ]) {
        await act(async () => open());
        assert.equal(controller.deviceOverlay, true);
        assert.equal(controller.controlRoom.id, outsideId);
        assert.equal(controller.selectedDeviceId, deviceId);
        assert.equal(controller.selectedRoomId, null);
        assert.equal(controller.mode, "overview");
        await act(async () => controller.closeDevicePanel());
        assert.equal(controller.deviceOverlay, false);
      }

      let rejectCall;
      runtime.callService = () =>
        new Promise((_resolve, reject) => {
          rejectCall = reject;
        });
      await act(async () =>
        controller.handleExtensionInteraction({
          id: "garden-lamp",
          label: "Garden lamp",
          intent: "light-toggle",
        }),
      );
      assert.equal(typeof rejectCall, "function");
      await act(async () => controller.floorNavigation.selectFloor("upper", "picker"));
      await act(async () => rejectCall(new Error("Service rejected after changing floors")));
      assert.equal(controller.selectedDeviceId, null);
      assert.equal(controller.deviceOverlay, false);
      assert.equal(controller.resolvedBindings.rooms[upperRoomId].room.id, upperRoomId);
      assert.equal(controller.outsideRoom, undefined);
    }));
});
