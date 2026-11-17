import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../construction";

export const THREE_DOOR_SIDEBOARD_SIZE = [1.6, 0.82, 0.45] as const;

/** Frame-and-panel leaves with recessed fields, raised mullions and bronze bridge pulls. */
export function ThreeDoorSideboard({ size = THREE_DOOR_SIDEBOARD_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="three-door-sideboard"
      scale={[size[0] / 1.6, size[1] / 0.82, size[2] / 0.45]}
      userData={{ walkCollider: true }}
    >
      {[-0.68, 0.68].flatMap((x) =>
        [-0.163, 0.163].map((z) => (
          <mesh
            key={x + ":" + z}
            position={[x, 0.075, z]}

            castShadow
          >
            <cylinderGeometry args={[0.054, 0.034, 0.15, 4, 1, false, Math.PI / 4]} />
            <ToonMaterial color="#a67d50" />
          </mesh>
        )),
      )}
      <Panel
        size={[1.51, 0.605, 0.378]}
        position={[0, 0.4485, -0.02]}
        color="#b08b5f"
        outline={false}
      />
      <Panel
        size={[1.53, 0.036, 0.406]}
        position={[0, 0.151, -0.004]}
        color="#c69f70"
        outline={false}
      />
      <Panel
        size={[1.53, 0.028, 0.41]}
        position={[0, 0.758, -0.004]}
        color="#b89869"
        outline={false}
      />
      {[-0.495, 0, 0.495].map((x) => (
        <group key={x} position={[x, 0.46, 0]}>
          <Panel
            name="sideboard-door"
            size={[0.485, 0.558, 0.028]}
            position={[0, 0, 0.178]}
            color="#cda975"
            outline={false}
          />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Panel
                size={[0.036, 0.558, 0.022]}
                position={[s * 0.2245, 0, 0.196]}
                color="#d9b987"
                outline={false}
              />
              <Panel
                size={[0.413, 0.038, 0.022]}
                position={[0, s * 0.26, 0.196]}
                color="#d9b987"
                outline={false}
              />
              <mesh position={[0.194, s * 0.042, 0.206]}>
                <boxGeometry args={[0.014, 0.014, 0.026]} />
                <ToonMaterial color="#81694e" />
              </mesh>
            </group>
          ))}
          <Panel
            name="sideboard-handle"
            size={[0.012, 0.104, 0.009]}
            position={[0.194, 0, 0.22]}
            color="#937856"
            radius={0.003}
            outline={false}
          />
        </group>
      ))}
      <Panel
        size={[1.6, 0.05, 0.45]}
        position={[0, 0.795, 0]}
        color="#d8b47e"
        radius={0.011}
        outlineColor="#a38660"
      />
    </group>
  );
}
