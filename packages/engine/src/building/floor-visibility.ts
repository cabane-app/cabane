export type FloorView = "plan" | "cutaway" | "whole" | "walk";
export const visibleFloorIds = (
  order: readonly string[],
  activeId: string,
  view: FloorView,
): readonly string[] => {
  if (view === "whole" || view === "walk") return order;
  const index = order.indexOf(activeId);
  if (index < 0) return [];
  return view === "plan" ? [activeId] : order.slice(0, index + 1);
};

/** Keep every item selectable in the editor, including roof pieces. */
export const showItemInFloorView = (
  item: { hideWithRoof?: boolean },
  view: FloorView,
  editing: boolean,
) => !item.hideWithRoof || editing || view === "whole" || view === "walk";
