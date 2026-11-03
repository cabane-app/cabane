import { RoundedFurniturePanel } from "../../construction";
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
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <RoundedFurniturePanel
            key={x + ":" + z}
            size={[0.07, 0.34, 0.07]}
            position={[x * (width / 2 - 0.055), 0.17, z * 0.355]}
            color="#ac8358"
          />
        )),
      )}
      <RoundedFurniturePanel size={[width, 0.08, 0.8]} position={[0, 0.32, 0]} color="#bc9567" />
      {[-1, 1].map((side) => (
        <group key={side}>
          {Array.from({ length: 7 }, (_, i) => (
            <RoundedFurniturePanel
              key={i}
              name="open-arm-spindle"
              size={[0.025, 0.27, 0.025]}
              position={[side * (width / 2 - 0.04), 0.485, -0.27 + i * 0.09]}
              color="#b78c5c"
              radius={0.008}
            />
          ))}

          <RoundedFurniturePanel
            size={[0.06, 0.48, 0.06]}
            position={[side * (width / 2 - 0.04), 0.6, -0.36]}
            color="#ac8358"
          />
          <RoundedFurniturePanel
            size={[0.06, 0.3, 0.06]}
            position={[side * (width / 2 - 0.04), 0.49, 0.34]}
            color="#ac8358"
          />
          <RoundedFurniturePanel
            size={[0.08, 0.06, 0.8]}
            position={[side * (width / 2 - 0.04), 0.65, 0]}
            color="#bc9567"
          />
        </group>
      ))}
      {[0.49, 0.64, 0.8].map((y) => (
        <RoundedFurniturePanel
          key={y}
          size={[inner, 0.065, 0.055]}
          position={[0, y, -0.36]}
          color="#bc9567"
        />
      ))}
      {Array.from({ length: seats }, (_, i) => {
        const x = ((i - (seats - 1) / 2) * inner) / seats;
        return (
          <group key={i}>
            <RoundedFurniturePanel
              size={[seatWidth, 0.13, 0.65]}
              position={[x, 0.425, 0.035]}
              radius={0.045}
              color={color ?? "#e8ddc7"}
              outlineColor="#b1a48c"
            />
            <RoundedFurniturePanel
              size={[seatWidth, 0.39, 0.13]}
              position={[x, 0.645, -0.255]}
              radius={0.045}
              color={color ?? "#e8ddc7"}
              outlineColor="#b1a48c"
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
