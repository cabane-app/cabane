import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { timber } from "./photo-dining-set/dining-construction";
const legs = [-1, 1].flatMap((x) =>
  [-1, 1].map((z) =>
    timber([x * 0.2156, 0, z * 0.2456], [x * 0.155, 0.42, z * 0.12], 0.015, 0.022),
  ),
);
export const whiteChairOakLegs = mergeGeometries(legs);
legs.forEach((g) => g.dispose());
