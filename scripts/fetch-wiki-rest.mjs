import { readFileSync, writeFileSync } from "fs";

const titles = {
  at: "Vienna",
  al: "Tirana",
  ad: "Andorra_la_Vella",
  by: "Minsk",
  be: "Brussels",
  bg: "Sofia",
  ba: "Sarajevo",
  va: "Vatican_City",
  gb: "London",
  hu: "Budapest",
  de: "Berlin",
  gr: "Athens",
  dk: "Copenhagen",
  ie: "Dublin",
  is: "Reykjavík",
  es: "Madrid",
  it: "Rome",
  cy: "Nicosia",
  lv: "Riga",
  lt: "Vilnius",
  li: "Vaduz",
  lu: "Luxembourg_City",
  mt: "Valletta",
  md: "Chișinău",
  mc: "Monaco",
  nl: "Amsterdam",
  no: "Oslo",
  pl: "Warsaw",
  pt: "Lisbon",
  ru: "Moscow",
  ro: "Bucharest",
  sm: "City_of_San_Marino",
  mk: "Skopje",
  rs: "Belgrade",
  sk: "Bratislava",
  si: "Ljubljana",
  ua: "Kyiv",
  fi: "Helsinki",
  fr: "Paris",
  hr: "Zagreb",
  me: "Podgorica",
  cz: "Prague",
  ch: "Bern",
  se: "Stockholm",
  ee: "Tallinn",
};

const SKIP =
  /flag|coat_of_arms|coat of arms|logo|icon|map_|location|locator|svg|gif|symbol|seal|banner|wordmark|pictogram|emblem|signature|diagram|chart|\.svg/i;

function abs(u) {
  if (!u) return "";
  if (u.startsWith("//")) return "https:" + u.split("?")[0];
  return u.split("?")[0];
}

function biggerThumb(u) {
  // request a reasonably large thumbnail
  return u.replace(/\/\d+px-/, "/1600px-");
}

async function mediaList(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AtlasEuropa/1.0 (educational geography quiz)", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function extract(json) {
  const out = [];
  for (const it of json.items || []) {
    if (it.type !== "image") continue;
    const title = it.title || "";
    if (SKIP.test(title)) continue;
    const set = it.srcset || [];
    const src = set.length ? set[set.length - 1].src : "";
    const url = biggerThumb(abs(src));
    if (!url) continue;
    if (!/\.(jpe?g|png|webp)$/i.test(title) && !/\.(jpe?g|png|webp)(\?|$)/i.test(url)) continue;
    out.push(url);
  }
  return [...new Set(out)];
}

let prev = {};
try {
  prev = JSON.parse(readFileSync("src/data/wiki-photos.json", "utf8"));
} catch {}

const result = { ...prev };

for (const [id, title] of Object.entries(titles)) {
  if ((result[id]?.photos || []).length >= 3) {
    process.stderr.write(`skip ${id}\n`);
    continue;
  }
  process.stderr.write(`fetch ${id} ${title}\n`);
  try {
    const photos = extract(await mediaList(title)).slice(0, 6);
    result[id] = { wiki: title.replace(/_/g, " "), photos };
    process.stderr.write(`  -> ${photos.length}\n`);
  } catch (e) {
    process.stderr.write(`  fail ${e.message}\n`);
    result[id] = result[id] || { wiki: title.replace(/_/g, " "), photos: [] };
  }
  await new Promise((r) => setTimeout(r, 600));
}

const missing = Object.entries(result).filter(([, v]) => v.photos.length < 3);
process.stderr.write(`missing ${missing.length}: ${missing.map(([k]) => k).join(", ")}\n`);
writeFileSync("src/data/wiki-photos.json", JSON.stringify(result, null, 2));
