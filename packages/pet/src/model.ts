/** Self-contained, ground-aligned GLB facing +Z, with named animation clips. */
export interface PetModel {
  url: string;
  walkClip: string;
  idleClip: string;
  scale?: number;
  radius?: number;
  height?: number;
  speed?: number;
  /** Metres travelled by one authored walk cycle at model scale 1. */
  strideLength: number;
  /** Optional asset-specific head calibration; keeps the visible muzzle facing +Z. */
  head?: { bone: string; forward: readonly [number, number, number] };
}
