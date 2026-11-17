import type { TerrainSurface } from "../terrain/terrain-surface";

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// conformToTerrain clips every triangle to this uniform grid. Outside the grid the grade is level
// along the clamped axis, so the progress stays at the first or last cell boundary.
function cellProgress(value: number, grid: readonly number[]) {
  const last = grid.length - 1;
  const t = Math.max(0, Math.min(last, ((value - grid[0]) * last) / (grid[last] - grid[0] || 1)));
  const i = Math.min(Math.floor(t), last - 1);
  return { i, t: t - i };
}

/** Follow the upper surface of the smooth grade and its rendered chords. A finish has its own
 * clipped vertices inside a cell, so sampling the smooth height alone lets it pierce the decal. */
export function turfGradeSampler(
  terrain: Pick<NonNullable<TerrainSurface>, "gridX" | "gridZ" | "offsetAt">,
) {
  const { gridX, gridZ } = terrain;
  const rows = gridZ.map((z) => gridX.map((x) => terrain.offsetAt(x, z)));
  return (x: number, z: number) => {
    const { i, t: u } = cellProgress(x, gridX);
    const { i: j, t: v } = cellProgress(z, gridZ);
    const a = rows[j][i],
      b = rows[j][i + 1],
      c = rows[j + 1][i],
      d = rows[j + 1][i + 1];
    const chord = lerp(lerp(a, b, u), lerp(c, d, u), v);
    // Either diagonal can own this part of a clipped cell. Use the upper diagonal on a saddle.
    const twist = a - b - c + d;
    const diagonalOffset =
      twist >= 0
        ? twist * Math.min(u * (1 - v), v * (1 - u))
        : -twist * Math.min(u * v, (1 - u) * (1 - v));
    return (
      Math.max(
        terrain.offsetAt(x, z),
        lerp(terrain.offsetAt(gridX[i], z), terrain.offsetAt(gridX[i + 1], z), u),
        lerp(terrain.offsetAt(x, gridZ[j]), terrain.offsetAt(x, gridZ[j + 1]), v),
        chord,
      ) + diagonalOffset
    );
  };
}
