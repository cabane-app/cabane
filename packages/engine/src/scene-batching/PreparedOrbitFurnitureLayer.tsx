import { useFrame, useThree } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Group, type Object3D } from "three";
import { resolveItemTransform, type SceneItemSpec } from "../home-project";
import { SceneStyleContext } from "../scene-style";
import type { FloorSpec, FurnishingModelDefinition } from "../types";
import { PreparedOrbitFurniture } from "./PreparedOrbitFurniture";

const PreparedFloorContext = createContext<{
  prepared: PreparedOrbitFurniture;
  fallback: Group;
} | null>(null);

export function PreparedOrbitFurnitureLayer({ children }: { children: ReactNode }) {
  const supported = useThree((state) => state.gl.extensions.has("WEBGL_multi_draw"));
  return supported ? <PreparedOrbitFloor>{children}</PreparedOrbitFloor> : children;
}

// R3F owns the source children and their disposal. Three's render scene never owns this group.
const keepDetached = () => () => {};

function PreparedOrbitFloor({ children }: { children: ReactNode }) {
  const invalidate = useThree((state) => state.invalidate);
  const [sources] = useState(() => new Group());
  const [floor] = useState(() => ({
    prepared: new PreparedOrbitFurniture(invalidate),
    fallback: new Group(),
  }));
  const { prepared, fallback } = floor;
  useLayoutEffect(() => () => prepared.dispose(), [prepared]);
  useFrame(({ camera, size }) => {
    prepared.prepare(camera, size.height);
  });
  return (
    <>
      <primitive object={prepared.root} dispose={null} />
      <primitive object={fallback} />
      <PreparedFloorContext.Provider value={floor}>
        <primitive object={sources} attach={keepDetached}>
          {children}
        </primitive>
      </PreparedFloorContext.Provider>
    </>
  );
}

type ItemProps = {
  item: SceneItemSpec;
  floor: FloorSpec;
  definition: FurnishingModelDefinition;
  children: ReactNode;
};

export function PreparedOrbitItem(props: ItemProps) {
  const layer = useContext(PreparedFloorContext);
  return layer ? <RegisteredOrbitItem {...props} layer={layer} /> : props.children;
}

function RegisteredOrbitItem({
  item,
  floor,
  definition,
  children,
  layer,
}: ItemProps & {
  layer: NonNullable<React.ContextType<typeof PreparedFloorContext>>;
}) {
  const style = useContext(SceneStyleContext);
  const source = useRef<Group>(null);
  const [rejected, setRejected] = useState(false);
  useLayoutEffect(() => {
    if (rejected || !source.current) return;
    const { position } = resolveItemTransform(item.placement, floor);
    const unregister = layer.prepared.register(item.id, source.current, position);
    if (unregister) return unregister;
    // An unrecognised render hook or geometry needs the normal live renderer.
    setRejected(true);
    return;
  }, [item, floor, definition, style, layer, rejected]);
  const attachFallback = useCallback(
    (_parent: Object3D, group: Group) => {
      layer.fallback.add(group);
      return () => {
        layer.fallback.remove(group);
      };
    },
    [layer],
  );
  return rejected ? (
    <group key="live" attach={attachFallback}>
      {children}
    </group>
  ) : (
    <group key="source" ref={source}>
      {children}
    </group>
  );
}
