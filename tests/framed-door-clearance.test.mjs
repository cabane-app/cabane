import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Matrix4, Triangle } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { stableArchitectureModelRegistry } = await load(
    "/packages/catalog/src/architecture/index.ts",
  );
  const floor = structuredClone(engine.neutralDemoManifest.floors[0]);
  const base = floor.openings.find((o) => o.kind === "door");
  const wall = { ...floor.walls[0], from: [1, 1], to: [5, 4], thicknessMeters: 0.07 };
  test("explicit door positions preserve intermediate poses with reduced motion", async () => {
    for (const operation of ["hinged", "sliding"]) {
      const opening = { ...base, operation, variant: "panel", leafCount: 1 };
      const render = (position) =>
        createElement(stableArchitectureModelRegistry.door, {
          floor,
          wall,
          opening,
          position,
          reducedMotion: true,
        });
      const renderer = await create(render(0));
      const motion = renderer.scene.findByProps({ name: "opening-leaf-motion" }).instance;
      await renderer.update(render(1));
      await renderer.advanceFrames(1, 0.016);
      const full = operation === "hinged" ? motion.rotation.y : motion.position.x;
      assert.ok(Math.abs(full) > 0);
      for (const position of [0.25, 0.5, 0.75, 0]) {
        await renderer.update(render(position));
        await renderer.advanceFrames(1, 0.016);
        const actual = operation === "hinged" ? motion.rotation.y : motion.position.x;
        assert.ok(
          Math.abs(actual - full * position) < 1e-8,
          `${operation} pose at ${position}: expected ${full * position}, got ${actual}`,
        );
      }
      await renderer.unmount();
    }
  });
  test("framed leaves and handles clear every jamb throughout the actual animation on both swing sides and hinges", async () => {
    for (const variant of [
      "panel",
      "panel-white-lever",
      "french",
      "plank",
      ...engine.GARDEN_GATE_VARIANTS,
    ]) {
      for (const leafCount of [1, 2]) {
        for (const [openingWidth, wallThickness] of [
          [leafCount === 1 ? 0.69 : 1.4, 0.07],
          [0.3, 0.2],
        ]) {
          for (const openingSide of ["left", "right"]) {
            for (const hingeSide of leafCount === 1 ? ["start", "end"] : ["start"]) {
              const opening = {
                ...base,
                widthPlanUnits: openingWidth,
                offsetFromWallStartPlanUnits: 0.2,
                openingHeightMeters: engine.isGardenGate(variant) ? 1 : 2.1,
                variant,
                leafCount,
                openingSide,
                hingeSide,
                operation: "hinged",
              };
              const render = (position, reducedMotion) =>
                createElement(stableArchitectureModelRegistry.door, {
                  floor,
                  wall: { ...wall, thicknessMeters: wallThickness },
                  opening,
                  position,
                  reducedMotion,
                });
              const renderer = await create(render(0, true));
              const scene = renderer.scene.instance;
              const frames = [],
                moving = [];
              scene.traverse((o) => {
                if (!o.isMesh || !o.material?.isMeshToonMaterial) return;
                if (o.name.startsWith("opening-door-frame-")) frames.push(o);
                else moving.push(o);
              });
              assert.equal(frames.length, engine.isGardenGate(variant) ? 2 : 3);
              assert.ok(
                moving.length > 0,
                "door leaves and handles must participate in collision checks",
              );
              await renderer.update(render(1, false));
              const motions = [];
              scene.traverse((o) => {
                if (o.name === "opening-leaf-motion") motions.push(o);
              });
              assert.equal(motions.length, leafCount, "every leaf must animate");
              // Geometry is immutable during animation. Reject disjoint transformed
              // bounds before the exact triangle test; never sample fewer frames.
              const frameBounds = frames.map((frame) => {
                frame.geometry.computeBoundingBox();
                return frame.geometry.boundingBox.clone().expandByScalar(-0.00001);
              });
              for (const mesh of moving) mesh.geometry.computeBoundingBox();
              const meshBounds = new Box3();
              const triangle = new Triangle();
              const transform = new Matrix4();
              for (let step = 0; step <= 65; step++) {
                if (step === 65) {
                  await renderer.update(render(1, true));
                  await renderer.advanceFrames(1, 0.016);
                } else if (step) await renderer.advanceFrames(1, 0.016);
                scene.updateMatrixWorld(true);
                for (const [frameIndex, frame] of frames.entries()) {
                  const box = frameBounds[frameIndex];
                  const inverse = frame.matrixWorld.clone().invert();
                  for (const mesh of moving) {
                    transform.multiplyMatrices(inverse, mesh.matrixWorld);
                    meshBounds.copy(mesh.geometry.boundingBox).applyMatrix4(transform);
                    if (!box.intersectsBox(meshBounds)) continue;
                    const vertices = mesh.geometry.attributes.position,
                      indices = mesh.geometry.index;
                    const count = indices ? indices.count : vertices.count;
                    for (let offset = 0; offset < count; offset += 3) {
                      for (const [i, point] of [triangle.a, triangle.b, triangle.c].entries())
                        point
                          .fromBufferAttribute(
                            vertices,
                            indices ? indices.getX(offset + i) : offset + i,
                          )
                          .applyMatrix4(transform);
                      if (box.intersectsTriangle(triangle))
                        assert.fail(
                          `${variant}/${leafCount}/${openingSide}/${hingeSide} step${step} ${mesh.name || mesh.parent.name || mesh.geometry.type} localPos=${mesh.position.toArray()} enters${frame.name}`,
                        );
                    }
                  }
                }
              }
              assert.ok(
                motions.every((m) => Math.abs(m.rotation.y) > 1.5),
                "animation reaches its normal fully-open angle",
              );
              await renderer.unmount();
            }
          }
        }
      }
    }
  });
});
