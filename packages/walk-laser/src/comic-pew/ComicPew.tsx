import type { CSSProperties, RefObject } from "react";
import { pewArt } from "./pew-art";
import "./comic-pew.css";

/** Camera-local ink and flat cel colors, kept clear of the aiming reticle. */
export function ComicPew({
  shotId,
  shotColor,
  anchor,
  reducedMotion,
}: {
  shotId: number;
  shotColor?: string | undefined;
  anchor: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  const art = pewArt(shotId, shotColor);
  const style = {
    "--pew-angle": `${art.angle}deg`,
    "--pew-drift": `${art.drift}px`,
    "--pew-lift": `${art.lift}px`,
    "--pew-scale": art.scale,
  } as CSSProperties;
  return (
    <div ref={anchor} className="comic-pew-anchor" aria-hidden="true">
      {shotId > 0 && (
        <div
          key={shotId}
          className="comic-pew"
          data-shot={shotId}
          data-reduced-motion={reducedMotion}
          style={style}
        >
          <svg viewBox="-18 -20 316 174" className="comic-pew__art" focusable="false">
            <title>{art.label}</title>
            <g stroke="#202036" strokeWidth="4" strokeLinejoin="round">
              <g className="comic-pew__burst">
                <polygon points={art.points} fill="#202036" transform="translate(4 7)" />
                <polygon points={art.points} fill={art.paper} />
                <path
                  d="M38 81L66 91L59 99L111 91L142 108L154 92L202 94L219 77L247 70L225 97L201 101L185 117L151 104L130 115L107 101L73 108L73 94Z"
                  fill={art.shade}
                  stroke="none"
                />
                <path
                  d="M29 58L50 52M58 22L69 34M121 13L123 26M242 45L254 38"
                  fill="none"
                  stroke="#fffdf0"
                  strokeWidth="4"
                />
                {[0, 1, 2, 3, 4].map((i) => (
                  <circle
                    key={i}
                    cx={81 + i * 18}
                    cy={99 + (i % 2) * 3}
                    r="2"
                    fill="#202036"
                    stroke="none"
                    opacity=".35"
                  />
                ))}
              </g>
              <g className="comic-pew__rays" fill={art.paper}>
                <path d="M15 30L-9 15L3 37Z M48 9L43 -10L59 13Z M263 21L285 4L277 29Z M268 93L290 101L267 104Z" />
                <path
                  d="M6 74L-9 82M242 121L253 132"
                  fill="none"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </g>
              <g className="comic-pew__letters" transform="translate(10 0) skewX(-10)">
                <path
                  d={art.letters}
                  transform="translate(2 5)"
                  fill="#202036"
                  strokeWidth="7"
                  fillRule="evenodd"
                />
                <path d={art.letters} fill={art.ink} strokeWidth="5" fillRule="evenodd" />
                <path
                  d={art.highlights}
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
