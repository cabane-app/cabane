import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
    | {
        label: string;
        onOpen: () => void;
        restoreFocus: (button: HTMLButtonElement | null) => void;
      }
    | undefined;
  names: Readonly<Record<string, string>>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOverview: () => void;
  reducedMotion: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const floorButton = useRef<HTMLButtonElement>(null);
  const roomsButton = useRef<HTMLButtonElement>(null);
  const outsideButton = useRef<HTMLButtonElement>(null);
  const [picker, setPicker] = useState<"floor" | "rooms" | null>(null);
  const floorListId = useId();
  const roomListId = useId();
  const dom = useCabaneDom();
  const hasRoomChoices = rooms.length > 0 || outsideControls !== undefined;
  const restoreOutsideFocus = outsideControls?.restoreFocus;
  useLayoutEffect(() => {
    const compactTrigger = roomsButton.current;
    restoreOutsideFocus?.(compactTrigger?.offsetWidth ? compactTrigger : outsideButton.current);
  }, [restoreOutsideFocus]);
  useEffect(() => {
    if (!picker) return;
    const outside = (event: PointerEvent) => {
      if (root.current && !event.composedPath().includes(root.current)) setPicker(null);
    };
    dom.events.addEventListener("pointerdown", outside);
    return () => dom.events.removeEventListener("pointerdown", outside);
  }, [dom, picker]);
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const reveal = () => {
      if (!element.clientWidth) return;
      const compact = Boolean(roomsButton.current?.offsetWidth);
      if (!compact && picker === "rooms") setPicker(null);
      const selected =
        element.querySelector<HTMLElement>(".room-navigation__outside:focus") ??
        element.querySelector<HTMLElement>("[aria-pressed='true']");
      const behavior = reducedMotion ? "instant" : "smooth";
      if (!selected) {
        element.scrollTo?.({ left: 0, top: 0, behavior });
        return;
      }
      const position = compact
        ? { top: selected.offsetTop - (element.clientHeight - selected.offsetHeight) / 2 }
        : { left: selected.offsetLeft - (element.clientWidth - selected.offsetWidth) / 2 };
      element.scrollTo?.({ ...position, behavior });
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedId, floor.id, picker, reducedMotion]);
  return (
    <nav
      className="room-navigation"
      aria-label={outsideControls ? "Rooms and devices on this floor" : "Rooms on this floor"}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && picker) {
          event.stopPropagation();
          setPicker(null);
          (picker === "floor" ? floorButton : roomsButton).current?.focus();
        }
      }}
    >
      <div className="room-navigation__bar">
        <button
          ref={floorButton}
          type="button"
          className="room-navigation__floor"
          aria-label={floor.name}
          aria-pressed={selectedId === null}
          aria-expanded={picker === "floor"}
          aria-controls={floorListId}
          onClick={() => {
            onOverview();
            setPicker(picker === "floor" ? null : "floor");
          }}
        >
          {summary}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={picker === "floor" ? "m7 14 5-5 5 5" : "m7 10 5 5 5-5"} />
          </svg>
        </button>
        {hasRoomChoices && (
          <button
            ref={roomsButton}
            type="button"
            className="room-navigation__trigger"
            aria-expanded={picker === "rooms"}
            aria-controls={roomListId}
            onClick={() => setPicker(picker === "rooms" ? null : "rooms")}
          >
            <svg className="room-navigation__rooms-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
            Rooms
            <svg className="room-navigation__chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d={picker === "rooms" ? "m7 14 5-5 5 5" : "m7 10 5 5 5-5"} />
            </svg>
          </button>
        )}
        <div
          id={roomListId}
          className="room-navigation__rooms"
          role="group"
          aria-label="Choose a room"
          data-expanded={hasRoomChoices && picker === "rooms"}
          ref={strip}
        >
          {rooms.map((room) => (
            <button
              type="button"
              key={room.id}
              aria-pressed={selectedId === room.id}
              title={names[room.id] ?? room.name}
              onClick={() => {
                setPicker(null);
                onSelect(room.id);
                if (picker === "rooms") roomsButton.current?.focus();
              }}
            >
              <span>{names[room.id] ?? room.name}</span>
            </button>
          ))}
          {outsideControls && (
            <button
              ref={outsideButton}
              type="button"
              className="room-navigation__outside"
              aria-haspopup="dialog"
              onClick={() => {
                setPicker(null);
                outsideControls.onOpen();
              }}
            >
              <span>{outsideControls.label}</span>
            </button>
          )}
        </div>
      </div>
      {picker === "floor" && (
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
                setPicker(null);
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
