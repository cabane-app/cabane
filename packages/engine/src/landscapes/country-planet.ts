import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
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
    const out = Math.max(Math.abs(dx) - lot.width / 2, Math.abs(dz) - lot.depth / 2);
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
    // Sample the geology in 3D so shorelines and ridges cross the back meridian and poles.
    const bedrock =
      noise.noise(nx * 2.5 + 8.1, cos * 2.5 + 2, nz * 2.5 - 3.4) +
      0.38 * noise.noise(nx * 6.1 + 1, cos * 6.1 - 8, nz * 6.1 + 4) +
      0.13 * noise.noise(nx * 15, cos * 15 + 3, nz * 15 - 2) +
      0.12;
    // Inland headlands and coves are level sets of one continuous elevation field.
    // Keep water away from the house, then let it follow the measured and rocky slopes.
    const inland = 0.17 - ((out - 14) / radius) * 0.85 + 0.1 * noise.noise(nx * 8, cos * 8, nz * 8);
    const land = Math.max(inland, bedrock);
    const crag = ease((bedrock - 0.19) / 0.38) * ease((out - 8) / 12);
    const relief = radius * (0.071 * Math.max(-0.032, land) + 0.032 * crag * crag);
    const grade = wild === 1 ? 0 : sampleGrade(x, z);
    pos.addScaledVector(up, grade * (1 - wild) + relief * wild);
    cover.set(1, land, crag);
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
