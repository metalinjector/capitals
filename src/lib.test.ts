import { describe, expect, it } from "vitest";
import { capitals } from "./data/capitals";
import {
  addDays,
  capitalOfTheDay,
  dueIds,
  emptyProgress,
  importProgress,
  isCapitalMatch,
  isCountryMatch,
  scheduleReview,
} from "./lib";

const byId = (id: string) => capitals.find((capital) => capital.id === id)!;

describe("answer matching and daily content", () => {
  it("accepts known spelling variants but not the country name as Andorra's capital", () => {
    expect(isCapitalMatch("ANDORRA LA VELLA", byId("ad"))).toBe(true);
    expect(isCapitalMatch("андорра-ла-велья", byId("ad"))).toBe(true);
    expect(isCapitalMatch("Андорра", byId("ad"))).toBe(false);
    expect(isCountryMatch("United Kingdom", byId("gb"))).toBe(true);
    expect(isCountryMatch("England", byId("gb"))).toBe(false);
    expect(isCapitalMatch("КИЇВ", byId("ua"))).toBe(true);
  });

  it("selects the same daily capital for a UTC calendar day and starts on 1 January", () => {
    expect(capitalOfTheDay("2024-01-01")).toBe(capitals[0]);
    expect(capitalOfTheDay("2024-03-01")).toBe(capitalOfTheDay("2024-03-01"));
    expect(capitalOfTheDay("not-a-date")).toBe(capitals[0]);
  });
});

describe("spaced repetition and imported progress", () => {
  it("handles leap days and the review schedule", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(scheduleReview(undefined, true, "2024-02-28")).toEqual({ box: 1, due: "2024-02-29" });
    expect(scheduleReview({ box: 1, due: "2024-02-29" }, true, "2024-02-29")).toEqual({ box: 2, due: "2024-03-03" });
    expect(scheduleReview({ box: 4, due: "2024-03-01" }, false, "2024-03-01")).toEqual({ box: 0, due: "2024-03-02" });
  });

  it("filters invalid and unknown data when importing a progress file", () => {
    const validSession = { date: "2026-10-25T12:00:00.000Z", mode: "choice", region: "all", score: 3, total: 4, points: 30 };
    const imported = importProgress(JSON.stringify({
      app: "atlas-europa",
      version: 1,
      progress: {
        ...emptyProgress(),
        mastery: { at: 99, unknown: 5 },
        seen: { at: 3, unknown: 4 },
        correct: { at: 5 },
        srs: {
          at: { due: "2026-10-26", box: 99 },
          de: { due: "2026-02-30", box: 2 },
        },
        totalPoints: -50,
        bestStreak: "not a number",
        totalSessions: 0,
        sessions: [validSession, { date: "bad", mode: "bogus", region: "all" }],
      },
    }));

    expect(imported).not.toBeNull();
    expect(imported?.mastery).toEqual({ at: 5 });
    expect(imported?.seen).toEqual({ at: 3 });
    expect(imported?.srs).toEqual({ at: { due: "2026-10-26", box: 5 } });
    expect(imported?.totalPoints).toBe(0);
    expect(imported?.bestStreak).toBe(0);
    expect(imported?.totalSessions).toBe(1);
    expect(imported?.sessions).toHaveLength(1);
    expect(importProgress("not json")).toBeNull();
  });

  it("returns only known cards due on or before today", () => {
    const progress = emptyProgress();
    progress.srs = {
      at: { due: "2026-10-24", box: 1 },
      de: { due: "2026-10-25", box: 2 },
      fr: { due: "2026-10-26", box: 1 },
      unknown: { due: "2026-10-20", box: 1 },
    };
    expect(dueIds(progress, "2026-10-25")).toEqual(["at", "de"]);
  });
});
