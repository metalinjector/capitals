import type { Capital } from "./data/capitals";

export type Dir = "across" | "down";

export interface Entry {
  id: string; // capital id
  answer: string; // uppercase letters only
  display: string; // original capital name
  row: number;
  col: number;
  dir: Dir;
  num: number;
  capital: Capital;
}

export interface Puzzle {
  rows: number;
  cols: number;
  grid: (string | null)[][]; // solution letters or null for block
  numbers: (number | null)[][];
  entries: Entry[];
  seed: number;
}

/** Answer form: capital name in Russian, uppercase, ё→е, hyphens/spaces removed. */
export function toAnswer(s: string) {
  return s
    .toUpperCase()
    .replace(/Ё/g, "Е")
    .replace(/[^А-ЯA-Z]/g, "");
}

interface Placed {
  word: string;
  cap: Capital;
  row: number;
  col: number;
  dir: Dir;
}

type Board = Map<string, string>;
const key = (r: number, c: number) => `${r},${c}`;

function canPlace(board: Board, word: string, row: number, col: number, dir: Dir): number {
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;

  // the cell before the start and after the end must be empty — otherwise we'd glue words together
  if (board.has(key(row - dr, col - dc))) return -1;
  if (board.has(key(row + dr * word.length, col + dc * word.length))) return -1;

  let crossings = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = board.get(key(r, c));
    if (existing) {
      if (existing !== word[i]) return -1;
      crossings++;
      continue;
    }
    // new letter: perpendicular neighbours must be empty (no accidental two-letter words)
    if (dir === "across") {
      if (board.has(key(r - 1, c)) || board.has(key(r + 1, c))) return -1;
    } else {
      if (board.has(key(r, c - 1)) || board.has(key(r, c + 1))) return -1;
    }
  }
  return crossings;
}

function put(board: Board, p: Placed) {
  const dr = p.dir === "down" ? 1 : 0;
  const dc = p.dir === "across" ? 1 : 0;
  for (let i = 0; i < p.word.length; i++) board.set(key(p.row + dr * i, p.col + dc * i), p.word[i]);
}

function bounds(board: Board) {
  let minR = Infinity,
    maxR = -Infinity,
    minC = Infinity,
    maxC = -Infinity;
  for (const k of board.keys()) {
    const [r, c] = k.split(",").map(Number);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }
  return { minR, maxR, minC, maxC };
}

function shuffle<T>(a: T[], rnd: () => number) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** One attempt of the classic iterative placement algorithm. */
function attempt(pool: Capital[], target: number, maxSize: number, rnd: () => number) {
  const words = shuffle(pool, rnd)
    .map((cap) => ({ cap, word: toAnswer(cap.capital) }))
    .filter((w) => w.word.length >= 3 && w.word.length <= maxSize);

  // start from a long word to give a good "spine"
  const first = words
    .slice(0, 8)
    .sort((a, b) => b.word.length - a.word.length)[0];
  if (!first) return null;

  const board: Board = new Map();
  const placed: Placed[] = [];
  const startDir: Dir = rnd() < 0.5 ? "across" : "down";
  const p0: Placed = { ...first, row: 0, col: 0, dir: startDir };
  put(board, p0);
  placed.push(p0);

  const rest = words.filter((w) => w !== first);
  let skipped: typeof rest = [];

  for (let pass = 0; pass < 4 && placed.length < target; pass++) {
    const queue = pass === 0 ? rest : skipped;
    skipped = [];
    for (const w of queue) {
      if (placed.length >= target) break;
      let best: { p: Placed; score: number } | null = null;

      for (const other of placed) {
        const newDir: Dir = other.dir === "across" ? "down" : "across";
        for (let i = 0; i < other.word.length; i++) {
          for (let j = 0; j < w.word.length; j++) {
            if (other.word[i] !== w.word[j]) continue;
            const crossR = other.row + (other.dir === "down" ? i : 0);
            const crossC = other.col + (other.dir === "across" ? i : 0);
            const row = newDir === "down" ? crossR - j : crossR;
            const col = newDir === "across" ? crossC - j : crossC;
            const crossings = canPlace(board, w.word, row, col, newDir);
            if (crossings < 1) continue;

            // keep the grid compact
            const tmp = new Map(board);
            put(tmp, { ...w, row, col, dir: newDir });
            const b = bounds(tmp);
            const h = b.maxR - b.minR + 1;
            const wd = b.maxC - b.minC + 1;
            if (h > maxSize || wd > maxSize) continue;
            const score = crossings * 10 - (h * wd) / 12 - Math.abs(h - wd) * 0.6 + rnd() * 2;
            if (!best || score > best.score) best = { p: { ...w, row, col, dir: newDir }, score };
          }
        }
      }

      if (best) {
        put(board, best.p);
        placed.push(best.p);
      } else {
        skipped.push(w);
      }
    }
  }
  return { board, placed };
}

