import { describe, expect, it } from "vitest";
import { capitals } from "./capitals";
import { MAP_IDS } from "./europeMap";
import { COUNTRY_DATA_AS_OF, COUNTRY_PROFILES, populationMethodNote } from "./countryProfiles";

describe("country reference data", () => {
  it("has one complete country profile for every atlas capital", () => {
    const ids = capitals.map((capital) => capital.id);
    expect(new Set(ids).size).toBe(45);
    expect(Object.keys(COUNTRY_PROFILES).sort()).toEqual([...ids].sort());
    expect([...ids].filter((id) => !MAP_IDS.has(id))).toEqual([]);

    for (const id of ids) {
      const profile = COUNTRY_PROFILES[id];
      expect(profile.languages, id).toBeTruthy();
      expect(profile.currencyCode, id).toMatch(/^[A-Z]{3}$/);
      expect(profile.currency, id).toBeTruthy();
      expect(profile.population, id).toBeGreaterThan(0);
      expect(profile.populationYear, id).toBeGreaterThanOrEqual(2023);
      expect(profile.areaKm2, id).toBeGreaterThan(0);
      expect(profile.fact, id).toBeTruthy();
    }
  });

  it("matches current EU, euro-area and Schengen membership counts", () => {
    const profiles = Object.values(COUNTRY_PROFILES);
    expect(profiles.filter((profile) => profile.euMember)).toHaveLength(27);
    expect(profiles.filter((profile) => profile.euroArea)).toHaveLength(21);
    expect(profiles.filter((profile) => profile.schengenMember)).toHaveLength(29);
    expect(COUNTRY_DATA_AS_OF).toBe("2026-10-25");
    expect(Object.values(COUNTRY_PROFILES).filter((profile) => profile.populationYear === 2025)).toHaveLength(44);
    expect(COUNTRY_PROFILES.va).toMatchObject({ population: 882, populationYear: 2024, areaKm2: 0.44 });
  });

  it("only mentions Vatican's separate 2024 population source on its own card", () => {
    expect(populationMethodNote(COUNTRY_PROFILES.by)).toBe("Население округлено: оценка ООН WPP 2024 на середину 2025 года.");
    expect(populationMethodNote(COUNTRY_PROFILES.va)).toContain("официальный показатель за 2024 год");
    for (const [id, profile] of Object.entries(COUNTRY_PROFILES)) {
      if (id !== "va") {
        expect(populationMethodNote(profile)).not.toContain("Ватикан");
        expect(profile.note ?? "").not.toContain("Ватикан");
      }
    }
  });

  it("does not conflate the EU, euro area, currency and Schengen", () => {
    expect(COUNTRY_PROFILES.bg).toMatchObject({ currencyCode: "EUR", euMember: true, euroArea: true, schengenMember: true });
    expect(COUNTRY_PROFILES.ro).toMatchObject({ currencyCode: "RON", euMember: true, euroArea: false, schengenMember: true });
    expect(COUNTRY_PROFILES.me).toMatchObject({ currencyCode: "EUR", euMember: false, euroArea: false, schengenMember: false });
    expect(COUNTRY_PROFILES.cy).toMatchObject({ currencyCode: "EUR", euMember: true, euroArea: true, schengenMember: false });
    expect(COUNTRY_PROFILES.ch).toMatchObject({ currencyCode: "CHF", euMember: false, euroArea: false, schengenMember: true });
    for (const profile of Object.values(COUNTRY_PROFILES).filter((item) => item.euroArea)) {
      expect(profile.euMember).toBe(true);
      expect(profile.currencyCode).toBe("EUR");
    }
  });
});
