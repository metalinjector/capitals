import { describe, expect, it, vi } from "vitest";
import { capitals } from "./data/capitals";
import {
  createFallingRound,
  FALLING_ROUND_SIZE,
  MAX_UNRELATED_TILES_BETWEEN_PAIR,
} from "./fallingGame";

describe("falling capital pairs", () => {
  it("creates one country and one capital tile per pair with bounded spacing", () => {
    const spacingPatterns = new Set<string>();
    for (let run = 0; run < 24; run += 1) {
      const round = createFallingRound(capitals, `test-round-${run}`);
      expect(round.capitals).toHaveLength(FALLING_ROUND_SIZE);
      expect(round.queue).toHaveLength(FALLING_ROUND_SIZE * 2);
      expect(new Set(round.queue.map((tile) => tile.id)).size).toBe(round.queue.length);
      const gaps: number[] = [];

      for (const capital of round.capitals) {
        const pair = round.queue.filter((tile) => tile.capitalId === capital.id);
        expect(pair.map((tile) => tile.kind).sort()).toEqual(["capital", "country"]);
        expect(pair[0].pairId).toBe(pair[1].pairId);
        const spawnGap = Math.abs(round.queue.indexOf(pair[0]) - round.queue.indexOf(pair[1]));
        gaps.push(spawnGap);
        expect(spawnGap).toBeGreaterThanOrEqual(2);
        expect(spawnGap - 1).toBeLessThanOrEqual(MAX_UNRELATED_TILES_BETWEEN_PAIR);
        expect(pair[0].lane === pair[1].lane).toBe(spawnGap % 2 === 0);
      }
      spacingPatterns.add(gaps.sort((a, b) => a - b).join(","));
    }
    expect(spacingPatterns.size).toBeGreaterThan(1);
  });

  it("varies the legal pair schedule with the random order", () => {
    const queueForRandomValue = (value: number) => {
      const random = vi.spyOn(Math, "random").mockReturnValue(value);
      try {
        return createFallingRound(capitals, "random-order-check").queue
          .map((tile) => `${tile.capitalId}:${tile.kind}`)
          .join("|");
      } finally {
        random.mockRestore();
      }
    };

    expect(queueForRandomValue(0)).not.toBe(queueForRandomValue(0.999));
  });

  it("balances falling tiles between lanes and assigns rows in spawn order", () => {
    const { queue } = createFallingRound(capitals, "test-round");
    expect(queue.filter((tile) => tile.lane === 0)).toHaveLength(FALLING_ROUND_SIZE);
    expect(queue.filter((tile) => tile.lane === 1)).toHaveLength(FALLING_ROUND_SIZE);
    expect(queue.map((tile) => tile.queueRow)).toEqual(queue.map((_, index) => Math.floor(index / 2)));
  });
});
