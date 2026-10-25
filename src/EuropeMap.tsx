import { capitals } from "./data/capitals";
import { MAP_HEIGHT, MAP_MARKERS, MAP_SHAPES, MAP_WIDTH } from "./data/europeMap";

const BY_ID = new Map(capitals.map((c) => [c.id, c]));

interface EuropeMapProps {
  /** click handler: receives the capital id of the clicked country */
  onPick?: (id: string) => void;
  /** mastery per capital id — learned countries are shaded */
  mastery?: Record<string, number>;
  /** country to highlight as the right answer */
  highlight?: string | null;
  /** country the player picked and got wrong */
  wrong?: string | null;
  /** currently picked country */
  selected?: string | null;
  /** do not reveal country names (quiz mode) */
  hideNames?: boolean;
  className?: string;
}

export default function EuropeMap({ onPick, mastery, highlight, wrong, selected, hideNames, className }: EuropeMapProps) {
  const interactive = Boolean(onPick);

  function fillOf(id: string) {
    if (highlight === id) return "#3d9b7a";
    if (wrong === id) return "#b4485f";
    if (selected === id) return "#d4a853";
    const m = mastery?.[id] ?? 0;
    if (m >= 3) return "rgba(212,168,83,0.5)";
    if (m > 0) return "rgba(212,168,83,0.26)";
    return "rgba(244,234,213,0.13)";
  }

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className={className ?? "h-auto w-full"}
      role="img"
      aria-label="Карта Европы"
    >
      {MAP_SHAPES.map((shape) => {
        const c = BY_ID.get(shape.id);
        return (
          <path
            key={shape.id}
            d={shape.d}
            fill={fillOf(shape.id)}
            stroke="rgba(232,213,163,0.45)"
            strokeWidth={1}
            fillRule="evenodd"
            className={`transition-colors duration-200 ${
              interactive ? "cursor-pointer hover:opacity-80 focus:outline-none focus-visible:opacity-80" : ""
            }`}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? "button" : undefined}
            aria-label={hideNames || !c ? "Страна" : `${c.country} — ${c.capital}`}
            onClick={interactive ? () => onPick?.(shape.id) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick?.(shape.id);
                    }
                  }
                : undefined
            }
          >
            <title>{hideNames || !c ? "Страна" : `${c.country} — ${c.capital}`}</title>
          </path>
        );
      })}
      {MAP_MARKERS.map((marker) => {
        const c = BY_ID.get(marker.id);
        return (
          <circle
            key={marker.id}
            cx={marker.x}
            cy={marker.y}
            r={marker.id === "va" || marker.id === "mc" || marker.id === "sm" ? 4 : 3.4}
            fill={fillOf(marker.id)}
            stroke="rgba(232,213,163,0.6)"
            strokeWidth={1}
            className={interactive ? "cursor-pointer" : undefined}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? "button" : undefined}
            aria-label={hideNames || !c ? "Страна" : `${c.country} — ${c.capital}`}
            onClick={interactive ? () => onPick?.(marker.id) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick?.(marker.id);
                    }
                  }
                : undefined
            }
          >
            <title>{hideNames || !c ? "Страна" : `${c.country} — ${c.capital}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
