import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { homeManifest } = await load("/tests/fixtures/bundled-home.ts");
  const { deriveDemoSessionDefinition } = await load(
    "/packages/engine/src/DemoHomeAssistantSession.tsx",
  );
  const { resolveHomeAssistantBindings } = await load(
    "/packages/engine/src/home-assistant-resolver.ts",
  );
  const { resolveOpeningPositions, passableOpeningIds } = await load(
    "/packages/engine/src/opening-pose.ts",
  );
  const { openingWorldPlacement } = await load("/packages/engine/src/geometry.ts");
  const { WalkCameraController } = await load("/packages/engine/src/WalkCameraController.tsx");
  const { deriveFloorLevels } = await load("/packages/engine/src/building/floor-levels.ts");

  test("fresh bundled demo opens doors on approach and closes them on departure on every floor", async () => {
    const definition = deriveDemoSessionDefinition(homeManifest);
    const levels = deriveFloorLevels(homeManifest.floors);
    const bindings = resolveHomeAssistantBindings(
      homeManifest,
      definition.profile,
      definition.runtime,
    );
    const boundOpeningIds = new Set(
      Object.values(bindings.openings)
        .filter((binding) => binding.bound)
        .map((binding) => binding.openingId),
    );
    for (const floor of homeManifest.floors) {
      for (const door of floor.openings.filter((opening) => opening.kind === "door")) {
        const wall = floor.walls.find((wall) => wall.id === door.wallId);
        const placement = openingWorldPlacement(wall, door, floor.coordinates);
        const poseRef = {
          current: {
            x: (placement.start[0] + placement.end[0]) / 2,
            z: (placement.start[1] + placement.end[1]) / 2,
            yaw: 0,
            pitch: 0,
          },
        };
        let automatic = new Set();
        const retained = new Map();
        const props = {
          floor,
          building: homeManifest,
          elevation: levels.find((level) => level.floorId === floor.id).elevationMeters,
          poseRef,
          reducedMotion: true,
          movementInputRef: { current: { x: 0, y: 0 } },
          lookInputRef: { current: { x: 0, y: 0 } },
          lookDeltaRef: { current: { x: 0, y: 0 } },
          boundOpeningIds,
          openingPositions: resolveOpeningPositions(automatic, bindings.openings, retained),
          onOpeningsChange(ids) {
            automatic = ids;
          },
          onRoomChange() {},
        };
        const renderer = await create(createElement(WalkCameraController, props));
        try {
          await renderer.advanceFrames(1, 1 / 60);
          const positions = resolveOpeningPositions(automatic, bindings.openings, retained);
          assert.equal(positions[door.id], 1, `${floor.id}/${door.id} opens on approach`);
          assert.ok(
            passableOpeningIds([floor], positions).has(door.id),
            `${door.id} is traversable`,
          );
          poseRef.current.x += 10;
          poseRef.current.z += 10;
          await renderer.update(
            createElement(WalkCameraController, { ...props, openingPositions: positions }),
          );
          await renderer.advanceFrames(1, 1 / 60);
          assert.equal(
            resolveOpeningPositions(automatic, bindings.openings, retained)[door.id],
            0,
            `${door.id} closes on departure`,
          );
        } finally {
          await renderer.unmount();
        }
      }
    }
  });
});
