import { LatheGeometry, Vector2 } from "three";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { CurvedChairBack } from "./curved-chair-back";

export const OAK_DINING_CHAIR_SIZE = [0.49, 0.82, 0.5] as const;

// Each rear stile is one length of oak from the splayed foot to the backrest.
function chairLeg(rear: boolean) {
  const rings = [
    [0, 0],
    [0.014, 0],
    [0.016, 0.01],
    [0.022, 0.32],
    [0.026, 0.39],
    ...(rear
      ? [
          [0.023, 0.445],
          [0.017, 0.6],
          [0.02, 0.72],
          [0, 0.72],
        ]
      : [
          [0.023, 0.421],
          [0, 0.421],
        ]),
  ];
  const g = new LatheGeometry(
    rings.map(([r, h]) => new Vector2(r, h)),
    12,
  );
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const lower = Math.min(y / 0.42, 1);
    p.setX(i, p.getX(i) + 0.205 - 0.037 * lower);
    p.setZ(
      i,
      p.getZ(i) +
        (rear ? -0.197 + 0.049 * lower - Math.max(0, y - 0.42) * 0.115 : 0.214 - 0.055 * lower),
    );
  }
  g.computeVertexNormals();
  return g;
}
const frontLeg = chairLeg(false);
const backLeg = chairLeg(true);

export function OakDiningChair({
  size = OAK_DINING_CHAIR_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="oak-dining-chair"
      scale={[size[0] / 0.49, size[1] / 0.82, size[2] / 0.5]}
      userData={{ walkCollider: true }}
    >
      {[-1, 1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          {[frontLeg, backLeg].map((geometry, index) => (
            <mesh key={index} name="dining-chair-leg" geometry={geometry} castShadow>
              <ToonMaterial color="#c7a16d" />
            </mesh>
          ))}
          <RoundedFurniturePanel
            name="oak-side-apron"
            size={[0.03, 0.056, 0.31]}
            position={[0.169, 0.38, 0.006]}
            radius={0.007}
            color="#b69260"
            outline={false}
          />
        </group>
      ))}
      <RoundedFurniturePanel
        size={[0.46, 0.045, 0.47]}
        position={[0, 0.4175, 0.015]}
        color="#c8a572"
        radius={0.018}
      />
      <RoundedFurniturePanel
        name="dining-chair-upholstered-seat"
        size={[0.445, 0.045, 0.435]}
        position={[0, 0.4625, 0.0225]}
        color={color ?? "#e3d7c2"}
        radius={0.019}
      />
      <CurvedChairBack />
    </group>
  );
}
