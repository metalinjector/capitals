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
  /flag|coat_of_arms|coat of arms|logo|icon|map_|location_map|locator|svg|gif|symbol|seal of|banner|wordmark|pictogram|emblem|signature|diagram|chart|audio|ogg|webm|svg/i;

function cleanUrl(u) {
  if (!u) return "";
  return u.split("?")[0];
}

async function wiki(title) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=images&gimlimit=40&prop=imageinfo" +
    "&iiprop=url|mime|size|extmetadata&iiurlwidth=1600&titles=" +
    encodeURIComponent(title.replace(/ /g, "_"));
  const res = await fetch(url, {
    headers: { "User-Agent": "AtlasEuropa/1.0 (educational geography quiz)" },
  });
  return res.json();
}

async function commonsSearch(q) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrsearch=" +
    encodeURIComponent(q) +
    "&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1600";
  const res = await fetch(url, {
    headers: { "User-Agent": "AtlasEuropa/1.0 (educational geography quiz)" },
  });
  return res.json();
}

function extract(json) {
  const pages = Object.values(json?.query?.pages || {});
  const out = [];
  for (const p of pages) {
    const title = p.title || "";
    const ii = (p.imageinfo || [])[0];
    if (!ii) continue;
    const mime = ii.mime || "";
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mime)) continue;
    if (SKIP.test(title) || SKIP.test(ii.url || "")) continue;
    const url = cleanUrl(ii.thumburl || ii.url);
    if (!url) continue;
    if (url.includes("/wikipedia/en/")) continue;
    out.push({
      url,
      title: title.replace(/^File:/, ""),
      source: "Wikimedia Commons / Wikipedia",
    });
  }
  return out;
}

function unique(arr) {
  const seen = new Set();
  return arr.filter((x) => {
    if (seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });
}

const result = {};
for (const [id, title] of Object.entries(titles)) {
  process.stderr.write(`fetch ${id} ${title}\n`);
  let photos = [];
  try {
    photos = extract(await wiki(title));
  } catch (e) {
    process.stderr.write(` wiki fail ${title}: ${e}\n`);
  }
  if (photos.length < 3) {
    try {
      const extra = extract(await commonsSearch(`${title.replace(/_/g, " ")} city skyline`));
      photos = unique([...photos, ...extra]);
    } catch (e) {
      process.stderr.write(` commons fail ${title}: ${e}\n`);
    }
  }
  if (photos.length < 3) {
    try {
      const extra = extract(await commonsSearch(title.replace(/_/g, " ")));
      photos = unique([...photos, ...extra]);
    } catch {}
  }
  result[id] = {
    wiki: title.replace(/_/g, " "),
    photos: photos.slice(0, 6).map((p) => p.url),
  };
  await new Promise((r) => setTimeout(r, 250));
}

const missing = Object.entries(result).filter(([, v]) => v.photos.length < 3);
process.stderr.write(`missing ${missing.length}: ${missing.map(([k]) => k).join(", ")}\n`);
console.log(JSON.stringify(result, null, 2));
