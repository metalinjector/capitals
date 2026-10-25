import raw from "./data/wiki-photos.json";

export interface WikiBundle {
  wiki: string;
  photos: string[];
}

export const wikiCatalog = raw as Record<string, WikiBundle>;

const ALLOWED = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];

function normalizeWikiUrl(url: string) {
  let u = url.replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/");
  u = u.replace(/\/(\d+)px-/, (_m, n) => {
    const size = Number(n);
    if (ALLOWED.includes(size)) return `/${size}px-`;
    const next = ALLOWED.find((s) => s >= Math.min(size, 1280)) ?? 1280;
    return `/${next}px-`;
  });
  if (/\/\d+px-/.test(u) === false && /\/thumb\//.test(u)) {
    u = u.replace(/(\.jpe?g|\.png|\.webp|\.JPG)$/i, "/1280px-$1");
  }
  return u;
}

export function photosOf(id: string): string[] {
  return (wikiCatalog[id]?.photos ?? []).map(normalizeWikiUrl);
}

export function wikiTitle(id: string): string {
  return wikiCatalog[id]?.wiki ?? "";
}

export function wikipediaUrl(id: string) {
  const title = wikiTitle(id) || "Europe";
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function britannicaUrl(place: string) {
  return `https://www.britannica.com/place/${encodeURIComponent(place.replace(/\s+/g, "-"))}`;
}

export function commonsFileUrl(photoUrl: string) {
  const m = photoUrl.match(/\/([^/]+\.(?:jpe?g|png|webp|JPG))$/i);
  if (!m) return "https://commons.wikimedia.org/";
  const file = m[1].replace(/^\d+px-/, "");
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;
}
