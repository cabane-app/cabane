import { Canvas, type CanvasProps } from "@react-three/fiber";
import { Component } from "react";
import { WebGLRenderer } from "three";
import { DashboardFallbackReady, DashboardRenderFailureContext } from "./DashboardSceneReady";

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
      this.unclaimed = this.renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        powerPreference: "high-performance",
        antialias: this.props.antialias,
      });
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
