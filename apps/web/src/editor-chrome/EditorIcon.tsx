import { EditorModeIcon, type EditorMode } from "@cabane/engine";

const paths = {
  group: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </>
  ),
  ungroup: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="m14 4 6 6m-6 0 6-6M4 14l6 6m-6 0 6-6" />
    </>
  ),
  "virtual-wall": <path d="M3 4h18v16H3Z M3 12h18 M9 4v8 M15 12v8" strokeDasharray="3 3" />,
  "outdoor-space": (
    <>
      <path d="m3 14 9-5 9 5-9 6Z M3 14v3l9 6 9-6v-3 M6 11V5m6 4V2m6 9V5M6 6l6-4 6 4" />
    </>
  ),
  lighting: (
    <>
      <path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z" />
    </>
  ),
  floorAbove: <path d="M3 14h12v7H3zM3 17.5h12M19 13V3m-3 3 3-3 3 3" />,
  floorBelow: <path d="M3 3h12v7H3zM3 6.5h12M19 11v10m-3-3 3 3 3-3" />,
  apartmentFloor: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 9h16M4 15h16M9 5.5v1M15 5.5v1M9 11.5v1M15 11.5v1M10 21v-3h4v3" />
    </>
  ),
  niche: (
    <>
      <path d="M3 21V3h18v18M6 18V6h12v12Z" />
      <path d="M6 12h12" />
    </>
  ),
  decorations: (
    <>
      <path d="M3 21h18M5 21V9h14v12M8 9V5h8v4M8 15h8" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  roof: <path d="m2 12 10-8 10 8M5 10v10h14V10M2 12h20" />,
  spawn: (
    <>
      <path d="M18 9c0 5-6 11-6 11S6 14 6 9a6 6 0 1 1 12 0Z" />
      <circle cx="12" cy="9" r="2" />
    </>
  ),
  tutorial: (
    <>
      <path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z" />
    </>
  ),
  stairs: <path d="M3 21v-6h6V9h6V3h6M3 21h18V3" />,
  cube: <path d="m12 3 9 5v8l-9 5-9-5V8Zm0 10 9-5M12 13 3 8m9 5v8" />,
  plan: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M10 3v8H3m7 0h5m-5 5v5m5-10h6" />
    </>
  ),
  walk: (
    <>
      <circle cx="12" cy="4.6" r="2" />
      <path d="m10.5 8-2 5 3 2.2-1.5 5M13.4 8.4l2.1 4.1 3 .5M11.5 15.2l4.3 4.3" />
    </>
  ),
  back: <path d="m10 5-7 7 7 7M3 12h18" />,
  external: <path d="M14 3h7v7m0-7-11 11M9 4H4v16h16v-5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z" />
    </>
  ),
  file: (
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5" />
  ),
  import: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  export: <path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  kitchen: <path d="M5 3v18M2 3v8h6V3m10 0q-5 4-4 10h4m0-10v18" />,
  bed: <path d="M3 21V7m18 14V7M3 16h18M3 11h18v5M6 11V6h12v5M12 6v5" />,
  bath: (
    <path d="M2 11h20M4 11v4a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4M6 19v2m12-2v2M5 11V5a3 3 0 0 1 6 0" />
  ),
  dining: <path d="M5 10h14v3H5zm2 3v8m10-8v8M2 4v13h3m17-13v13h-3" />,
  monitor: (
    <>
      <rect x="4" y="3" width="16" height="11" rx="1" />
      <path d="M12 14v4m-5 0h10M2 21h20" />
    </>
  ),
  hallway: <path d="M3 21V3h18v18M8 21V8h8v13M3 3l5 5m13-5-5 5" />,
  laundry: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="14" r="5" />
      <path d="M4 7h16M7 4.5h.1M10 4.5h.1m-2 10q4-3 8 0" />
    </>
  ),
  outdoor: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13 7 16m5-3 5 3" />
      <path d="M5 12a4 4 0 0 1 3-6 4.5 4.5 0 0 1 8 0 4 4 0 0 1 3 6Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" />
      <path d="M7 3v6h10V3M7 21v-8h10v8" />
    </>
  ),
  reset: <path d="M3 4v6h6M3 10a9 9 0 1 1 2.5 8" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,

  details: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.1" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  delete: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />,
  rotateLeft: <path d="M4 11a8 8 0 1 1 2 7M4 5v6h6" />,
  rotateRight: <path d="M20 11a8 8 0 1 0-2 7m2-13v6h-6" />,
  swapHinge: (
    <>
      <path d="M4 20V4h5m11 16V4h-5M7 12h10m-7-3-3 3 3 3m4-6 3 3-3 3" />
      <circle cx="4" cy="20" r="1" />
      <circle cx="20" cy="20" r="1" />
    </>
  ),
  reverseSlide: <path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4" />,
  switchSide: <path d="M3 10h18M3 14h18M12 2v6m-3-3 3-3 3 3M12 16v6m-3-3 3 3 3-3" />,
  resize: <path d="M4 10V4h6M14 20h6v-6M4 4l16 16" />,
  elevation: <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />,
  move: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />,
  select: <path d="m5 3 14 10-7 1-3 7z" />,
  wall: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 12h18M9 5v7m6 0v7" />
    </>
  ),
  door: <path d="M4 21V3h16v18M7 21V6l10-2v17zM13 13h.1" />,
  window: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  passage: <path d="M3 21h5V8a4 4 0 0 1 8 0v13h5M3 3h18M5 3v18m14-18v18" />,
  floor: (
    <>
      <path d="M4 8 12 4l8 4-8 4-8-4Z" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
    </>
  ),
  hedge: (
    <>
      <path d="M3 18V9l3-3h12l3 3v9zM7 18v3m10-3v3M3 12h18M8 6v6m8-6v6" />
    </>
  ),
  pool: (
    <>
      <path d="M5 13V5a2 2 0 0 1 4 0m3 8V5a2 2 0 0 1 4 0M5 8h7M5 12h7M3 17q2-2 4 0t4 0 4 0 4 0m-16 4q2-2 4 0t4 0 4 0 4 0" />
    </>
  ),
  measure: <path d="m3 16 13-13 5 5L8 21zM8 11l2 2m2-6 2 2m2-6 2 2" />,
  undo: <path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3" />,
  redo: <path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12h3" />,
  rooms: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M12 3v7m0 4v7M3 12h5m8 0h5" />
    </>
  ),
  devices: <path d="M9 3v6m6-6v6M6 9h12v3a6 6 0 0 1-12 0Zm6 9v3" />,
  refresh: <path d="M20 4v6h-6M4 20v-6h6M19 8a7 7 0 0 0-12-3L4 8m1 8a7 7 0 0 0 12 3l3-3" />,
  warning: <path d="M12 3 2 21h20ZM12 9v5m0 3v.1" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  arrowUp: <path d="M12 20V4m-6 6 6-6 6 6" />,
  arrowDown: <path d="M12 4v16m-6-6 6 6 6-6" />,
} as const;

export type EditorIconName = keyof typeof paths | EditorMode;

export function EditorIcon({ name }: { name: EditorIconName }) {
  if (name === "construct" || name === "furnish" || name === "connect") {
    return <EditorModeIcon name={name} className="editor-icon" />;
  }
  return (
    <svg
      className="editor-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
