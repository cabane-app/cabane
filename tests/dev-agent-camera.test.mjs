import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Box3,
  Group,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  OrthographicCamera,
  Vector3,
} from "three";
import {
  captureOptions,
  cameraPose,
  frameCamera,
  restoreCameraPose,
  CAPTURE_VIEWS,
} from "../scripts/dev-agent-camera.mjs";
import { captureDevAgent } from "../scripts/dev-agent-capture.mjs";

const controlsFor = (object) => ({
  object,
  target: new Vector3(),
  enableDamping: true,
  minZoom: 6,
  maxZoom: 300,
  minPolarAngle: 0,
  maxPolarAngle: 1.28,
  update() {
    object.lookAt(this.target);
    object.updateMatrixWorld();
  },
});

test("all camera presets fit transformed object bounds in wide and portrait canvases", () => {
  const group = new Group();
  group.position.set(-20, 4.8, 12);
  group.rotation.y = 0.7;
  group.scale.set(1.3, 0.8, 1.7);
  const mesh = new Mesh(new BoxGeometry(4, 1.2, 0.6), new MeshBasicMaterial());
  group.add(mesh);
  group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(group, true);
  try {
    for (const [width, height] of [
      [1000, 600],
      [300, 800],
    ]) {
      for (const [name, [azimuth, elevation]] of Object.entries(CAPTURE_VIEWS)) {
        const camera = new OrthographicCamera(
          -width / 2,
          width / 2,
          height / 2,
          -height / 2,
          0.1,
          150,
        );
        const controls = controlsFor(camera);
        const pose = frameCamera(camera, controls, bounds, { name, azimuth, elevation });
        assert.ok(Number.isFinite(pose.zoom));
        let maximum = 0;
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
              const point = new Vector3(x, y, z).project(camera);
              assert.ok(Math.abs(point.x) <= 1 / 1.2 + 1e-6, name);
              assert.ok(Math.abs(point.y) <= 1 / 1.2 + 1e-6, name);
              assert.ok(point.z >= -1 && point.z <= 1, name);
              maximum = Math.max(maximum, Math.abs(point.x), Math.abs(point.y));
            }
        assert.ok(maximum > 0.8, "the target fills the available frame");
      }
    }
  } finally {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

test("capture camera restoration round-trips pose and normal editor limits", () => {
  const camera = new OrthographicCamera(-500, 500, 300, -300, 0.1, 150);
  const controls = controlsFor(camera);
  camera.position.set(12, 10, 8);
  controls.target.set(2, 0.2, 3);
  controls.update();
  const original = cameraPose(camera, controls);
  frameCamera(camera, controls, new Box3(new Vector3(1, 1, 1), new Vector3(1.1, 1.1, 1.1)), {
    azimuth: 0,
    elevation: 8,
  });
  assert.ok(camera.zoom > 300, "small items can be inspected past the ordinary UI zoom limit");
  restoreCameraPose(camera, controls, JSON.parse(JSON.stringify(original)));
  assert.deepEqual(cameraPose(camera, controls), original);
  assert.throws(
    () => frameCamera(camera, controls, new Box3(), { azimuth: 0, elevation: 30 }),
    /no rendered geometry/,
  );
});

test("capture options reject ambiguous targets, invalid views and unsafe output names", () => {
  assert.deepEqual(
    captureOptions({}, true).views.map((v) => v.name),
    ["front-right", "back-left", "top", "low-front"],
  );
  assert.equal(
    captureOptions({ views: [{ name: "custom", azimuth: 359, elevation: 4 }] }, true).views[0]
      .azimuth,
    359,
  );
  for (const input of [
    null,
    [],
    { itemId: "a", objectName: "b" },
    { itemId: "" },
    { padding: 1 },
    { padding: NaN },
    { timeoutMs: Infinity },
    { restore: "no" },
    { views: [] },
    { views: ["bogus"] },
    { views: ["top", "top"] },
    { views: [{ name: "TOP", azimuth: 0, elevation: 90 }, "top"] },
    { views: [{ name: "../escape", azimuth: 1, elevation: 20 }] },
    { views: [{ name: "low", azimuth: 1, elevation: -1 }] },
  ])
    assert.throws(() => captureOptions(input, true));
});

test("capture failures retain completed files and restore the camera without masking the original error", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cabane-capture-"));
  const pose = { fixture: "original camera" };
  let captures = 0,
    restored = false;
  const page = {
    on() {},
    off() {},
    async evaluate(_callback, input) {
      if (!input) return;
      const { params } = input;
      if (params.operation === "read") return pose;
      if (params.operation === "restore") {
        assert.deepEqual(params.pose, pose);
        restored = true;
        throw new Error("secondary restore failure");
      }
      if (captures++) throw new Error("original render failure");
      return { view: params.view, png: "data:image/png;base64,AA==" };
    },
  };
  try {
    await assert.rejects(
      captureDevAgent(
        {
          page,
          root: directory,
          execute: async () => ({
            activeFloorId: "ground",
            draftRevision: 4,
            project: { sceneItems: [] },
          }),
        },
        { directory, views: ["front", "back"] },
        true,
      ),
      (error) => {
        assert.equal(error.message, "original render failure");
        assert.equal(error.restoreError, "secondary restore failure");
        assert.equal(error.captures.length, 1);
        assert.equal(error.captures[0].path, join(directory, "front.png"));
        return true;
      },
    );
    assert.equal(restored, true);
    assert.deepEqual(await readFile(join(directory, "front.png")), Buffer.from([0]));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
