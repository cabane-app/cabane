import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../construction";

export const CARPORT_SIZE = [3.6, 3, 5.6] as const;

/** Open-sided single-car shelter. Only its posts obstruct walking below the roof. */
export function Carport({
  size = CARPORT_SIZE,
  variant = "default",
  color,
}: {
  size?: SceneItemSize;
  variant?: string;
  color?: string | undefined;
}) {
  const timber = variant === "timber";
  const solar = variant === "solar";
  const frame = color ?? (timber ? "#ae8052" : "#465257");
  const eaves = timber ? 2.4 : 2.78;
  const pitch = Math.atan2(0.5, 1.8);
  const roofThickness = 0.08;
  const roofLength = (1.8 - roofThickness * Math.sin(pitch)) / Math.cos(pitch);
  const roofRise = roofLength * Math.sin(pitch) + roofThickness * Math.cos(pitch);
  return (
    <group
      name="carport"
      scale={size.map((axis, i) => axis / CARPORT_SIZE[i]!) as [number, number, number]}
    >
      {[-1.52, 1.52].flatMap((x) =>
        [-2.4, 2.4].map((z) => (
          <group key={`${x}-${z}`} userData={{ walkCollider: true }}>
            <RoundedFurniturePanel
              name="carport-post"
              size={[0.16, eaves, 0.16]}
              position={[x, eaves / 2, z]}
              color={frame}
              radius={0.012}
            />
            <RoundedFurniturePanel
              name="carport-post-foot"
              size={[0.24, 0.06, 0.24]}
              position={[x, 0.03, z]}
              color="#6f7473"
              radius={0.01}
              outline={false}
            />
          </group>
        )),
      )}
      {[-1.52, 1.52].map((x) => (
        <RoundedFurniturePanel
          key={x}
          name="carport-side-beam"
          size={[0.18, 0.2, 5.3]}
          position={[x, eaves - 0.03, 0]}
          color={frame}
          radius={0.012}
        />
      ))}
      {[-2.4, 0, 2.4].map((z) => (
        <RoundedFurniturePanel
          key={z}
          name="carport-crossbeam"
          size={[3.2, 0.16, 0.14]}
          position={[0, eaves + (timber ? 0.04 : 0), z]}
          color={frame}
          radius={0.01}
        />
      ))}
      {timber ? (
        <>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              name="carport-pitched-roof"
              position={[side * 0.9, 3 - roofRise / 2, 0]}
              rotation={[0, 0, -side * pitch]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[roofLength, roofThickness, 5.6]} />
              <ToonMaterial color="#835b4b" />
            </mesh>
          ))}
          <RoundedFurniturePanel
            name="carport-ridge-beam"
            size={[0.14, 0.16, 5.3]}
            position={[0, 2.85, 0]}
            color={frame}
            radius={0.01}
          />
          {[-2.4, 2.4].map((z) => (
            <RoundedFurniturePanel
              key={z}
              name="carport-king-post"
              size={[0.14, 0.44, 0.14]}
              position={[0, 2.66, z]}
              color={frame}
              radius={0.006}
            />
          ))}
        </>
      ) : (
        <>
          <RoundedFurniturePanel
            name="carport-flat-roof"
            size={[3.6, solar ? 0.12 : 0.22, 5.6]}
            position={[0, solar ? 2.84 : 2.89, 0]}
            color={solar ? "#7b8587" : "#c3c6bd"}
            radius={0.018}
            outlineColor="#646e70"
          />
          {solar &&
            [-1.15, 0, 1.15].flatMap((x) =>
              [-2.05, -0.69, 0.69, 2.05].map((z) => (
                <group key={`${x}-${z}`}>
                  <RoundedFurniturePanel
                    name="carport-solar-frame"
                    size={[1.1, 0.088, 1.3]}
                    position={[x, 2.944, z]}
                    color="#88979f"
                    radius={0.008}
                    outline={false}
                  />
                  <RoundedFurniturePanel
                    name="carport-solar-cell"
                    size={[1.04, 0.012, 1.24]}
                    position={[x, 2.994, z]}
                    color="#29495e"
                    radius={0.004}
                    outline={false}
                  />
                </group>
              )),
            )}
        </>
      )}
    </group>
  );
}
