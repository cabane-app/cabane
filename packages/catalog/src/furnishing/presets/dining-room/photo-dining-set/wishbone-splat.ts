import { ExtrudeGeometry, Shape } from "three";

// The chairmaker's fork widens into two shoulders under the bentwood rail.
const fork = new Shape();
fork.moveTo(-0.022, 0.438);
fork.bezierCurveTo(-0.016, 0.567, -0.033, 0.653, -0.115, 0.752);
fork.lineTo(-0.09, 0.761);
fork.bezierCurveTo(-0.04, 0.707, -0.012, 0.676, 0, 0.635);
fork.bezierCurveTo(0.012, 0.676, 0.04, 0.707, 0.09, 0.761);
fork.lineTo(0.115, 0.752);
fork.bezierCurveTo(0.033, 0.653, 0.016, 0.567, 0.022, 0.438);
fork.closePath();
export const wishboneSplat = new ExtrudeGeometry(fork, {
  depth: 0.012,
  bevelThickness: 0.0035,
  bevelSize: 0.003,
  bevelSegments: 2,
  curveSegments: 8,
});
const surface = wishboneSplat.attributes.position;
for (let i = 0; i < surface.count; i++) {
  const t = (surface.getY(i) - 0.438) / 0.323;
  surface.setZ(i, surface.getZ(i) - 0.174 - 0.03 * t);
}
wishboneSplat.computeVertexNormals();
