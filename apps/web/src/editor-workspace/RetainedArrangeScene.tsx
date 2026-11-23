import { useDeferredValue, useState, type ReactNode } from "react";

/** Keep architecture meshes across views. Hidden meshes stay unchanged until
 * Arrange or the Construct preview needs the latest draft. */
export function RetainedArrangeScene({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [retained, setRetained] = useState<ReactNode>(null);
  // The initial model tree is large. Let React yield to input while mounting it.
  // Subsequent edits and visits reuse the mounted scene synchronously.
  const mounted = useDeferredValue(active || retained !== null, false);
  if (active && mounted && retained !== children) setRetained(children);
  return (
    <group name="retained-arrange-scene" visible={active}>
      {active && mounted ? children : retained}
    </group>
  );
}
