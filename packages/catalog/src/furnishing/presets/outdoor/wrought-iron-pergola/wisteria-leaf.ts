import { BufferGeometry, Float32BufferAttribute } from "three";

// Raised midrib and downturned blade tip, with the petiole at the local origin.
export const wisteriaLeaf = new BufferGeometry();
wisteriaLeaf.setAttribute(
  "position",
  new Float32BufferAttribute(
    [
      0, 0, 0, -0.031, 0.011, 0.052, 0, 0.026, 0.053, 0.031, 0.011, 0.052, -0.034, 0.013, 0.089, 0,
      0.024, 0.094, 0.034, 0.013, 0.089, 0, -0.006, 0.165,
    ],
    3,
  ),
);
wisteriaLeaf.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 5, 2, 5, 6, 2, 6, 3, 4, 7, 5, 5, 7, 6]);
wisteriaLeaf.computeVertexNormals();
