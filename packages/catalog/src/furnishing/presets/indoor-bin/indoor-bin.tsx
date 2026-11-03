import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";
import { RoundedFurniturePanel } from "../construction";

export const INDOOR_BIN_SIZE = [0.36, 0.62, 0.4] as const;
export const BATHROOM_BIN_SIZE = [0.24, 0.32, 0.28] as const;
export const OFFICE_BIN_SIZE = [0.28, 0.34, 0.28] as const;

const officeProfile = [
  [0, 0],
  [0.39, 0],
  [0.41, 0.015],
  [0.49, 0.96],
  [0.5, 0.98],
  [0.49, 1],
  [0.46, 1],
  [0.45, 0.98],
  [0.37, 0.06],
  [0, 0.06],
].map(([radius, height]) => new Vector2(radius, height));

/** Floor origin; the body and lid follow the native item color. */
export function IndoorBin({
  size,
  variant,
  color,
}: {
  size?: SceneItemSize;
  variant?: string | undefined;
  color?: string | undefined;
}) {
  const nominal =
    variant === "bathroom"
      ? BATHROOM_BIN_SIZE
      : variant === "office"
        ? OFFICE_BIN_SIZE
        : INDOOR_BIN_SIZE;
  const dimensions = size ?? nominal;
  const finish = color ?? "#a7b4aa";
  const office = variant === "office";
  return (
    <group name="indoor-bin" scale={[...dimensions]} userData={{ walkCollider: true }}>
      {office ? (
        <mesh name="open-wastebasket-shell" castShadow receiveShadow>
          <latheGeometry args={[officeProfile, 32]} />
          <ToonMaterial color={finish} />
          <Outlines color="#657269" thickness={0.0015} screenspace={false} />
        </mesh>
      ) : (
        <>
          <RoundedFurniturePanel
            name="rubber-base"
            size={[0.86, 0.06, 0.78]}
            position={[0, 0.03, -0.03]}
            radius={0.025}
            color="#48514e"
            outline={false}
          />
          <RoundedFurniturePanel
            name="bin-body"
            size={[0.94, 0.87, 0.86]}
            position={[0, 0.475, -0.03]}
            radius={0.065}
            color={finish}
            outlineColor="#657269"
          />
          <RoundedFurniturePanel
            name="lid-seal"
            size={[0.96, 0.025, 0.9]}
            position={[0, 0.9175, -0.03]}
            radius={0.01}
            color="#48514e"
            outline={false}
          />
          {(variant === "bathroom" ? [0] : [-0.253, 0.253]).map((x) => (
            <RoundedFurniturePanel
              key={x}
              name="closed-lid"
              size={[variant === "bathroom" ? 1 : 0.494, 0.08, 0.94]}
              position={[x, 0.96, -0.03]}
              radius={0.035}
              color={finish}
              outlineColor="#657269"
            />
          ))}
          <RoundedFurniturePanel
            name="pedal-support"
            size={[0.24, 0.045, 0.16]}
            position={[0, 0.075, 0.39]}
            radius={0.015}
            color="#48514e"
            outline={false}
          />
          <RoundedFurniturePanel
            name="foot-pedal"
            size={[0.4, 0.035, 0.15]}
            position={[0, 0.09, 0.425]}
            radius={0.015}
            color="#777f7b"
            outline={false}
          />
        </>
      )}
    </group>
  );
}
