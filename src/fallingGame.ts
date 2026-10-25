import type { Capital } from "./data/capitals";
import { capitals } from "./data/capitals";
import { shuffle } from "./lib";

export const FALLING_ROUND_SIZE = 8;
export const FALLING_TILE_DURATION_MS = 28_000;
export const FALLING_SPAWN_INTERVAL_MS = 1_600;
export const MAX_UNRELATED_TILES_BETWEEN_PAIR = 3;

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

type FallingPair = { first: FallingTile; second: FallingTile };

/** Randomly order tiles while keeping at least one and at most three tiles between each pair. */
function arrangePairTokens(pairs: FallingPair[]): FallingTile[] {
  const tokens = pairs.flatMap(({ first, second }) => [first, second]);
  if (pairs.length < 2) return tokens;

  const minGap = 2;
  const maxGap = Math.min(MAX_UNRELATED_TILES_BETWEEN_PAIR + 1, tokens.length - 1);
  const ordered: FallingTile[] = [];
  const placedIds = new Set<string>();
  const firstPosition = new Map<string, number>();
  const placedPerPair = new Map<string, number>();

  function canStillComplete() {
    const openPairs = [...firstPosition.entries()]
      .filter(([pairId]) => placedPerPair.get(pairId) === 1)
      .map(([, first]) => ({ first, deadline: first + maxGap }))
      .sort((a, b) => a.deadline - b.deadline);

    let nextAvailable = ordered.length;
    for (const pair of openPairs) {
      const slot = Math.max(nextAvailable, pair.first + minGap);
      if (slot > pair.deadline || slot >= tokens.length) return false;
      nextAvailable = slot + 1;
    }
    return true;
  }

  function search(): boolean {
    if (ordered.length === tokens.length) return true;
    const index = ordered.length;
    const candidates = shuffle(
      tokens.filter((tile) => {
        if (placedIds.has(tile.id)) return false;
        const first = firstPosition.get(tile.pairId);
        return first === undefined || (index - first >= minGap && index - first <= maxGap);
      })
    );

    for (const tile of candidates) {
      const first = firstPosition.get(tile.pairId);
      if (first === undefined) firstPosition.set(tile.pairId, index);
      placedPerPair.set(tile.pairId, (placedPerPair.get(tile.pairId) ?? 0) + 1);
      placedIds.add(tile.id);
      ordered.push(tile);

      if (canStillComplete() && search()) return true;

      ordered.pop();
      placedIds.delete(tile.id);
      if (first === undefined) firstPosition.delete(tile.pairId);
      const count = placedPerPair.get(tile.pairId)! - 1;
      if (count === 0) placedPerPair.delete(tile.pairId);
      else placedPerPair.set(tile.pairId, count);
    }
    return false;
  }

  // The bounds are satisfiable for every round with at least two pairs. Keep a bounded fallback
  // in case the search constraints change later, rather than preventing a round from starting.
  if (!search()) {
    const fallback: FallingTile[] = [];
    const fallbackPairs = shuffle(pairs);
    for (let index = 0; index < fallbackPairs.length; ) {
      const remaining = fallbackPairs.length - index;
      let waveSize = Math.min(3, remaining);
      if (remaining - waveSize === 1) waveSize -= 1;
      const wave = shuffle(fallbackPairs.slice(index, index + waveSize));
      fallback.push(...wave.map((pair) => pair.first), ...wave.map((pair) => pair.second));
      index += waveSize;
    }
    return fallback;
  }
  return ordered;
}

/** Pick a fresh round and randomize matching-token positions within the spacing cap. */
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

  const tokens = arrangePairTokens(pairs);
  const firstLane = Math.random() < 0.5 ? 0 : 1;
  const queue = tokens.map((token, index): FallingTile => ({
    ...token,
    lane: ((index + firstLane) % 2) as 0 | 1,
    queueRow: Math.floor(index / 2),
  }));

  return { capitals: selected, queue };
}
