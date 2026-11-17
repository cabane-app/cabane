import { RoundedFurniturePanel } from "../construction";
import { Outlines, ToonMaterial } from "@cabane/engine";
import { CatmullRomCurve3, LatheGeometry, TubeGeometry, Vector2, Vector3 } from "three";
import { boundRim, wickerCourses, wickerShell } from "./towel-basket-weave";

const towel = new LatheGeometry(
  [
    [0, -0.119],
    [0.037, -0.119],
    [0.043, -0.116],
    [0.045, -0.109],
    [0.045, 0.109],
    [0.043, 0.116],
    [0.038, 0.119],
    [0, 0.119],
  ].map(([r, y]) => new Vector2(r, y)),
  20,
);
const hem = new TubeGeometry(
  new CatmullRomCurve3(
    Array.from({ length: 39 }, (_, i) => {
      const t = i / 38,
        a = t * 2 * Math.PI * 1.55,
        r = 0.004 + 0.034 * t;
      return new Vector3(r * Math.cos(a), 0.119, r * Math.sin(a));
    }),
  ),
  32,
  0.0018,
  4,
  false,
);
export function WickerTowelBasket({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="wicker-towel-basket">
      <mesh
        name="tapered-wicker-body"
        geometry={wickerShell}
        dispose={null}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#ad805b" />
      </mesh>
      <mesh
        name="woven-willow-courses"
        geometry={wickerCourses}
        dispose={null}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#b38961" />
      </mesh>
      <mesh name="bound-top-edge" geometry={boundRim} dispose={null} castShadow>
        <ToonMaterial color="#a97952" />
        <Outlines color="#816043" thickness={0.0012} screenspace={false} />
      </mesh>
      <RoundedFurniturePanel
        name="folded-bath-sheet"
        size={[0.298, 0.211, 0.221]}
        position={[0, 0.125, 0.005]}
        radius={0.024}
        outline={false}
        color={color ?? "#dbd4c6"}
      />
      {[-0.103, 0, 0.103].map((x, i) => (
        <group
          key={x}
          position={[x, 0.27, 0.004 * (i - 1)]}
          rotation={[Math.PI / 2, 0, (i - 1) * 0.025]}
        >
          <mesh name="rolled-cotton-towel" geometry={towel} dispose={null} castShadow receiveShadow>
            <ToonMaterial color={color ?? "#eeeae1"} />
          </mesh>
          <mesh name="towel-selvedge" geometry={hem} dispose={null}>
            <ToonMaterial color={color ?? "#d6cfbd"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
