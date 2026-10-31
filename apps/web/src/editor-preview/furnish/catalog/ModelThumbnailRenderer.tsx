import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { OrthographicCamera, Vector3 } from "three";
import { connectedCanvasEvents, ToonMaterial } from "@cabane/engine";
import type { ModelPreviewEntry } from "./model-preview-entry";
import { ModelVisual } from "./ModelVisual";
import { paintThumbnail, readThumbnail, saveThumbnail } from "./thumbnailCache";
import { copyWebGLPreview } from "../../../webgl-preview";

interface Request {
  cacheKey?: string;
  canvas: HTMLCanvasElement;
  entry: ModelPreviewEntry;
  transparent: boolean;
  report: (failed: boolean) => void;
}
const ThumbnailQueue = createContext<(request: Request) => () => void>(() => () => undefined);

class PreviewBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function RendererContextMonitor({ onError }: { onError: () => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onError);
    return () => canvas.removeEventListener("webglcontextlost", onError);
  }, [gl, onError]);
  return null;
}

function ThumbnailScene({
  request,
  aspect,
  done,
}: {
  request: Request;
  aspect: number;
  done: (failed: boolean) => void;
}) {
  const { invalidate, size } = useThree();
  const camera = useRef(new OrthographicCamera(-1, 1, 1, -1, 0.01, 100));
  const drawn = useRef(false);
  const { min, max } = request.entry.definition.bounds;
  const span = Math.max(...max.map((v, i) => v - min[i]), 0.01);
  const center = min.map((v, i) => (v + max[i]) / 2);
  const extents = max.map((v, i) => (v - min[i]) / span);

  useLayoutEffect(() => {
    const { min, max } = request.entry.definition.bounds;
    const span = Math.max(...max.map((v, i) => v - min[i]), 0.01);
    const extents = max.map((v, i) => (v - min[i]) / span);
    const cam = camera.current;
    cam.position.set(3, 2.6, 4);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    let width = 0,
      height = 0;
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        for (const z of [-1, 1]) {
          const p = new Vector3(
            (x * extents[0]) / 2,
            (y * extents[1]) / 2,
            (z * extents[2]) / 2,
          ).applyMatrix4(cam.matrixWorldInverse);
          width = Math.max(width, Math.abs(p.x));
          height = Math.max(height, Math.abs(p.y));
        }
    const aspect = size.width / size.height;
    const halfHeight = Math.max(height, width / aspect, 0.1) * 1.3;
    cam.left = -halfHeight * aspect;
    cam.right = halfHeight * aspect;
    cam.top = halfHeight;
    cam.bottom = -halfHeight;
    cam.updateProjectionMatrix();
    drawn.current = false;
    invalidate();
  }, [request, size.width, size.height, invalidate]);

  useFrame(({ gl, scene }) => {
    if (drawn.current) return;
    let loading = false;
    scene.traverse((object) => {
      if (object.name === "loading-imported-model") loading = true;
    });
    if (loading) return;
    // Canvas measures its resized container asynchronously. Keep the request alive
    // until the renderer and camera match this preview, not the previous tile.
    if (Math.abs(size.width - size.height * aspect) > 1) return;
    drawn.current = true;
    try {
      gl.setClearColor("#ebe9df", request.transparent ? 0 : 1);
      gl.render(scene, camera.current);
      const target = request.canvas;
      if (target.isConnected) {
        const rect = target.getBoundingClientRect();
        const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
        target.width = Math.max(1, Math.round(rect.width * dpr));
        target.height = Math.max(1, Math.round(rect.height * dpr));
        copyWebGLPreview(gl.domElement, target);
        if (request.cacheKey)
          saveThumbnail(
            request.cacheKey.replace(/[^/]+$/, `${target.width}:${target.height}`),
            target,
          );
      }
      done(false);
    } catch {
      done(true);
    }
  }, 1);

  return (
    <>
      <hemisphereLight args={["#fff8e9", "#c1c9b1", 1.5]} />
      <directionalLight position={[3, 7, 5]} intensity={2.1} />
      <group scale={1 / span}>
        <group position={[-center[0], -center[1], -center[2]]}>
          <ModelVisual entry={request.entry} />
        </group>
      </group>
      {[0, 1, 2, 3, 4].map((ring) => (
        <mesh
          key={ring}
          position={[0.01, -extents[1] / 2 - 0.012 - ring * 0.001, 0.01]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[
            Math.max(extents[0] * 0.52, 0.13) * (1 + ring * 0.12),
            Math.max(extents[2] * 0.5, 0.1) * (1 + ring * 0.12),
            1,
          ]}
        >
          <circleGeometry args={[1, 40]} />
          <ToonMaterial color="#aebba0" transparent opacity={0.045} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** One offscreen WebGL context, copied synchronously to ordinary card canvases. */
export function ModelThumbnailRenderer({
  children,
  scrollRoot,
  enabled,
}: {
  children: ReactNode;
  scrollRoot: RefObject<HTMLDivElement | null>;
  enabled: boolean;
}) {
  const pending = useRef(new Map<HTMLCanvasElement, Request>());
  const active = useRef<Request | null>(null);
  const alive = useRef(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [serial, setSerial] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const pump = useCallback(() => {
    if (!alive.current || active.current) return;
    const next = pending.current.values().next().value;
    if (!next) return;
    pending.current.delete(next.canvas);
    active.current = next;
    setRequest(next);
    setSerial((value) => value + 1);
  }, []);
  const done = useCallback(
    (completed: Request, failed: boolean) => {
      if (active.current !== completed) return;
      if (completed.canvas.isConnected) completed.report(failed);
      queueMicrotask(() => {
        if (!alive.current || active.current !== completed) return;
        active.current = null;
        setRequest(null);
        pump();
      });
    },
    [pump],
  );
  useEffect(() => {
    alive.current = true;
    const queue = pending.current;
    return () => {
      alive.current = false;
      queue.clear();
      active.current = null;
    };
  }, []);
  useEffect(() => {
    if (enabled) return;
    pending.current.clear();
    active.current = null;
    setRequest(null);
    setUnavailable(false);
  }, [enabled]);
  const failRenderer = useCallback(() => {
    active.current?.report(true);
    active.current = null;
    pending.current.forEach((job) => job.report(true));
    pending.current.clear();
    setRequest(null);
    setUnavailable(true);
  }, []);
  const register = useCallback(
    (job: Request) => {
      if (!enabled || unavailable) {
        if (unavailable) job.report(true);
        return () => undefined;
      }
      let visible = false;
      let disposed = false;
      let generation = 0;
      let lastSize = "";
      const enqueue = () => {
        if (!visible) return;
        const rect = job.canvas.getBoundingClientRect();
        const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        const key = `${width}:${height}`;
        if (rect.width <= 0 || rect.height <= 0 || key === lastSize) return;
        lastSize = key;
        const token = ++generation;
        const cacheKey = new URL(
          `/__cabane_preview__/${encodeURIComponent(job.entry.key)}/${job.transparent ? "clear" : "opaque"}/${key}`,
          location.origin,
        ).href;
        const current = () =>
          !disposed && visible && generation === token && job.canvas.isConnected;
        void (async () => {
          const blob = await readThumbnail(cacheKey);
          if (!current()) return;
          if (blob && (await paintThumbnail(blob, job.canvas, width, height, current))) {
            job.report(false);
            return;
          }
          if (!current()) return;
          pending.current.set(job.canvas, { ...job, cacheKey });
          pump();
        })();
      };
      const observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible) enqueue();
          else {
            generation++;
            pending.current.delete(job.canvas);
            lastSize = "";
          }
        },
        { root: scrollRoot.current, rootMargin: "145px 0px" },
      );
      observer.observe(job.canvas);
      const resize = new ResizeObserver(enqueue);
      resize.observe(job.canvas);
      return () => {
        disposed = true;
        generation++;
        observer.disconnect();
        resize.disconnect();
        pending.current.delete(job.canvas);
      };
    },
    [pump, scrollRoot, enabled, unavailable],
  );
  const rect = request?.canvas.getBoundingClientRect();
  const ratio = rect && rect.height > 0 ? rect.width / rect.height : 1.2;
  return (
    <ThumbnailQueue.Provider value={register}>
      {children}
      {enabled && !unavailable && serial > 0 && (
        <div
          aria-hidden="true"
          className="catalog-thumbnail-renderer"
          style={{ width: 160 * ratio, height: 160 }}
        >
          <PreviewBoundary onError={failRenderer}>
            <Canvas
              events={connectedCanvasEvents}
              orthographic
              frameloop="demand"
              dpr={Math.min(globalThis.devicePixelRatio || 1, 1.5)}
              gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
              fallback={<span>Preview unavailable</span>}
            >
              <RendererContextMonitor onError={failRenderer} />
              {request && (
                <PreviewBoundary key={serial} onError={() => done(request, true)}>
                  <ThumbnailScene
                    request={request}
                    aspect={ratio}
                    done={(failed) => done(request, failed)}
                  />
                </PreviewBoundary>
              )}
            </Canvas>
          </PreviewBoundary>
        </div>
      )}
    </ThumbnailQueue.Provider>
  );
}

export function ModelThumbnail({
  entry,
  showAdd = true,
  fallback,
  transparent = false,
}: {
  entry: ModelPreviewEntry;
  showAdd?: boolean;
  fallback?: ReactNode;
  transparent?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const register = useContext(ThumbnailQueue);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canvas.current) return;
    setFailed(false);
    return register({ canvas: canvas.current, entry, transparent, report: setFailed });
  }, [entry, register, transparent]);
  return (
    <span className="catalog-card__preview">
      <canvas ref={canvas} aria-hidden="true" />
      {failed && (
        <span className="catalog-card__fallback">{fallback ?? "Preview unavailable"}</span>
      )}
      {showAdd && (
        <span className="catalog-card__plus" aria-hidden="true">
          +
        </span>
      )}
    </span>
  );
}
