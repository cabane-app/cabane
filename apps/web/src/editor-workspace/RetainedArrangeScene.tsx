import { useState, type ReactNode } from "react";

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
  if (active && retained !== children) setRetained(children);
  return (
    <group name="retained-arrange-scene" visible={active}>
      {active ? children : retained}
    </group>
  );
}
