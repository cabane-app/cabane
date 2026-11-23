import { Canvas, type CanvasProps } from "@react-three/fiber";
import { Component } from "react";
import { WebGLRenderer, type RenderItem } from "three";
import { DashboardFallbackReady, DashboardRenderFailureContext } from "./DashboardSceneReady";

type OpaqueRenderItem = RenderItem & { material: { id: number } };

/** R3F configures the renderer asynchronously, outside React's error boundaries.
 * Initialize the same canvas in its ref so a failed context can show recovery UI. */
export class DashboardCanvas extends Component<
  Omit<CanvasProps, "gl"> & { antialias: boolean },
  { failed: boolean }
> {
  override state = { failed: false };
  private renderer: WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private unclaimed: WebGLRenderer | null = null;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  private fail = (error: unknown) => {
    console.error("Could not render the home", error);
    this.setState({ failed: true });
  };
  private releaseUnclaimed() {
    if (!this.unclaimed) return;
    this.unclaimed.dispose();
    this.unclaimed.forceContextLoss();
    this.unclaimed = this.renderer = null;
  }
  private claimRenderer = () => {
    // Fiber owns context teardown once it configures its root at a positive size.
    this.unclaimed = null;
    return this.renderer!;
  };
  private prepare = (canvas: HTMLCanvasElement | null) => {
    this.canvas = canvas;
    if (!canvas) {
      // Fiber's imperative ref can detach and reattach in the same commit,
      // including the StrictMode setup probe. Release only after a real detach.
      if (this.unclaimed)
        queueMicrotask(() => {
          if (!this.canvas) this.releaseUnclaimed();
        });
      return;
    }
    if (this.renderer?.domElement === canvas) return;
    this.releaseUnclaimed();
    try {
      const renderer = new WebGLRenderer({
        canvas,
        alpha: false,
        powerPreference: "high-performance",
        antialias: this.props.antialias,
      });
      // Switching shaders makes Three refresh every scene-light uniform. Keep
      // opaque draws on the same program together within their authored order.
      const programId = (material: object) =>
        (renderer.properties.get(material) as { currentProgram?: { id: number } }).currentProgram
          ?.id ?? -1;
      renderer.setOpaqueSort(
        (a: OpaqueRenderItem, b: OpaqueRenderItem) =>
          a.groupOrder - b.groupOrder ||
          a.renderOrder - b.renderOrder ||
          programId(a.material) - programId(b.material) ||
          a.material.id - b.material.id ||
          a.z - b.z ||
          a.id - b.id,
      );
      this.unclaimed = this.renderer = renderer;
    } catch (error) {
      this.fail(error);
    }
  };
  override render() {
    if (this.state.failed) {
      return (
        <div className="scene-loading" role="alert">
          The 3D view couldn’t be displayed. Check that WebGL is enabled and reload the page.
          <DashboardFallbackReady />
        </div>
      );
    }
    const { antialias: _antialias, children, ...props } = this.props;
    return (
      <DashboardRenderFailureContext.Provider value={this.fail}>
        <Canvas {...props} ref={this.prepare} gl={this.claimRenderer}>
          {children}
        </Canvas>
      </DashboardRenderFailureContext.Provider>
    );
  }
}
