import type { PlanPoint, SlopedCeilingSpec } from "../types";

type CeilingPlane = SlopedCeilingSpec["planes"][number];

export function slopedCeilingProjection({
  lowEdge,
  highEdge,
}: Pick<CeilingPlane, "lowEdge" | "highEdge">) {
  const [origin, end] = lowEdge;
  const dx = end[0] - origin[0];
  const dz = end[1] - origin[1];
  const length = Math.hypot(dx, dz);
  const normalX = -dz / length;
  const normalZ = dx / length;
  const offset = ([x, z]: PlanPoint) => (x - origin[0]) * normalX + (z - origin[1]) * normalZ;
  const run = offset(highEdge[0]) / 2 + offset(highEdge[1]) / 2;
  // The slope is perpendicular to its level edges, even when they have different lengths.
  if (!Number.isFinite(run) || Math.abs(run) < 1e-8) return null;
  return (point: PlanPoint) => offset(point) / run;
}

export const slopedCeilingHeightSampler = (plane: CeilingPlane) => {
  const progressAt = slopedCeilingProjection(plane);
  const { lowHeightMeters, highHeightMeters } = plane;
  const rise = highHeightMeters - lowHeightMeters;
  return (point: PlanPoint) => {
    const progress = progressAt ? Math.max(0, Math.min(1, progressAt(point))) : 0;
    return lowHeightMeters + rise * progress;
  };
};
