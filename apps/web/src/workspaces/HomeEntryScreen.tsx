import type { HomeProject } from "@cabane/engine";
import { Link } from "react-router";
import "./home-entry.css";

export const HOME_ENTRY_REVEAL_MS = 180;

export function homeEntryDetails(project: HomeProject) {
  const floors = project.floors.filter((floor) => floor.footprint.length >= 3);
  return {
    name: project.home.name,
    floors: floors.length,
    rooms: floors.reduce(
      (count, floor) => count + floor.rooms.filter((room) => !room.isSolid).length,
      0,
    ),
  };
}

export function HomeEntryScreen({
  name,
  floors,
  rooms,
  revealing = false,
}: {
  name?: string | undefined;
  floors?: number | undefined;
  rooms?: number | undefined;
  revealing?: boolean;
}) {
  return (
    <section
      className="home-entry-screen"
      data-revealing={revealing || undefined}
      inert={revealing}
      aria-label="Opening home"
      style={{ transitionDuration: `${HOME_ENTRY_REVEAL_MS}ms` }}
    >
      <div className="home-entry-art" aria-hidden="true" />
      <div className="home-entry-top">
        <span className="home-entry-brand">
          cabane<span>.</span>
        </span>
        <Link className="home-entry-back" to="/workspaces">
          <span aria-hidden="true">←</span> Workspaces
        </Link>
      </div>
      <div className="home-entry-title">
        <h1>{name || "Your home"}</h1>
        {floors !== undefined && floors > 0 && (
          <p className="home-entry-details">
            <span>{floors === 1 ? "1 floor" : `${floors} floors`}</span>
            {rooms !== undefined && rooms > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{rooms === 1 ? "1 room" : `${rooms} rooms`}</span>
              </>
            )}
          </p>
        )}
        <div className="home-entry-status" role="status">
          <span className="home-entry-spinner" aria-hidden="true" />
          Loading 3D view…
        </div>
      </div>
    </section>
  );
}
