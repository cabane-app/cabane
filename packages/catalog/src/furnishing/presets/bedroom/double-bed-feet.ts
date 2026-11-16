import { CylinderGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const feet = [-0.7, 0.7].flatMap((x) =>
  [-0.9, 0.9].map((z) => new CylinderGeometry(0.048, 0.033, 0.17, 10).translate(x, 0.085, z)),
);
export const bedFeet = mergeGeometries(feet);
feet.forEach((foot) => foot.dispose());
