import type { StairFlight } from "../flight-geometry";
import { StairPolygonSurface } from "./StairPolygonSurface";
import { useContext, useEffect, useMemo } from "react";
import { useGraphicsFeature } from "../../graphics-features";
import { SceneStyleContext } from "../../scene-style";
import { createTreadContactMap, treadJoint } from "./tread-contact";

/** Closed risers and a solid base share the exact walking tread footprints. */
export function MasonryStairTreads({
  flight,
  plan = false,
}: {
  flight: StairFlight;
  plan?: boolean;
}) {
  const stone = flight.style === "stone";
  const enabled = useGraphicsFeature("contact");
  const style = useContext(SceneStyleContext);
  const map = useMemo(
    () => (enabled && !plan && style === "default" ? createTreadContactMap() : null),
    [enabled, plan, style],
  );
  useEffect(() => () => map?.dispose(), [map]);
  const shapeKey = map ? JSON.stringify(flight.treads) : "";
  const contacts = useMemo(() => {
    if (!map) return [];
    const treads = JSON.parse(shapeKey) as StairFlight["treads"];
    const joints = treads.slice(1).map((tread, i) => treadJoint(treads[i], tread));
    return treads.map((_, i) => ({ map, below: joints[i - 1], above: joints[i] }));
  }, [map, shapeKey]);
  return flight.treads.map((tread, index) => (
    <group key={index} name={`stair-masonry-tread-${index}`}>
      <StairPolygonSurface
        polygon={tread.polygon}
        elevation={tread.elevation - (stone ? 0.045 : 0)}
        thickness={tread.elevation + 0.06 - (stone ? 0.045 : 0)}
        finish={plan ? false : "painted-plaster"}
        contact={contacts[index]}
        color={stone ? "#9d9280" : "#b7b8b1"}
      />
      {stone && (
        <StairPolygonSurface
          polygon={tread.polygon}
          elevation={tread.elevation}
          thickness={0.045}
          finish={plan ? false : "limestone"}
          contact={contacts[index]}
          color="#d1c5ae"
        />
      )}
    </group>
  ));
}
