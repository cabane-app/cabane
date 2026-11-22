import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import type { FieldPlot } from "./country-survey";

import { planetDimensions } from "./landscape-frame";
const noise = new ImprovedNoise();
const tau = 2 * Math.PI;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};

// The river descends around the wooded crown into the lake. Bake its course
// once, then measure distance to the same banks for the ground and the planting.
const course = new CatmullRomCurve3(
  [
    [-0.73, 0.31, 0.61],
    [-0.47, 0.6, 0.65],
    [-0.24, 0.67, 0.71],
    [-0.14, 0.59, 0.79],
    [0.04, 0.61, 0.79],
    [0.17, 0.68, 0.71],
    [0.32, 0.63, 0.7],
    [0.36, 0.53, 0.76],
    [0.53, 0.34, 0.78],
  ].map(([x, y, z]) => new Vector3(x, y, z).normalize()),
)
  .getPoints(36)
  .map((p) => p.normalize());
const bends = course.slice(1).map((end, i) => {
  const start = course[i],
    delta = end.clone().sub(start);
  return {
    start,
    delta,
    inverseLength: 1 / delta.lengthSq(),
    width: 0.018 + (0.018 * i) / (course.length - 2),
  };
});
function riverBank(x: number, y: number, z: number) {
  let bank = 0.22;
  if (z < 0.33 || y < 0.03 || y > 0.95) return bank;
  for (const { start, delta, inverseLength, width } of bends) {
    const dx = x - start.x,
      dy = y - start.y,
      dz = z - start.z;
    const t = clamp((dx * delta.x + dy * delta.y + dz * delta.z) * inverseLength);
    const ax = dx - t * delta.x,
      ay = dy - t * delta.y,
      az = dz - t * delta.z;
    bank = Math.min(bank, Math.sqrt(ax * ax + ay * ay + az * az) - width);
  }
  return bank;
}

