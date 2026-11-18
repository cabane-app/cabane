import { ToonMaterial } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";

const profile = [
  [0.004, -0.001],
  [0, 0.003],
  [0, 0.036],
  [0.004, 0.042],
  [0.009, 0.0433],
  [0.031, 0.0433],
  [0.036, 0.041],
  [0.041, 0.029],
  [0.045, 0.021],
  [0.045, 0.008],
  [0.004, -0.001],
];

function makeMoulding(span: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  function vertex(along: number, inset: number, z: number, shade: number) {
    positions.push((along - 0.5) * (span - 2 * inset), -inset, z);
    colors.push(shade, shade * 0.99, shade * 0.97);
  }
  for (let i = 1; i < profile.length; i++) {
    const [a, az] = profile[i - 1];
    const [b, bz] = profile[i];
    const shade = i === 8 ? 0.74 : 1;
    vertex(0, a, az, shade);
    vertex(0, b, bz, shade);
    vertex(1, b, bz, shade);
    vertex(0, a, az, shade);
    vertex(1, b, bz, shade);
    vertex(1, a, az, shade);
  }
  // Taper the grain into the flat face between the two crowned edges of each rail.
  for (let line = 0; line < 6; line++) {
    const start = 0.05 + ((line * 13) % 31) / 100;
    const length = 0.31 + ((line * 11) % 27) / 100;
    const edge = (step: number, side: number) => {
      const t = step / 10;
      const center = 0.011 + line * 0.0035 + 0.0014 * Math.sin(t * 5 + line);
      vertex(start + length * t, center + side * Math.sin(Math.PI * t) * 0.0006, 0.044, 0.74);
    };
    for (let j = 0; j < 10; j++) {
      edge(j, -1);
      edge(j, 1);
      edge(j + 1, 1);
      edge(j, -1);
      edge(j + 1, 1);
      edge(j + 1, -1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function OakFrameRails({ width, height }: { width: number; height: number }) {
  const [horizontal, vertical] = useMemo(
    () => [makeMoulding(width), makeMoulding(height)],
    [width, height],
  );
  useEffect(
    () => () => {
      horizontal.dispose();
      vertical.dispose();
    },
    [horizontal, vertical],
  );
  const rails = [
    { name: "top", x: 0, y: height, angle: 0, geometry: horizontal },
    { name: "bottom", x: 0, y: 0, angle: Math.PI, geometry: horizontal },
    { name: "left", x: -width / 2, y: height / 2, angle: Math.PI / 2, geometry: vertical },
    { name: "right", x: width / 2, y: height / 2, angle: -Math.PI / 2, geometry: vertical },
  ];
  return rails.map(({ name, x, y, angle, geometry }) => (
    <mesh
      key={name}
      name={`connected-frame-${name}-rail`}
      geometry={geometry}
      position={[x, y, 0]}
      rotation={[0, 0, angle]}
      castShadow
      receiveShadow
    >
      <ToonMaterial color={geometry === horizontal ? "#c99863" : "#b9824f"} vertexColors />
    </mesh>
  ));
}
