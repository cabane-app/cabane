import assert from "node:assert/strict";
import test from "node:test";
import { Mesh, PerspectiveCamera, Quaternion, Scene, Vector3, Vector4 } from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { createPortalViewCamera } = await load(
    "/packages/walk-laser/src/portals/portal-view-camera.ts",
  );
  const { createPortalViewRenderer } = await load(
    "/packages/walk-laser/src/portals/portal-view-renderer.ts",
  );
  const anchor = (center, normal) => ({
    center: new Vector3(...center),
    normal: new Vector3(...normal),
    rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...normal)),
  });
  const entry = anchor([0, 1.18, 0], [0, 0, 1]);
  const viewer = () => {
    const c = new PerspectiveCamera(68, 1.6, 0.05, 100);
    c.position.set(0.3, 1.52, 3);
    c.lookAt(entry.center);
    c.updateMatrixWorld();
    return c;
  };
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

  for (const [label, exit] of [
    ["opposing wall", anchor([4, 1.18, 8], [0, 0, -1])],
    ["perpendicular wall", anchor([4, 1.18, 0], [1, 0, 0])],
    ["floor", anchor([4, 0.018, 0], [0, 1, 0])],
    ["another storey", anchor([4, 4.18, 0], [0, 0, 1])],
  ])
    test(`portal view preserves parallax and clips the supporting surface: ${label}`, () => {
      const rig = createPortalViewCamera(),
        source = viewer();
      for (const x of [-0.5, 0, 0.5]) {
        source.position.x = x;
        source.lookAt(entry.center);
        source.updateMatrixWorld();
        const before = source.matrixWorld.clone(),
          projection = source.projectionMatrix.clone();
        assert.equal(rig.update(source, entry, exit), true);
        for (const [px, py] of [
          [0, 0],
          [0.3, 0.5],
          [-0.3, -0.5],
        ]) {
          const incoming = new Vector3(px, py, 0)
            .applyQuaternion(entry.rotation)
            .add(entry.center)
            .project(source);
          const outgoing = new Vector3(-px, py, 0)
            .applyQuaternion(exit.rotation)
            .add(exit.center)
            .project(rig.camera);
          close(incoming.x, outgoing.x);
          close(incoming.y, outgoing.y);
          close(outgoing.z, -1);
        }
        const front = exit.center.clone().addScaledVector(exit.normal, 0.2).project(rig.camera);
        const behind = exit.center.clone().addScaledVector(exit.normal, -0.2).project(rig.camera);
        assert.ok(front.z > -1 && front.z < 1, "room beyond the exit remains visible");
        assert.ok(behind.z < -1, "supporting wall and room behind exit are clipped");
        assert.deepEqual(source.matrixWorld, before);
        assert.deepEqual(source.projectionMatrix, projection);
      }
    });

  test("portal views skip back faces, near-plane singularities and off-screen openings", () => {
    const rig = createPortalViewCamera(),
      source = viewer(),
      exit = anchor([4, 1.18, 0], [1, 0, 0]);
    source.position.z = -1;
    assert.equal(rig.update(source, entry, exit), false);
    source.position.z = 0.001;
    assert.equal(rig.update(source, entry, exit), false);
    source.position.z = 3;
    source.lookAt(0, 1.52, 10);
    assert.equal(rig.update(source, entry, exit), false);
    source.lookAt(entry.center);
    assert.equal(rig.update(source, entry, exit), true);
    assert.ok(rig.camera.projectionMatrix.elements.every(Number.isFinite));
  });

  for (const fails of [false, true])
    test(`portal capture bounds GPU resources and restores host state${fails ? " after render failure" : ""}`, () => {
      const capture = createPortalViewRenderer(),
        scene = new Scene(),
        camera = viewer();
      const live = new Mesh(),
        alreadyHidden = new Mesh(),
        membrane = new Mesh(),
        exitFrame = new Mesh();
      const exit = anchor([4, 1.18, 0], [1, 0, 0]);
      exitFrame.userData.portalAnchor = exit;
      live.userData.portalLiveView = true;
      alreadyHidden.userData.portalLiveView = true;
      alreadyHidden.visible = false;
      scene.add(live, alreadyHidden, membrane, exitFrame);
      const originalTarget = { name: "host" },
        originalViewport = new Vector4(2, 3, 400, 300),
        originalScissor = new Vector4(4, 5, 100, 90);
      let bound = originalTarget,
        face = 2,
        mip = 1,
        viewport = originalViewport.clone(),
        scissor = originalScissor.clone(),
        scissorTest = true;
      const renderer = {
        autoClear: false,
        xr: { enabled: true },
        shadowMap: { autoUpdate: true, needsUpdate: true },
        getDrawingBufferSize: (out) => out.set(2560, 1600),
        getRenderTarget: () => bound,
        getActiveCubeFace: () => face,
        getActiveMipmapLevel: () => mip,
        getViewport: (out) => out.copy(viewport),
        getScissor: (out) => out.copy(scissor),
        getScissorTest: () => scissorTest,
        setRenderTarget: (t, f = 0, m = 0) => {
          bound = t;
          face = f;
          mip = m;
        },
        setViewport: (v) => viewport.copy(v),
        setScissor: (v) => scissor.copy(v),
        setScissorTest: (v) => (scissorTest = v),
        render(s, c) {
          assert.equal(s, scene);
          assert.equal(c, camera);
          assert.equal(bound, capture.target);
          assert.equal(live.visible, false);
          assert.equal(alreadyHidden.visible, false);
          assert.equal(membrane.visible, true);
          assert.equal(exitFrame.visible, false, "destination frame must not overlap its own view");
          assert.equal(this.xr.enabled, false);
          assert.equal(this.shadowMap.needsUpdate, false);
          assert.equal(scissorTest, false);
          if (fails) throw new Error("capture failed");
        },
      };
      if (fails)
        assert.throws(() => capture.render(renderer, scene, camera, exit), /capture failed/);
      else capture.render(renderer, scene, camera, exit);
      assert.equal(capture.target.width, 1024);
      assert.equal(capture.target.height, 640);
      assert.equal(bound, originalTarget);
      assert.equal(face, 2);
      assert.equal(mip, 1);
      assert.deepEqual(viewport, originalViewport);
      assert.deepEqual(scissor, originalScissor);
      assert.equal(scissorTest, true);
      assert.equal(renderer.autoClear, false);
      assert.equal(renderer.xr.enabled, true);
      assert.deepEqual(renderer.shadowMap, { autoUpdate: true, needsUpdate: true });
      assert.equal(live.visible, true);
      assert.equal(alreadyHidden.visible, false);
      assert.equal(exitFrame.visible, true);
      let disposed = false;
      capture.target.addEventListener("dispose", () => (disposed = true));
      capture.dispose();
      assert.equal(disposed, true);
    });
});
