import { ToonMaterial } from "@cabane/engine";
import type { DeviceVisualState } from "@cabane/engine";

export const palette = {
  body: "#e7e1d5",
  bodyDark: "#bac2b9",
  charcoal: "#52605b",
  coral: "#d96e4d",
  green: "#729b87",
  amber: "#d4a04c",
  muted: "#8b918c",
  paleBlue: "#9dbfc0",
};

const stateColor = (state: DeviceVisualState) => {
  switch (state) {
    case "connected-active":
      return palette.coral;
    case "connected-inactive":
      return palette.green;
    case "unavailable":
      return palette.amber;
    case "disconnected":
      return palette.muted;
  }
};

export function StatusBeacon({
  visualState,
  position,
  scale = 1,
}: {
  visualState: DeviceVisualState;
  position: readonly [number, number, number];
  scale?: number;
}) {
  return (
    <group name={`device-state-${visualState}`} position={position} scale={scale}>
      {visualState === "disconnected" && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.018, 0.005, 6, 12, Math.PI * 1.55]} />
          <ToonMaterial color={stateColor(visualState)} />
        </mesh>
      )}
      {visualState === "unavailable" && (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.026, 0.026, 0.012]} />
          <ToonMaterial color={stateColor(visualState)} />
        </mesh>
      )}
      {visualState === "connected-inactive" && (
        <mesh>
          <sphereGeometry args={[0.014, 10, 6]} />
          <ToonMaterial color={stateColor(visualState)} />
        </mesh>
      )}
      {visualState === "connected-active" && (
        <group>
          <mesh>
            <sphereGeometry args={[0.016, 10, 6]} />
            <ToonMaterial color={stateColor(visualState)} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.026, 0.004, 5, 12]} />
            <ToonMaterial color={stateColor(visualState)} />
          </mesh>
        </group>
      )}
    </group>
  );
}
