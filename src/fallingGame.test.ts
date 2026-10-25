import { describe, expect, it } from "vitest";
import { capitals } from "./data/capitals";
import { createFallingRound, FALLING_ROUND_SIZE } from "./fallingGame";

describe("falling capital pairs", () => {
  it("creates one country and one capital tile per pair", () => {
    const round = createFallingRound(capitals, "test-round");
    expect(round.capitals).toHaveLength(FALLING_ROUND_SIZE);
    expect(round.queue).toHaveLength(FALLING_ROUND_SIZE * 2);
    expect(new Set(round.queue.map((tile) => tile.id)).size).toBe(round.queue.length);

    for (const capital of round.capitals) {
      const pair = round.queue.filter((tile) => tile.capitalId === capital.id);
      expect(pair.map((tile) => tile.kind).sort()).toEqual(["capital", "country"]);
      expect(pair[0].pairId).toBe(pair[1].pairId);
      const spawnGap = Math.abs(round.queue.indexOf(pair[0]) - round.queue.indexOf(pair[1]));
      expect([2, 3]).toContain(spawnGap);
      expect(pair[0].lane === pair[1].lane).toBe(spawnGap % 2 === 0);
    }
  });

  it("balances falling tiles between lanes and exposes two static rows per wave", () => {
    const { queue } = createFallingRound(capitals, "test-round");
    expect(queue.filter((tile) => tile.lane === 0)).toHaveLength(FALLING_ROUND_SIZE);
    expect(queue.filter((tile) => tile.lane === 1)).toHaveLength(FALLING_ROUND_SIZE);
    expect(queue.map((tile) => tile.queueRow)).toEqual(queue.map((_, index) => Math.floor(index / 2)));
  });
});
