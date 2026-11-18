import { LatheGeometry, Vector2 } from "three";

/** Revolve the ordered [radius, height] section around local Y. */
export function turnedProfile(
  section: [number, number][],
  sides: number,
  start = 0,
  arc = Math.PI * 2,
) {
  return new LatheGeometry(
    section.map(([radius, height]) => new Vector2(radius, height)),
    sides,
    start,
    arc,
  );
}
