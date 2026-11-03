import { useEffect, useState } from "react";
import { WallColorField } from "./WallColorField";
import { useWallFinishPreview } from "./WallFinishPreview";
import { wallFinishSides, withoutWallFace, type WallFinishSide } from "./wall-finish-sides";
import type { EditorWall, WallSurfaceFinish } from "@cabane/engine";
import type { ConstructEditorController } from "./useConstructEditor";
import { DebouncedColorInput } from "./DebouncedColorInput";

function WallFinishFieldsView({
  editor,
  wall,
  isExterior,
}: {
  editor: ConstructEditorController;
  wall: EditorWall;
  isExterior: boolean;
}) {
  const { palette, setHighlight } = useWallFinishPreview();
  const [splitRequested, setSplitRequested] = useState(false);
  useEffect(() => () => setHighlight(null), [setHighlight]);
  const { exteriorSide, interiorSide, roomLabel } = wallFinishSides(wall, editor.previewFloor);
  const left = wall.faceColors?.left ?? palette.interior;
  const right = wall.faceColors?.right ?? palette.interior;
  const split =
    splitRequested ||
    left !== right ||
    JSON.stringify(wall.faceFinishes?.left) !== JSON.stringify(wall.faceFinishes?.right);
  const update = editor.updateSelectedWallMetadata;
  const surface = (sides: readonly WallFinishSide[]) => ({
    finish: wall.faceFinishes?.[sides[0]!],
    onFinishChange: (finish: WallSurfaceFinish | undefined) => {
      const next = { ...wall.faceFinishes };
      for (const side of sides) {
        if (finish) next[side] = finish;
        else delete next[side];
      }
      update({ faceFinishes: Object.keys(next).length ? next : undefined });
    },
  });
  const location = { floorId: editor.previewFloor.id, wallId: wall.id };
  const faceField = (side: WallFinishSide, label: string, inputLabel?: string) => (
    <WallColorField
      key={side}
      {...surface([side])}
      {...location}
      label={label}
      {...(inputLabel ? { inputLabel } : {})}
      sides={[side]}
      value={wall.faceColors?.[side] ?? palette.interior}
      overridden={wall.faceColors?.[side] !== undefined}
      onCommit={(color) => update({ faceColors: { ...wall.faceColors, [side]: color } })}
      onReset={() => update({ faceColors: withoutWallFace(wall.faceColors, side) })}
    />
  );
  const custom = wall.edgeColor !== undefined;
  return (
    <fieldset>
      <legend>Finish</legend>
      {isExterior ? (
        <>
          <WallColorField
            {...location}
            {...surface([exteriorSide])}
            label="Exterior"
            inputLabel="Wall exterior color"
            sides={[exteriorSide]}
            value={wall.faceColors?.[exteriorSide] ?? wall.exteriorColor ?? palette.exterior}
            overridden={
              wall.exteriorColor !== undefined || wall.faceColors?.[exteriorSide] !== undefined
            }
            onCommit={(exteriorColor) => {
              editor.setExteriorWallColor(exteriorColor);
              update({ exteriorColor, faceColors: withoutWallFace(wall.faceColors, exteriorSide) });
            }}
            onReset={() =>
              update({
                exteriorColor: undefined,
                faceColors: withoutWallFace(wall.faceColors, exteriorSide),
              })
            }
          />
          {faceField(interiorSide, "Interior", "Wall interior color")}
        </>
      ) : (
        <>
          {!split && (
            <WallColorField
              {...location}
              {...surface(["left", "right"])}
              label="Wall"
              inputLabel="Wall color"
              sides={["left", "right"]}
              value={left}
              overridden={wall.faceColors !== undefined}
              onCommit={(color) => update({ faceColors: { left: color, right: color } })}
              onReset={() => update({ faceColors: undefined })}
            />
          )}
          <label className="construction-inspector__check">
            <input
              type="checkbox"
              checked={split}
              onChange={(event) => {
                setSplitRequested(event.target.checked);
                if (!event.target.checked)
                  update({
                    faceColors: { left, right: left },
                    faceFinishes: wall.faceFinishes?.left
                      ? { left: wall.faceFinishes.left, right: wall.faceFinishes.left }
                      : undefined,
                  });
              }}
            />
            Different finishes on each side
          </label>
          {split && (
            <>
              {faceField("left", roomLabel("left"))}
              {faceField("right", roomLabel("right"))}
            </>
          )}
        </>
      )}
      <label>
        Edge color
        <select
          aria-label="Wall edge color mode"
          value={custom ? "custom" : "auto"}
          onChange={(event) =>
            editor.updateSelectedWallMetadata({
              edgeColor:
                event.target.value === "auto"
                  ? undefined
                  : wall.faceColors?.left && wall.faceColors.left === wall.faceColors.right
                    ? wall.faceColors.left
                    : isExterior
                      ? (wall.exteriorColor ?? palette.interior)
                      : palette.interior,
            })
          }
        >
          <option value="auto">Auto</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {custom && (
        <label>
          Color
          <DebouncedColorInput
            label="Wall edge color"
            value={wall.edgeColor!}
            onCommit={(edgeColor) => editor.updateSelectedWallMetadata({ edgeColor })}
          />
        </label>
      )}
    </fieldset>
  );
}

export function WallFinishFields(props: Parameters<typeof WallFinishFieldsView>[0]) {
  return (
    <WallFinishFieldsView key={`${props.editor.previewFloor.id}:${props.wall.id}`} {...props} />
  );
}
