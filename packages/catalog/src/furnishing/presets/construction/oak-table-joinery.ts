import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from "three";
import { horizontalTimber, joinCabinetParts } from "./cabinet-joinery";

/** A radiused plan and a small bullnose around the slab's upper and lower arrises. */
export function easedWorktop(
  width: number,
  height: number,
  depth: number,
  thickness: number,
  radius: number,
) {
  const bevel = 0.004;
  const x = width / 2 - bevel;
  const z = depth / 2 - bevel;
  const s = new Shape();
  s.moveTo(-x + radius, -z);
  s.lineTo(x - radius, -z);
  s.quadraticCurveTo(x, -z, x, -z + radius);
  s.lineTo(x, z - radius);
  s.quadraticCurveTo(x, z, x - radius, z);
  s.lineTo(-x + radius, z);
  s.quadraticCurveTo(-x, z, -x, z - radius);
  s.lineTo(-x, -z + radius);
  s.quadraticCurveTo(-x, -z, -x + radius, -z);
  const slab = new ExtrudeGeometry(s, {
    depth: thickness - 2 * bevel,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  })
    .rotateX(-Math.PI / 2)
    .translate(0, height - thickness + bevel, 0);
  return horizontalTimber(slab);
}

/** Faceted tapered posts and inset rails. The desk leaves its knee opening free. */
export function apronJoinery(
  x: number,
  z: number,
  height: number,
  post: number,
  frontRail: boolean,
) {
  const posts = [];
  const rails = [];
  const pegs = [];
  for (const side of [-1, 1]) {
    const endRail = horizontalTimber(new BoxGeometry(2 * z, 0.064, 0.026))
      .rotateY(Math.PI / 2)
      .translate(side * x, height - 0.032, 0);
    rails.push(endRail);
    for (const end of [-1, 1]) {
      const leg = new CylinderGeometry(
        post / Math.cos(Math.PI / 8),
        post * 0.67,
        height,
        8,
        1,
        false,
        Math.PI / 8,
      );
      // Project the grain along the post before placing it on its foot.
      horizontalTimber(leg.rotateZ(-Math.PI / 2)).rotateZ(Math.PI / 2);
      posts.push(leg.translate(side * x, height / 2, end * z));
      const pin = new CylinderGeometry(0.006, 0.006, 0.008, 8)
        .rotateZ(Math.PI / 2)
        .translate(side * (x + post - 0.002), height - 0.032, end * z);
      pegs.push(pin);
    }
  }
  for (const end of frontRail ? [-1, 1] : [-1]) {
    const railHeight = frontRail ? 0.061 : 0.095;
    rails.push(
      horizontalTimber(new BoxGeometry(2 * x, railHeight, 0.024)).translate(
        0,
        height - railHeight / 2,
        end * z,
      ),
    );
  }
  return {
    posts: joinCabinetParts(posts),
    rails: joinCabinetParts(rails),
    pegs: joinCabinetParts(pegs),
  };
}
