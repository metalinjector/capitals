import type { Capital } from "./data/capitals";
import { capitals } from "./data/capitals";
import { shuffle } from "./lib";

export const FALLING_ROUND_SIZE = 8;
export const FALLING_TILE_DURATION_MS = 28_000;
export const FALLING_SPAWN_INTERVAL_MS = 1_600;

export type FallingTileKind = "country" | "capital";

export interface FallingTile {
  id: string;
  pairId: string;
  capitalId: string;
  kind: FallingTileKind;
  label: string;
  lane: 0 | 1;
  queueRow: number;
}

export interface FallingRound {
  capitals: Capital[];
  queue: FallingTile[];
}

/** Pick a fresh round and stagger each matching token pair across the falling queue. */
export function createFallingRound(
  pool: Capital[] = capitals,
  runId = `round-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
): FallingRound {
  const selected = shuffle(pool).slice(0, Math.min(FALLING_ROUND_SIZE, pool.length));
  const pairs = shuffle(selected).map((capital) => {
    const pairId = `${runId}-${capital.id}`;
    const country: FallingTile = {
      id: `${pairId}-country`, pairId, capitalId: capital.id, kind: "country", label: capital.country,
      lane: 0, queueRow: 0,
    };
    const city: FallingTile = {
      id: `${pairId}-capital`, pairId, capitalId: capital.id, kind: "capital", label: capital.capital,
      lane: 0, queueRow: 0,
    };
    return Math.random() < 0.5 ? { first: country, second: city } : { first: city, second: country };
  });

  // Keep each answer close: pairs are interleaved in short waves, never more than 3 spawns apart.
  const tokens: FallingTile[] = [];
  for (let index = 0; index < pairs.length; index += 3) {
    const wave = pairs.slice(index, index + 3);
    tokens.push(...wave.map((pair) => pair.first), ...wave.map((pair) => pair.second));
  }
  const firstLane = Math.random() < 0.5 ? 0 : 1;
  const queue = tokens.map((token, index): FallingTile => ({
    ...token,
    lane: ((index + firstLane) % 2) as 0 | 1,
    queueRow: Math.floor(index / 2),
  }));

  return { capitals: selected, queue };
}