// Unroll distances from the home along meridians. The complete editable rectangle
// is in the flat polar cap. Beyond it the tangent turns continuously to local gravity.
export function countryPlanet(plot: FieldPlot, sampleGrade: (x: number, z: number) => number) {
  const lot = plot.plantingLot;
  const cx = lot.centerX - plot.surveyX,
    cz = lot.centerZ - plot.surveyZ;
  const { flat, radius, centerDepth } = planetDimensions(lot);
  const cap = Math.asin(flat / radius),
    cosCap = Math.cos(cap);
  const arc = radius * cosCap;
  const distanceAt = (theta: number) =>
    theta < cap ? radius * Math.sin(theta) : flat + (theta - cap) * arc;
  function point(x: number, z: number, pos: Vector3, up: Vector3, cover: Vector3) {
    const dx = x - cx,
      dz = z - cz,
      d = Math.hypot(dx, dz);
    const theta = d <= flat ? Math.asin(d / radius) : Math.min(Math.PI, cap + (d - flat) / arc);
    const sin = Math.sin(theta),
      cos = Math.cos(theta);
    const ux = d ? dx / d : 0,
      uz = d ? dz / d : 0;
    const nx = ux * sin,
      nz = uz * sin;
    // Euclidean distance has a continuous slope around each corner. Taking
    // the larger axis distance leaves a diagonal crease visible from Orbit.
    const out = Math.hypot(
      Math.max(0, Math.abs(dx) - lot.width / 2),
      Math.max(0, Math.abs(dz) - lot.depth / 2),
    );
    // Blend only outside the rectangle. Its corners stay usable while the woods
    // beside each edge acquire a gentle grade before joining the spherical surface.
    const curvature = ease(out / Math.max(46, flat * 1.45));
    up.set(nx * curvature, 1 + (cos - 1) * curvature, nz * curvature).normalize();
    const wild = ease((theta - cap - 0.12) / 0.62) * ease(out / 10);
    pos.set(cx + radius * nx, (radius * cos - centerDepth) * curvature, cz + radius * nz);
    if (out <= 8) {
      pos.addScaledVector(up, sampleGrade(x, z));
      cover.set(0, 0.25, 0);
      return;
    }
    // A fault follows a winding arc between two basins. Distances live on the
    // unit sphere, so the watershed has no cut at the poles or back meridian.
    const fold = noise.noise(nx * 3.8 + 11, cos * 3.8, nz * 3.8 + 5);
    const fracture = 0.023 * noise.noise(nx * 12, cos * 12 - 4, nz * 12);
    const fault =
      nx * 0.55 + cos * 0.45 - nz * 0.7 + 0.21 * fold + 0.095 * Math.sin(5 * nx - 3 * nz);
    const river = Math.max(Math.abs(fault) - 0.046, cos - 0.08);
    const inlet = cos - 0.24 + (nx - 0.54) * 0.65;
    const lake =
      Math.hypot(nx - 0.54 + 0.09 * Math.sin(inlet * 10), inlet * 1.48, nz - 0.81) - 0.34;
    const headland = 0.16 - Math.hypot(nx - 0.38, (cos - 0.4) * 1.2, nz - 0.83);
    const tarn = Math.hypot((nx + 0.81) * 1.38, cos - 0.46, nz + 0.35) - 0.25;
    const land = Math.max(
      0.22 - (out - 8) / radius,
      Math.min(
        riverBank(nx, cos, nz) + fracture * 0.23,
        Math.max(headland, Math.min(river, lake, tarn)) + 0.067 * fold + fracture,
      ),
    );
    const bank = ease(land / 0.055);
    // One bank cuts through a higher shelf; the opposite bank opens into meadow.
    const plateau = 0.026 + 0.063 * ease((fault + 0.04) / 0.22) + 0.027 * fold;
    const ledge = ease((land - 0.075 - 0.035 * fold) / 0.043);
    const bluff = Math.max(
      ease(1 - Math.hypot((nx - 0.16) * 0.91, (cos - 0.52) * 1.7, nz - 0.84) / 0.35),
      ease(1 - Math.hypot((nx + 0.55) * 0.8, (cos - 0.46) * 1.5, nz - 0.7) / 0.44),
      ease(1 - Math.hypot(nx + 0.72, cos - 0.42, nz + 0.49) / 0.3),
    );
    const cut = land + 0.027 * fold + fracture * 0.6;
    const ramp = ease((cut - 0.025) / 0.036);
    const terrace = ease((cut - 0.116) / 0.035);
    const shelf =
      bank * (0.034 + 0.53 * plateau) +
      ledge * (0.47 * plateau) +
      bluff * (0.12 * ramp + 0.055 * terrace);
    const cliff =
      bluff *
      Math.max(1 - ease(Math.abs(cut - 0.047) / 0.054), 1 - ease(Math.abs(cut - 0.128) / 0.035));

    // Slanted rock ribs rise from two separate massifs. Their broken crests
    // change the silhouette while leaving broad stretches of land quiet.
    const massif = Math.max(
      ease(1 - Math.hypot((nx + 0.7) * 1.55, cos - 0.2, nz - 0.67) / 0.55),
      ease(1 - Math.hypot(nx - 0.74, (cos + 0.32) * 1.35, nz + 0.58) / 0.6),
    );
    const strike = nx * 2.9 + cos * 1.8 + nz * 0.85 + 0.51 * fold + fracture;
    const rib = Math.abs(strike - Math.round(strike));
    const ridge = massif * (0.075 + 0.14 * ease(1 - rib / 0.38)) * bank;
    // A crooked watershed rises behind the lake. The steep lake-facing scarp
    // breaks into spurs at the gullies, with a longer wooded backslope.
    const longitude = Math.atan2(nz, nx);
    const extent = ease((longitude + 0.91) / 0.4) * ease((0.99 - longitude) / 0.39);
    const crest =
      0.28 + 0.29 * Math.sin(2.2 * longitude + 0.36) + 0.062 * Math.cos(5.4 * longitude - 1);
    const cross = cos - crest - 0.07 * fold - fracture;
    const spur = 0.5 + 0.5 * Math.cos(longitude * 17 + 2.3 * fold);
    const backslope = ease(1 - Math.abs(cross) / (cross < 0 ? 0.14 + 0.1 * spur : 0.36));
    const backbone = ease(1 - Math.abs(cross + 0.018) / (0.047 + 0.03 * spur));
    const shoulder = extent * bank * backslope;
    const scarp = shoulder * ease((-cross + 0.025) / 0.09);
    // A shorter spur climbs across the grain above the saddle. Its stony
    // face looks towards the valley, across from the main scarp.
    const gully = ease(1 - Math.abs(cos - 0.55 + fold * 0.04) / 0.09);
    const spurCross = longitude + 0.12 + (cos - 0.27) * 1.42 + 0.24 * fold + 0.11 * gully;
    const spurEnd = ease((cos - 0.2) / 0.17) * ease((0.83 - cos) / 0.23);
    const spurSide = 1 - Math.abs(spurCross) / (spurCross > 0 ? 0.16 : 0.34);
    const spurHeight = spurEnd * bank * ease(spurSide) * (1 - 0.54 * gully);
    const watershed = Math.max(
      shoulder * (0.072 + 0.16 * spur + 0.075 * backbone),
      spurHeight * (0.2 + 0.1 * Math.sin(17 * cos + fold)),
    );
    const wall = (1 - ease((land - 0.008) / 0.064)) * ease(land / 0.012);
    const stone = Math.max(
      wall,
      scarp * (1.1 + 0.85 * spur),
      spurHeight * ease((spurCross + 0.03) / 0.07) * 1.8,
      shoulder * backbone * 0.83,
      cliff * 1.55,
      massif * (0.45 + 0.72 * ease(1 - rib / 0.37)),
    );
    const relief = (-0.048 + shelf + ridge + watershed) * wild;
    const grade = wild === 1 ? 0 : sampleGrade(x, z);
    pos.addScaledVector(up, grade * (1 - wild) + radius * relief);
    // x distinguishes the surveyed cap and carries radial height for rock bedding.
    cover.set(1 + relief, land, clamp(stone) * wild);
  }
  return { cx, cz, radius, centerDepth, distanceAt, point };
}