export function generatePuzzle(pool: Capital[], target = 12, maxSize = 15, seed = Date.now()): Puzzle {
  const rnd = mulberry(seed);
  let bestRes: ReturnType<typeof attempt> = null;
  let bestScore = -Infinity;

  for (let t = 0; t < 90; t++) {
    const res = attempt(pool, target, maxSize, rnd);
    if (!res) continue;
    const b = bounds(res.board);
    const area = (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
    const density = res.board.size / area;
    const score = res.placed.length * 100 + density * 60;
    if (score > bestScore) {
      bestScore = score;
      bestRes = res;
    }
    if (res.placed.length >= target && density > 0.28) break;
  }

  if (!bestRes) throw new Error("Не удалось построить кроссворд");
  const { board, placed } = bestRes;
  const b = bounds(board);
  const rows = b.maxR - b.minR + 1;
  const cols = b.maxC - b.minC + 1;

  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const [k, v] of board) {
    const [r, c] = k.split(",").map(Number);
    grid[r - b.minR][c - b.minC] = v;
  }

  // classic numbering: scan row by row, left to right; a cell gets a number
  // if it starts an across or a down entry; shared starts share one number.
  const shifted = placed.map((p) => ({ ...p, row: p.row - b.minR, col: p.col - b.minC }));
  const numbers: (number | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shifted.some((p) => p.row === r && p.col === c)) numbers[r][c] = ++n;
    }
  }

  const entries: Entry[] = shifted
    .map((p) => ({
      id: p.cap.id,
      answer: p.word,
      display: p.cap.capital,
      row: p.row,
      col: p.col,
      dir: p.dir,
      num: numbers[p.row][p.col]!,
      capital: p.cap,
    }))
    .sort((a, b2) => a.num - b2.num);

  return { rows, cols, grid, numbers, entries, seed };
}

export function cellsOf(e: Entry): [number, number][] {
  return Array.from({ length: e.answer.length }, (_, i) =>
    e.dir === "across" ? [e.row, e.col + i] : [e.row + i, e.col]
  );
}

/** Hide the capital's name (and its inflected forms) inside a fact so it can be a clue. */
export function maskFact(fact: string | null | undefined, cap: Capital) {
  if (typeof fact !== "string" || !fact.trim()) return "";
  const names = [cap.capital, cap.capitalEn, cap.native, ...cap.aliases];
  let out = fact;
  for (const name of names) {
    if (!name) continue;
    const clean = name.replace(/[()]/g, "");
    if (clean.length < 3) continue;
    const stemLen = Math.max(3, clean.length - (clean.length > 5 ? 2 : 1));
    const stem = clean.slice(0, stemLen).replace(/[.*+?^${}|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`${stem}[\\p{L}-]*`, "giu"), "＿＿＿");
  }
  return out;
}

/**
 * Pick a stable fact for a clue. The index is normalised to the fact list length,
 * so a negative seed (Date.now() ^ random is a signed 32-bit int) can never produce
 * undefined — the old code crashed on `maskFact(undefined)`.
 */
export function factClue(cap: Capital, num: number, seed: number) {
  const facts = (cap.facts ?? []).filter((f) => typeof f === "string" && f.trim().length > 0);
  if (facts.length === 0) return `Столица страны: ${cap.country}`;
  const offset = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  const raw = num + offset;
  const idx = ((raw % facts.length) + facts.length) % facts.length;
  const masked = maskFact(facts[idx], cap);
  return masked.trim() ? masked : `Столица страны: ${cap.country}`;
}
