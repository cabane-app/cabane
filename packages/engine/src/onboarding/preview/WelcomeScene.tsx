import { Canvas } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ArchitectureScene } from "../../ArchitectureScene";
import { useHomeAssistantRuntime } from "../../HomeAssistantRuntime";
import { StylizedScene } from "../../StylizedScene";
import { DioramaFrameContext } from "../../architecture-scene/DioramaGround";
import { resolveHomeAssistantBindings } from "../../home-assistant-resolver";
import { resolveOpeningPositions } from "../../opening-pose";
import { worldBoundsForFloorScene } from "../../pools/pool-footprint";
import { useDocumentVisible } from "../../scene-input-preferences";
import type { RuntimeBindingProfileManager } from "../../RuntimeBindingSetup";
import type { ArchitectureModelRegistry, DeviceModelRegistry, HomeManifest } from "../../types";
import { WelcomeLighting } from "./WelcomeLighting";
import { WelcomeOrbitCamera } from "./WelcomeOrbitCamera";
import { WelcomeWalkCamera } from "./WelcomeWalkCamera";
import type { useWelcomePreview } from "./useWelcomePreview";
import { WELCOME_WALK_HOLD_MS } from "./welcome-walk-input";

const ignoreInteraction = () => undefined;
const TAP_DISTANCE = 8;

type PreviewPress = { canvas: HTMLCanvasElement; id: number; x: number; y: number; time: number };

function isNearPress(event: PointerEvent, press: PreviewPress) {
  return Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TAP_DISTANCE;
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <UnavailablePreview /> : this.props.children;
  }
}

function UnavailablePreview() {
  return <p className="welcome-scene__unavailable">The 3D preview is unavailable.</p>;
}

export function WelcomeScene({
  manifest,
  architectureModels,
  deviceModels,
  manager,
  preview,
  onInvite,
}: {
  manifest: HomeManifest;
  architectureModels: ArchitectureModelRegistry;
  deviceModels: DeviceModelRegistry;
  manager: RuntimeBindingProfileManager;
  preview: ReturnType<typeof useWelcomePreview>;
  onInvite: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const press = useRef<PreviewPress | null>(null);
  const [inView, setInView] = useState(false);
  const documentVisible = useDocumentVisible();
  const runtime = useHomeAssistantRuntime();
  const bindings = useMemo(
    () => resolveHomeAssistantBindings(manifest, manager.profile, runtime, deviceModels),
    [manifest, manager.profile, runtime, deviceModels],
  );
  const openingPositions = useMemo(
    () => resolveOpeningPositions(new Set(), bindings.openings, new Map()),
    [bindings.openings],
  );
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const walk = preview.mode === "walk";
  const ground = preview.ground;
  const groundFrame = useMemo(() => {
    if (!ground || manifest.home.apartmentFloor) return null;
    const bounds = worldBoundsForFloorScene(ground);
    return { width: bounds.width + 1.8, depth: bounds.depth + 1.8 };
  }, [ground, manifest.home.apartmentFloor]);
  const wholeBuilding = !walk && preview.orbitStage === "Roof";
  const activeFloor = !walk && preview.orbitStage === "Upstairs" ? preview.upper : ground;
  const playing = documentVisible && inView && preview.playing;

  const startPress = (event: PointerEvent) => {
    press.current = null;
    if (!(event.target instanceof HTMLCanvasElement)) return;
    preview.pause();
    if (event.isPrimary && event.button === 0) {
      press.current = {
        canvas: event.target,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
      };
    }
  };

  const finishPress = (event: PointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start || start.id !== event.pointerId || !isNearPress(event, start)) return;
    if (event.pointerType === "touch" && event.timeStamp - start.time >= WELCOME_WALK_HOLD_MS)
      return;
    const { left, right, top, bottom } = start.canvas.getBoundingClientRect();
    if (
      event.clientX >= left &&
      event.clientX <= right &&
      event.clientY >= top &&
      event.clientY <= bottom
    ) {
      onInvite();
    }
  };

  return (
    <div
      ref={host}
      className="welcome-scene"
      data-view={preview.mode}
      onPointerDownCapture={startPress}
      onPointerMoveCapture={(event) => {
        if (press.current?.id === event.pointerId && !isNearPress(event, press.current)) {
          press.current = null;
        }
      }}
      onPointerUpCapture={finishPress}
      onPointerCancelCapture={() => {
        press.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !(event.target instanceof HTMLCanvasElement)) return;
        event.preventDefault();
        preview.pause();
        onInvite();
      }}
    >
      {ground && activeFloor ? (
        <PreviewBoundary>
          <Canvas
            aria-label={walk ? "First-person view of the demo home" : "3D cutaway of the demo home"}
            fallback={<UnavailablePreview />}
            onCreated={({ gl }) => {
              gl.domElement.tabIndex = 0;
              gl.domElement.setAttribute(
                "aria-label",
                "Demo preview. Press Enter for full demo options.",
              );
              gl.domElement.setAttribute("aria-keyshortcuts", "Enter");
            }}
            dpr={[1, 1.25]}
            frameloop={documentVisible ? "demand" : "never"}
            gl={{ alpha: true, antialias: false }}
            shadows="percentage"
          >
            <Suspense fallback={null}>
              <StylizedScene>
                <WelcomeLighting floors={manifest.floors} walk={walk} />
                {walk && preview.loop ? (
                  <WelcomeWalkCamera
                    manifest={manifest}
                    floor={ground}
                    loop={preview.loop}
                    playing={playing}
                    onUnavailable={preview.rejectWalk}
                    onManualInput={preview.pause}
                    advance={preview.advance}
                  />
                ) : (
                  <WelcomeOrbitCamera
                    manifest={manifest}
                    playing={playing}
                    onPause={preview.pause}
                    advance={preview.advance}
                  />
                )}
                <DioramaFrameContext.Provider value={walk ? null : groundFrame}>
                  <ArchitectureScene
                    activeFloorId={activeFloor.id}
                    floorView={wholeBuilding ? "whole" : "cutaway"}
                    selectedRoomId={null}
                    manifest={manifest}
                    architectureModels={architectureModels}
                    deviceModels={deviceModels}
                    resolvedBindings={bindings}
                    openingPositions={openingPositions}
                    interactionMode="editor"
                    walkMode={walk}
                    wallFadeEnabled={!walk && !wholeBuilding}
                    reducedMotion={preview.reducedMotion}
                    onInteract={ignoreInteraction}
                  />
                </DioramaFrameContext.Provider>
              </StylizedScene>
            </Suspense>
          </Canvas>
        </PreviewBoundary>
      ) : (
        <UnavailablePreview />
      )}
    </div>
  );
}
