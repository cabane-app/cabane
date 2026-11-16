import { RoundedFurniturePanel } from "../../construction";
import { TeakSideFrame } from "./teak-side-frame";
import { BoxedCushion } from "../../living-room/sofa-upholstery/boxed-cushion";
import { TailoredCushion } from "../../living-room/sofa-upholstery/tailored-cushion";

/** Connected teak rails and legs with separate ivory seat and back pads. */
export function TeakLoungeFrame({
  width,
  seats,
  variant,
  color,
}: {
  width: number;
  seats: number;
  variant: string;
  color?: string | undefined;
}) {
  const inner = width - 0.16;
  const seatWidth = inner / seats - 0.015;
  return (
    <group userData={{ walkCollider: true }}>
      {[-1, 1].map((side) => (
        <TeakSideFrame key={side} x={side * (width / 2 - 0.045)} />
      ))}
      {[-0.3, 0.29].map((z) => (
        <RoundedFurniturePanel
          key={z}
          name="teak-seat-apron"
          size={[width - 0.075, 0.083, 0.056]}
          position={[0, 0.322, z]}
          radius={0.01}
          color="#bc9567"
          outline={false}
        />
      ))}
      <RoundedFurniturePanel
        name="deck"
        size={[width - 0.13, 0.035, 0.68]}
        position={[0, 0.346, 0]}
        radius={0.014}
        color="#ac8358"
        outline={false}
      />
      <RoundedFurniturePanel
        name="back-crest-rail"
        size={[width - 0.076, 0.052, 0.067]}
        position={[0, 0.814, -0.3665]}
        radius={0.014}
        color="#bc9567"
        outline={false}
      />
      {[0.53, 0.73].map((y) => (
        <RoundedFurniturePanel
          key={y}
          name="teak-back-slat"
          size={[width - 0.075, 0.085, 0.036]}
          position={[0, y, -0.3 - (y - 0.53) * 0.19]}
          rotation={[-0.18, 0, 0]}
          radius={0.01}
          color="#bc9567"
          outline={false}
        />
      ))}
      {Array.from({ length: seats }, (_, i) => {
        const x = ((i - (seats - 1) / 2) * inner) / seats;
        return (
          <group key={i}>
            <BoxedCushion
              name="ivory-seat"
              size={[seatWidth, 0.15, 0.697]}
              position={[x, 0.435, 0.0515]}
              color={color ?? "#e8ddc7"}
              outlineColor="#ae9d84"
            />
            <BoxedCushion
              name="ivory-back"
              size={[seatWidth, 0.145, 0.391]}
              position={[x, 0.633, -0.25]}
              rotation={[1.394, 0, 0]}
              color={color ?? "#e8ddc7"}
            />
            {seats > 1 && i !== 1 && (
              <TailoredCushion
                name="secondary-lounge-cushion"
                size={[0.3, 0.13, 0.3]}
                position={[x + (i === 0 ? 0.2 : -0.2), 0.62, 0.04]}
                rotation={[1.15, 0, i === 0 ? -0.13 : 0.13]}
                color={i === 0 ? "#a96e4e" : "#c3936a"}
              />
            )}
            <TailoredCushion
              name="lounge-accent-cushion"
              size={[0.36, 0.14, 0.36]}
              position={[x + (i === 0 ? -0.07 : 0.06), 0.63, -0.1]}
              rotation={[1.2, 0, i % 2 ? 0.12 : -0.12]}
              color={variant === "sage" || i === 2 ? "#8f9e7d" : "#bd8063"}
            />
          </group>
        );
      })}
    </group>
  );
}
