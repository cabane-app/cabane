import type { SceneModelProps } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../construction/rounded-furniture-panel";
export function WoodBunkBed({ size, variant = "default" }: SceneModelProps) {
  const endLadder = variant === "ladder-front" || variant === "ladder-back";
  const ladderSide = variant === "ladder-left" ? -1 : 1;
  const ladderEnd = variant === "ladder-back" ? -1 : 1;
  const framePostX = endLadder ? 0.4775 : 0.46;
  const frameWidth = endLadder ? 0.955 : 0.92;

  return (
    <group
      name="wood-bunk-bed"
      userData={{ walkCollider: true }}
      scale={[size[0] / 1.015, size[1] / 1.6, size[2] / 2.08]}
    >
      <group position={[endLadder ? 0 : -0.0175 * ladderSide, 0, 0]}>
        {[-framePostX, framePostX].flatMap((x) =>
          [-1, 1].map((z) => (
            <Panel
              key={`${x}-${z}`}
              size={[0.06, 1.6, 0.08]}
              position={[x, 0.8, z]}
              color="#d4bf98"
              radius={0.003}
            />
          )),
        )}
        {[0.29, 1.25].map((y, i) => (
          <group key={y}>
            <Panel size={[frameWidth, 0.06, 2]} position={[0, y, 0]} color="#c9b089" />
            <Panel
              size={[0.9, 0.14, 1.98]}
              position={[0, y + 0.1, 0]}
              color={i === 0 ? "#647f90" : "#eee1c8"}
              radius={0.02}
            />
            <Panel
              size={[0.68, 0.1, 0.38]}
              position={[0, y + 0.22, -0.72]}
              color={i === 0 ? "#c4c1b7" : "#e4dbc4"}
            />
            {[-framePostX, framePostX].map((x) => (
              <Panel key={x} size={[0.04, 0.14, 2]} position={[x, y + 0.11, 0]} color="#d4bf98" />
            ))}
          </group>
        ))}
        {[-framePostX, framePostX].map((x) => (
          <Panel key={x} size={[0.03, 0.08, 2]} position={[x, 1.56, 0]} color="#d4bf98" />
        ))}
        {[-1, 1].map((z) => (
          <Panel key={z} size={[frameWidth, 0.08, 0.03]} position={[0, 1.56, z]} color="#d4bf98" />
        ))}
        {endLadder
          ? [-0.22, 0.22].map((x) => (
              <Panel
                key={x}
                name="bunk-ladder-post"
                size={[0.045, 1.57, 0.035]}
                position={[x, 0.785, ladderEnd]}
                color="#d4bf98"
              />
            ))
          : [-0.22, 0.22].map((z) => (
              <Panel
                key={z}
                name="bunk-ladder-post"
                size={[0.035, 1.57, 0.045]}
                position={[0.5025 * ladderSide, 0.785, z + 0.53]}
                color="#d4bf98"
              />
            ))}
        {[0.28, 0.57, 0.86, 1.15].map((y) => (
          <Panel
            key={y}
            name="bunk-ladder-rung"
            size={endLadder ? [0.44, 0.045, 0.045] : [0.045, 0.045, 0.44]}
            position={endLadder ? [0, y, ladderEnd] : [0.5025 * ladderSide, y, 0.53]}
            color="#d4bf98"
          />
        ))}
      </group>
    </group>
  );
}
