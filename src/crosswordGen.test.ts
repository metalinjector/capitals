import { describe, expect, it } from "vitest";
import { capitals } from "./data/capitals";
import { cellsOf, factClue, generatePuzzle, toAnswer } from "./crosswordGen";

describe("capital crossword generation", () => {
  it("normalizes Russian capital names for the grid", () => {
    expect(toAnswer("Андорра-ла-Велья")).toBe("АНДОРРАЛАВЕЛЬЯ");
    expect(toAnswer("КИЁВ")).toBe("КИЕВ");
  });

  it("builds the same bounded, numbered crossword from the same seed", () => {
    const pool = capitals.filter((capital) => capital.school);
    const first = generatePuzzle(pool, 7, 11, 123456);
    const second = generatePuzzle(pool, 7, 11, 123456);

    expect(first).toEqual(second);
    expect(first.entries.length).toBeGreaterThanOrEqual(4);
    expect(first.entries.length).toBeLessThanOrEqual(7);
    expect(first.rows).toBeLessThanOrEqual(11);
    expect(first.cols).toBeLessThanOrEqual(11);
    expect(first.entries.every((entry) => cellsOf(entry).length === entry.answer.length)).toBe(true);
    expect(first.grid.flat().some(Boolean)).toBe(true);
  });

  it("produces a usable clue even with a negative seed or an empty fact list", () => {
    const capital = { ...capitals[0], facts: [] };
    expect(factClue(capitals[0], 1, -2)).toBeTruthy();
    expect(factClue(capital, 1, -2)).toBe(`Столица страны: ${capital.country}`);
  });
});
