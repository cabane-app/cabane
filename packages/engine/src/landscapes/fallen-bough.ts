import { withStockShadowDepth } from "../shadow-map-cache";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Vector3,
  type MeshStandardMaterial,
} from "three";

// Tapered, crooked deadwood with a partly sunken flank and moss along the upward face.
export function fallenBough() {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    surface: number[] = [],
    indices: number[] = [];
  const moss = new Color("#859459"),
    bark = new Color("#b8b1a1"),
    up = new Vector3(0, 1, 0);
  const sweep = (points: number[][]) => {
    const sides = 10,
      start = positions.length / 3;
    const path = points.map(([x, y, z]) => new Vector3(x, y, z));
    let length = 0;
    for (let i = 0; i < path.length; i++) {
      const p = path[i],
        radius = points[i][3];
      const tangent = path[Math.min(path.length - 1, i + 1)]
        .clone()
        .sub(path[Math.max(0, i - 1)])
        .normalize();
      const side = up.clone().cross(tangent).normalize(),
        top = tangent.clone().cross(side);
      if (i) length += p.distanceTo(path[i - 1]);
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2,
          rib = 1 + 0.057 * Math.sin(3 * a + i * 0.56) + 0.04 * Math.cos(5 * a - i * 0.38);
        const n = top.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
        const v = p.clone().addScaledVector(n, radius * rib);
        if (i === 0 || i === path.length - 1) {
          const fracture = 0.19 * Math.sin(a * 3 + 0.5) + 0.12 * Math.cos(a * 5);
          v.addScaledVector(tangent, radius * fracture);
        }
        positions.push(v.x, v.y, v.z);
        surface.push(n.y, 0, 0);
        normals.push(n.x, n.y, n.z);
        uvs.push(j / sides, length * 1.8);
        const c = bark
          .clone()
          .lerp(moss, Math.max(0, n.y) * (0.62 + 0.24 * Math.sin(i + a)))
          .multiplyScalar(0.76 + 0.2 * n.y);
        colors.push(c.r, c.g, c.b);
        if (i && j) {
          const d = start + i * (sides + 1) + j,
            c = d - 1,
            b = d - sides - 1,
            a = b - 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }
    for (const end of [0, path.length - 1]) {
      const ring = start + end * (sides + 1);
      const p = path[end],
        next = path[end ? end - 1 : 1];
      const n = p.clone().sub(next).normalize();
      const cap = positions.length / 3;
      for (let j = 0; j < sides; j++) {
        const src = 3 * (ring + j),
          angle = (j * Math.PI * 2) / sides;
        positions.push(positions[src], positions[src + 1], positions[src + 2]);
        normals.push(n.x, n.y, n.z);
        uvs.push(0.5 + 0.47 * Math.cos(angle), 0.5 + 0.47 * Math.sin(angle));
        colors.push(1, 1, 1);
        surface.push(-2, Math.cos(angle), Math.sin(angle));
      }
      const center = positions.length / 3;
      positions.push(p.x - n.x * 0.013, p.y - n.y * 0.013, p.z - n.z * 0.013);
      normals.push(n.x, n.y, n.z);
      uvs.push(0.5, 0.5);
      colors.push(1, 1, 1);
      surface.push(-2, 0, 0);
      for (let j = 0; j < sides; j++) {
        if (end) indices.push(center, cap + ((j + 1) % sides), cap + j);
        else indices.push(center, cap + j, cap + ((j + 1) % sides));
      }
    }
  };
  sweep([
    [-0.91, 0.08, -0.09, 0.125],
    [-0.63, 0.11, -0.06, 0.135],
    [-0.18, 0.14, 0.04, 0.13],
    [0.21, 0.13, 0.08, 0.1],
    [0.57, 0.12, 0.01, 0.083],
    [0.95, 0.06, -0.11, 0.043],
  ]);
  sweep([
    [0.09, 0.14, 0.07, 0.067],
    [0.26, 0.23, 0.22, 0.048],
    [0.39, 0.24, 0.39, 0.036],
    [0.5, 0.28, 0.47, 0.016],
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("woodSurface", new Float32BufferAttribute(surface, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function fallenBoughMaterial(source: MeshStandardMaterial) {
  const material = source.clone();
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute vec3 woodSurface; varying vec3 vWoodSurface;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n vWoodSurface=woodSurface;",
      );
    shader.fragmentShader =
      "varying vec3 vWoodSurface;\n" +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
      #include <map_fragment>
      #ifdef USE_MAP
        float fibres=texture2D(map,vMapUv*2.8+.17).g;
        if(vWoodSurface.x < -1.) {
          vec2 crosscut=vWoodSurface.yz-vec2(.03,-.08);
          float r=length(crosscut);
          float rings=.5+.5*sin(r*72.+fibres*8.);
          float crack=smoothstep(.015,.065,abs(crosscut.y+.19*crosscut.x+.045*sin(r*8.)));
          diffuseColor.rgb=mix(vec3(.12,.073,.036),vec3(.29,.21,.119),rings*.37+fibres*.53)*(.73+.27*crack);
        } else {
          float mossCover=smoothstep(.2,.69,vWoodSurface.x*.70+fibres*.83+.14*sin(vMapUv.y*6.));
          vec3 moss=mix(vec3(.032,.051,.017),vec3(.12,.15,.053),clamp(fibres*3.1,0.,1.));
          diffuseColor.rgb=mix(diffuseColor.rgb,moss,mossCover*.83);
        }
      #endif
    `,
      );
  };
  material.customProgramCacheKey = () => "fallen-bough";
  return withStockShadowDepth(material);
}
