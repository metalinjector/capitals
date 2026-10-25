import { capitals, filterCapitals, type Capital, type RegionId } from "./data/capitals";

export type Mode = "choice" | "type" | "reverse" | "blitz" | "exam" | "map" | "review";

export interface SrsCard {
  /** ISO date (YYYY-MM-DD) when this capital should come back */
  due: string;
  /** successful reviews in a row */
  box: number;
}

export interface SessionRecord {
  date: string;
  mode: Mode;
  region: RegionId;
  score: number;
  total: number;
  points: number;
}

export interface Progress {
  mastery: Record<string, number>;
  seen: Record<string, number>;
  correct: Record<string, number>;
  totalPoints: number;
  bestStreak: number;
  totalSessions: number;
  srs: Record<string, SrsCard>;
  sessions: SessionRecord[];
}

const KEY = "atlas-europa-progress-v1";

export const emptyProgress = (): Progress => ({
  mastery: {},
  seen: {},
  correct: {},
  totalPoints: 0,
  bestStreak: 0,
  totalSessions: 0,
  srs: {},
  sessions: [],
});

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = { ...emptyProgress(), ...JSON.parse(raw) } as Progress;
    // history is capped at 20 records; keep the lifetime counter at least equal to what is stored
    p.totalSessions = Math.max(Number(p.totalSessions) || 0, p.sessions.length);
    if (!p.srs || typeof p.srs !== "object") p.srs = {};
    return p;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’'`´]/g, "")
    .replace(/[-‐–—.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compact(s: string) {
  return normalize(s).replace(/\s+/g, "");
}

export function isCapitalMatch(input: string, item: Capital) {
  const n = compact(input);
  if (!n) return false;
  return item.aliases.some((a) => compact(a) === n);
}

export function isCountryMatch(input: string, item: Capital) {
  const n = compact(input);
  if (!n) return false;
  return item.countryAliases.some((a) => compact(a) === n);
}

export function distractors(item: Capital, pool: Capital[], n = 2): Capital[] {
  const others = pool.filter((c) => c.id !== item.id);
  const same = others.filter((c) => c.region === item.region || c.difficulty === item.difficulty);
  const source = same.length >= n ? same : others;
  return pickN(source, n);
}

export function capitalOfTheDay(): Capital {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return capitals[day % capitals.length];
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Days until the next review, one step per successful repetition. */
export const REVIEW_STEPS = [1, 3, 7, 16, 35];

/** Leitner box: a right answer pushes the card further out, a miss brings it back tomorrow. */
export function scheduleReview(card: SrsCard | undefined, ok: boolean, today = todayKey()): SrsCard {
  if (!ok) return { box: 0, due: addDays(today, 1) };
  const box = Math.min((card?.box ?? 0) + 1, REVIEW_STEPS.length);
  return { box, due: addDays(today, REVIEW_STEPS[box - 1]) };
}

export function dueIds(p: Progress, today = todayKey()): string[] {
  return Object.entries(p.srs)
    .filter(([, card]) => card && typeof card.due === "string" && card.due <= today)
    .map(([id]) => id);
}

export function buildDeckFromIds(ids: string[]): Capital[] {
  const set = new Set(ids);
  return shuffle(capitals.filter((c) => set.has(c.id)));
}

export function exportProgress(p: Progress) {
  return JSON.stringify(
    { app: "atlas-europa", version: 1, exportedAt: new Date().toISOString(), progress: p },
    null,
    2
  );
}

export function importProgress(raw: string): Progress | null {
  try {
    const data = JSON.parse(raw);
    const incoming = (data && typeof data === "object" && "progress" in data ? data.progress : data) as
      | Partial<Progress>
      | null;
    if (!incoming || typeof incoming !== "object") return null;
    const merged: Progress = { ...emptyProgress(), ...incoming };
    if (!merged.srs || typeof merged.srs !== "object") merged.srs = {};
    merged.sessions = Array.isArray(merged.sessions) ? merged.sessions.slice(0, 20) : [];
    merged.totalSessions = Math.max(Number(merged.totalSessions) || 0, merged.sessions.length);
    return merged;
  } catch {
    return null;
  }
}

export function clampMastery(n: number) {
  return Math.max(0, Math.min(5, n));
}

export function gradeLabel(pct: number) {
  if (pct >= 95) return { title: "Отлично", sub: "как у картографа XVIII века", mark: "5" };
  if (pct >= 80) return { title: "Хорошо", sub: "атлас почти не нужен", mark: "4" };
  if (pct >= 60) return { title: "Неплохо", sub: "ещё один круг — и пятёрка", mark: "3" };
  if (pct >= 40) return { title: "Есть пробелы", sub: "открой атлас и прочитай факты", mark: "2" };
  return { title: "Надо учить", sub: "начнём с школьной программы", mark: "1" };
}

export function modeTitle(mode: Mode) {
  switch (mode) {
    case "choice":
      return "Три варианта";
    case "type":
      return "Напиши столицу";
    case "reverse":
      return "Страна по столице";
    case "blitz":
      return "Блиц 60 секунд";
    case "exam":
      return "Экзамен";
    case "map":
      return "Страна на карте";
    case "review":
      return "Повторение ошибок";
  }
}

export function buildDeck(region: RegionId, count: number | "all"): Capital[] {
  const pool = filterCapitals(region);
  if (count === "all") return shuffle(pool);
  return pickN(pool, count);
}

let audioCtx: AudioContext | null = null;
function ctx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function tone(freq: number, dur = 0.12, type: OscillatorType = "sine", gain = 0.05) {
  try {
    const a = ctx();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  } catch {
    /* ignore */
  }
}

export function playCorrect() {
  tone(523, 0.1);
  setTimeout(() => tone(784, 0.16), 80);
}

export function playWrong() {
  tone(180, 0.22, "triangle", 0.06);
}

export function playHint() {
  tone(392, 0.08, "triangle", 0.04);
}

export function playWin() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.14), i * 110));
}

export { filterCapitals };
