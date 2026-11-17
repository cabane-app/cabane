import { raycastWalkScene, useCabaneDom, type WalkToolProps } from "@cabane/engine";
import { Html } from "@react-three/drei";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Matrix3, Raycaster, Scene, Vector2, Vector3, type PerspectiveCamera } from "three";
import { GunPortals, type PortalControls } from "./portals";
import { LaserTutorial } from "./LaserTutorial";
import { LaserTouchActions } from "./LaserTouchActions";
import { LaserCrosshair } from "./LaserCrosshair";
import type { PortalColor } from "./portals/portal-contract";
import { LaserGun } from "./LaserGun";
import { useLaserShots } from "./useLaserShots";
import { LaserShot } from "./LaserShot";
import { LaserShotWarmup } from "./LaserShotWarmup";
import { createShotGate } from "./shot-gate";
import { ComicPew, useMuzzleAnchor } from "./comic-pew";
import "./laser.css";

export function LaserWalkTool({
  enabled,
  pointerLocked,
  coarsePointer,
  reducedMotion,
  navigation,
  canActivateTarget,
  activateTarget,
}: WalkToolProps) {
  const { camera, scene, gl } = useThree();
  const dom = useCabaneDom();
  const gun = useRef<Group>(null);
  const muzzle = useRef<Group>(null);
  const portalControls = useRef<PortalControls>(null);
  const weaponScene = useMemo(() => new Scene(), []);
  useEffect(() => {
    void gl.compileAsync(weaponScene, camera);
  }, [gl, weaponScene, camera]);
  const { shots, triggerId, triggerColor, recoil, emitShot } = useLaserShots(
    muzzle,
    camera,
    reducedMotion,
  );
  const comicAnchor = useMuzzleAnchor(muzzle);
  const shot = shots.at(-1);
  const [nextPortal, setNextPortal] = useState<PortalColor>("blue");
  const [aim, setAim] = useState<string | null>(null);
  const lastAim = useRef<string | null>(null);
  const motion = useRef({ previous: camera.position.clone(), speed: 0, phase: 0, time: 0 });
  const gate = useMemo(() => createShotGate(), []);
  const raycaster = useMemo(() => new Raycaster(), []);
  const center = useMemo(() => new Vector2(), []);
  const ready = enabled && (coarsePointer || pointerLocked);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useFrame((_, delta) => {
    const pose = motion.current;
    const distance = Math.hypot(
      camera.position.x - pose.previous.x,
      camera.position.z - pose.previous.z,
    );
    const speed = ready && delta > 0 && distance < 0.5 ? distance / delta : 0;
    pose.previous.copy(camera.position);
    pose.speed += (Math.min(speed, 5) - pose.speed) * (1 - Math.exp(-10 * delta));
    pose.time += delta;
    pose.phase += delta * (7 + pose.speed * 2.5);
    const weight = reducedMotion ? 0 : Math.min(pose.speed / 2, 1.6);
    const sway = reducedMotion
      ? 0
      : Math.sin(pose.time * 1.6) * 0.0015 + Math.sin(pose.phase) * 0.004 * weight;
    const bob = reducedMotion
      ? 0
      : Math.cos(pose.time * 2) * 0.0015 + Math.cos(pose.phase * 2) * 0.003 * weight;
    if (gun.current) {
      recoil.current *= Math.exp(-18 * delta);
      const lens = camera as PerspectiveCamera;
      const height = 2 * 0.6 * Math.tan((lens.fov * Math.PI) / 360);
      const width = height * lens.aspect;
      gun.current.scale.setScalar(Math.min(0.58, width * 0.56));
      gun.current.position.set(
        width * 0.23 + sway,
        -height * 0.14 + bob - weight * 0.004,
        -0.6 + (reducedMotion ? 0 : recoil.current),
      );
      gun.current.position.applyQuaternion(camera.quaternion).add(camera.position);
      gun.current.quaternion.copy(camera.quaternion);
      if (!reducedMotion) {
        gun.current.rotateX(recoil.current * 0.9);
        gun.current.rotateZ(sway * 2);
      }
    }
    if (!ready) {
      if (lastAim.current !== null) {
        lastAim.current = null;
        setAim(null);
      }
      return;
    }
    raycaster.setFromCamera(center, camera);
    const { target } = raycastWalkScene(raycaster, scene);
    const label = target && canActivateTarget(target) ? target.label : null;
    if (label !== lastAim.current) {
      lastAim.current = label;
      setAim(label);
    }
  });

  // Draw the small view model after the host scene. Its own depth buffer keeps
  // the toy solid while preventing walls from clipping it; no world-scene mutation.
  useFrame(({ gl }) => {
    if (!enabled) return;
    const autoClear = gl.autoClear;
    try {
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(weaponScene, camera);
    } finally {
      gl.autoClear = autoClear;
    }
  }, 2);

  const fire = useCallback(() => {
    if (!readyRef.current) return;
    void gate(performance.now(), async () => {
      // Resolve at trigger time, not from a previous frame's React state.
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(center, camera);
      const { hit, target } = raycastWalkScene(raycaster, scene);
      const removed = portalControls.current?.remove(raycaster.ray, hit?.distance ?? 30);
      if (removed) {
        emitShot({ end: removed.point, normal: removed.normal, hit: true, scorch: false });
        return;
      }
      const end = hit?.point.clone() ?? raycaster.ray.at(30, new Vector3());
      const normal = hit?.face?.normal
        .clone()
        .applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld))
        .normalize();
      if (normal && normal.dot(raycaster.ray.direction) > 0) normal.negate();
      emitShot({ end, hit: Boolean(hit), ...(normal === undefined ? {} : { normal: normal }) });
      if (target) await activateTarget(target);
    });
  }, [activateTarget, camera, center, gate, raycaster, emitShot, scene]);

  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      if (!readyRef.current || coarsePointer || event.button !== 0 || !dom.root.pointerLockElement)
        return;
      event.preventDefault();
      fire();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        !readyRef.current ||
        event.code !== "KeyF" ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, select, [contenteditable=true]"))
      )
        return;
      event.preventDefault();
      fire();
    };
    dom.events.addEventListener("pointerdown", pointer);
    dom.events.addEventListener("keydown", keyboard);
    return () => {
      dom.events.removeEventListener("pointerdown", pointer);
      dom.events.removeEventListener("keydown", keyboard);
    };
  }, [coarsePointer, dom.events, dom.root, fire]);

  const portalShot = useCallback(
    (end: Vector3, normal: Vector3, color: string, nextColor: PortalColor) => {
      setNextPortal(nextColor);
      emitShot({ end, normal, color, hit: true, scorch: false });
    },
    [emitShot],
  );

  return (
    <>
      <GunPortals
        active={ready}
        navigation={navigation}
        reducedMotion={reducedMotion}
        onPlaced={portalShot}
        onNextColor={setNextPortal}
        controls={portalControls}
      />
      {createPortal(
        <>
          <ambientLight intensity={1.1} />
          <directionalLight position={[-2, 4, 3]} intensity={2.2} />
          <group ref={gun}>
            <LaserGun muzzleRef={muzzle} shotId={shot?.id ?? 0} />
          </group>
        </>,
        weaponScene,
      )}
      {!reducedMotion && <LaserShotWarmup />}
      {shots.map((item) => (
        <LaserShot key={item.id} shot={item} />
      ))}
      {/* Screen-space HUD remains visible regardless of the world origin behind the camera. */}
      <Html
        onOcclude={() => undefined}
        fullscreen
        calculatePosition={(_, __, size) => [size.width / 2, size.height / 2]}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        {enabled && (
          <div className="walk-laser" data-ready={ready}>
            <LaserTutorial coarsePointer={coarsePointer} />
            <ComicPew
              shotId={triggerId}
              shotColor={triggerColor}
              anchor={comicAnchor}
              reducedMotion={reducedMotion}
            />
            <LaserCrosshair
              target={Boolean(aim)}
              desktop={!coarsePointer}
              ready={ready}
              nextPortal={nextPortal}
            />
            {coarsePointer && (
              <LaserTouchActions
                ready={ready}
                nextPortal={nextPortal}
                zap={fire}
                portal={() => portalControls.current?.place()}
              />
            )}
          </div>
        )}
      </Html>
    </>
  );
}