export type CountryPlanet = ReturnType<typeof countryPlanet>;

export function planetGeometry(planet: CountryPlanet, surveyScale: number) {
  const positions: number[] = [],
    uvs: number[] = [],
    ground: number[] = [],
    biome: number[] = [];
  const indices: number[] = [];
  const rings = 108,
    sectors = 192;
  const position = new Vector3(),
    up = new Vector3(),
    cover = new Vector3();
  function vertex(theta: number, phi: number) {
    const d = planet.distanceAt(theta);
    const x = planet.cx + Math.cos(phi) * d,
      z = planet.cz + Math.sin(phi) * d;
    planet.point(x, z, position, up, cover);
    positions.push(position.x, position.y, position.z);
    uvs.push(0.5 + x / (384 * surveyScale), 0.5 - z / (384 * surveyScale));
    ground.push(x, z);
    biome.push(cover.x, cover.y, cover.z);
  }
  vertex(0, 0);
  for (let ring = 1; ring < rings; ring++) {
    for (let i = 0; i < sectors; i++) vertex((Math.PI * ring) / rings, (tau * i) / sectors);
  }
  const bottom = positions.length / 3;
  vertex(Math.PI, 0);
  for (let i = 0; i < sectors; i++) {
    const j = (i + 1) % sectors;
    indices.push(0, 1 + j, 1 + i);
    for (let ring = 1; ring < rings - 1; ring++) {
      const a = 1 + (ring - 1) * sectors,
        b = a + sectors;
      indices.push(a + i, a + j, b + i, a + j, b + j, b + i);
    }
    const last = bottom - sectors;
    indices.push(last + i, last + j, bottom);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("surveyPoint", new Float32BufferAttribute(ground, 2));
  geometry.setAttribute("biome", new Float32BufferAttribute(biome, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
