import { useEffect, useId, useRef, useState, type ReactNode, type RefCallback } from "react";
import { useCabaneDom } from "../CabaneDom";
import type { RoomSpec } from "../types";

export function RoomNavigation({
  floor,
  floors,
  summary,
  onSelectFloor,
  rooms,
  outsideControls,
  names,
  selectedId,
  onSelect,
  onOverview,
  reducedMotion,
}: {
  floor: { id: string; name: string };
  floors: readonly { id: string; name: string }[];
  summary: ReactNode;
  onSelectFloor: (id: string) => void;
  rooms: readonly RoomSpec[];
  outsideControls?:
    { label: string; onOpen: () => void; buttonRef: RefCallback<HTMLButtonElement> } | undefined;
  names: Readonly<Record<string, string>>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOverview: () => void;
  reducedMotion: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const floorButton = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const floorListId = useId();
  const dom = useCabaneDom();
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!event.composedPath().includes(root.current!)) setExpanded(false);
    };
    dom.events.addEventListener("pointerdown", outside);
    return () => dom.events.removeEventListener("pointerdown", outside);
  }, [dom, expanded]);
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const reveal = () => {
      const selected =
        element.querySelector<HTMLElement>(".room-navigation__outside:focus") ??
        element.querySelector<HTMLElement>("[aria-pressed='true']");
      if (!selected) return;
      const left = selected.offsetLeft - (element.clientWidth - selected.offsetWidth) / 2;
      element.scrollTo?.({ left, behavior: reducedMotion ? "instant" : "smooth" });
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedId, floor.id, reducedMotion]);
  return (
    <nav
      className="room-navigation"
      aria-label={outsideControls ? "Rooms and devices on this floor" : "Rooms on this floor"}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.stopPropagation();
          setExpanded(false);
          floorButton.current?.focus();
        }
      }}
    >
      <div className="room-navigation__rooms" ref={strip}>
        <button
          ref={floorButton}
          type="button"
          className="room-navigation__floor"
          aria-label={floor.name}
          aria-pressed={selectedId === null}
          aria-expanded={expanded}
          aria-controls={floorListId}
          onClick={() => {
            onOverview();
            setExpanded(!expanded);
          }}
        >
          {summary}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={expanded ? "m7 14 5-5 5 5" : "m7 10 5 5 5-5"} />
          </svg>
        </button>
        {outsideControls && (
          <button
            ref={outsideControls.buttonRef}
            type="button"
            className="room-navigation__outside"
            aria-haspopup="dialog"
            onClick={() => {
              setExpanded(false);
              outsideControls.onOpen();
            }}
          >
            <span>{outsideControls.label}</span>
          </button>
        )}
        {rooms.map((room) => (
          <button
            type="button"
            key={room.id}
            aria-pressed={selectedId === room.id}
            title={names[room.id] ?? room.name}
            onClick={() => {
              setExpanded(false);
              onSelect(room.id);
            }}
          >
            <span>{names[room.id] ?? room.name}</span>
          </button>
        ))}
      </div>
      {expanded && (
        <div
          id={floorListId}
          className="room-navigation__floors"
          role="group"
          aria-label="Choose a floor"
        >
          {floors.map((level) => (
            <button
              type="button"
              key={level.id}
              aria-pressed={level.id === floor.id}
              onClick={() => {
                onSelectFloor(level.id);
                setExpanded(false);
                floorButton.current?.focus();
              }}
            >
              <span>{level.name}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
