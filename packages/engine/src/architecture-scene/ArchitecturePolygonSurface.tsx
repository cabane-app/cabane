import { omitUndefinedProperties } from "../defined-properties";
import { useCabaneDom } from "./../CabaneDom";
import { cutSurfaceShapes, useStairSurfaceApertures } from "../stairs/surface-apertures";
import { useFrame, useThree } from "@react-three/fiber";

import { DoubleSide, ShapeGeometry, type Mesh } from "three";

import { memo, useEffect, useMemo, useRef, useState } from "react";

import { Outlines, ToonMaterial } from "../rendering";

import type { FloorSpec, Polygon } from "../types";

export const PolygonSurface = memo(function PolygonSurface({
  polygon,
  floor,
  color,
  opacity = 1,
  elevation,
  receiveShadow = true,
  interactionColor,
  selected = false,
  reducedMotion = false,
  onSelect,
  name,
}: {
  polygon: Polygon;
  floor: FloorSpec;
  color: string;
  opacity?: number;
  elevation: number;
  receiveShadow?: boolean;
  interactionColor?: string;
  selected?: boolean;
  reducedMotion?: boolean;
  onSelect?: () => void;
  name?: string;
}) {
  const dom = useCabaneDom();
  const apertures = useStairSurfaceApertures("floor");
  const geometry = useMemo(
    () => new ShapeGeometry(cutSurfaceShapes(polygon, floor.coordinates, apertures)),
    [floor, polygon, apertures],
  );
  const press = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const interactionRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const interactionOpacity = selected ? 0.36 : pressed ? 0.28 : hovered ? 0.18 : 0;
  const opacityRef = useRef(selected ? 0.36 : 0);
  const { invalidate } = useThree();

  useEffect(() => {
    if (!hovered || !onSelect || typeof document === "undefined") return;
    const previousCursor = dom.container.style.cursor;
    dom.container.style.cursor = "pointer";
    return () => {
      dom.container.style.cursor = previousCursor;
    };
  }, [hovered, onSelect, dom]);

  useEffect(() => {
    invalidate();
  }, [interactionOpacity, invalidate]);

  useFrame((_state, delta) => {
    const interaction = interactionRef.current;
    const material = interaction?.material;
    if (!material || Array.isArray(material)) return;
    const next = reducedMotion
      ? interactionOpacity
      : opacityRef.current +
        (interactionOpacity - opacityRef.current) * (1 - Math.exp(-16 * delta));
    const resolved = Math.abs(next - interactionOpacity) < 0.002 ? interactionOpacity : next;
    if (Math.abs(resolved - opacityRef.current) > 0.0005) {
      opacityRef.current = resolved;
      material.opacity = resolved;
    }
    interaction.visible = resolved > 0.001;
    if (Math.abs(resolved - interactionOpacity) >= 0.002) invalidate();
  });

  const clearPress = () => {
    press.current = null;
    setPressed(false);
  };

  return (
    <group>
      <mesh
        {...omitUndefinedProperties({ name: name })}
        geometry={geometry}
        position={[0, elevation, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={receiveShadow}
        {...omitUndefinedProperties({
          onPointerOver: onSelect
            ? (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                setHovered(true);
              }
            : undefined,
        })}
        {...omitUndefinedProperties({
          onPointerOut: onSelect
            ? (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                setHovered(false);
                clearPress();
              }
            : undefined,
        })}
        {...omitUndefinedProperties({
          onPointerDown: onSelect
            ? (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                setPressed(true);
                press.current = {
                  pointerId: event.pointerId,
                  x: event.nativeEvent.clientX,
                  y: event.nativeEvent.clientY,
                };
              }
            : undefined,
        })}
        {...omitUndefinedProperties({
          onPointerMove: onSelect
            ? (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
                const candidate = press.current;
                if (!candidate || candidate.pointerId !== event.pointerId) return;
                if (
                  Math.hypot(
                    event.nativeEvent.clientX - candidate.x,
                    event.nativeEvent.clientY - candidate.y,
                  ) > 10
                )
                  clearPress();
              }
            : undefined,
        })}
        {...omitUndefinedProperties({
          onPointerUp: onSelect
            ? (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                const candidate = press.current;
                clearPress();
                if (candidate?.pointerId === event.pointerId) onSelect();
              }
            : undefined,
        })}
        {...omitUndefinedProperties({ onPointerCancel: onSelect ? clearPress : undefined })}
      >
        <ToonMaterial
          color={color}
          side={DoubleSide}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 1}
        />
      </mesh>
      {interactionColor && (
        <mesh
          ref={interactionRef}
          name={`${name}-interaction`}
          geometry={geometry}
          position={[0, elevation + 0.003, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={reducedMotion ? interactionOpacity > 0 : opacityRef.current > 0.001}
          renderOrder={2}
          raycast={() => undefined}
        >
          <ToonMaterial
            color={interactionColor}
            side={DoubleSide}
            transparent
            opacity={reducedMotion ? interactionOpacity : opacityRef.current}
            depthWrite={false}
          />
          <Outlines
            visible={hovered || pressed}
            color={interactionColor}
            thickness={2}
            screenspace
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
});
