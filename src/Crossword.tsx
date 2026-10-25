import { useEffect, useMemo, useRef, useState } from "react";
import { REGIONS, filterCapitals, type RegionId } from "./data/capitals";
import { cellsOf, generatePuzzle, maskFact, type Dir, type Entry, type Puzzle } from "./crosswordGen";

const SIZES = [
  { id: "mini", title: "Мини", words: 7, max: 11, hint: "7 слов · разминка" },
  { id: "classic", title: "Классика", words: 11, max: 14, hint: "11 слов" },
  { id: "big", title: "Большой", words: 16, max: 17, hint: "16 слов · вызов" },
] as const;

type SizeId = (typeof SIZES)[number]["id"];
type ClueMode = "country" | "fact";

const LAT_TO_RU: Record<string, string> = {
  q: "Й", w: "Ц", e: "У", r: "К", t: "Е", y: "Н", u: "Г", i: "Ш", o: "Щ", p: "З", "[": "Х", "]": "Ъ",
  a: "Ф", s: "Ы", d: "В", f: "А", g: "П", h: "Р", j: "О", k: "Л", l: "Д", ";": "Ж", "'": "Э",
  z: "Я", x: "Ч", c: "С", v: "М", b: "И", n: "Т", m: "Ь", ",": "Б", ".": "Ю", "`": "Е",
};

function toCyr(ch: string) {
  const lower = ch.toLowerCase();
  if (/[а-яё]/.test(lower)) return lower.toUpperCase().replace("Ё", "Е");
  return LAT_TO_RU[lower] ?? null;
}

const k = (r: number, c: number) => `${r},${c}`;

export default function Crossword({ onSolved }: { onSolved: (points: number) => void }) {
  const [region, setRegion] = useState<RegionId>("school");
  const [size, setSize] = useState<SizeId>("classic");
  const [clueMode, setClueMode] = useState<ClueMode>("country");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, true>>({});
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [dir, setDir] = useState<Dir>("across");
  const [checking, setChecking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [solved, setSolved] = useState(false);
  const [showCountry, setShowCountry] = useState<Record<string, true>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const rewarded = useRef(false);

  function newPuzzle(r = region, s = size) {
    const cfg = SIZES.find((x) => x.id === s)!;
    const pool = filterCapitals(r);
    const p = generatePuzzle(pool, Math.min(cfg.words, pool.length), cfg.max, Date.now() ^ Math.floor(Math.random() * 1e9));
    setPuzzle(p);
    setValues({});
    setRevealed({});
    setChecking(false);
    setSolved(false);
    setSeconds(0);
    setShowCountry({});
    rewarded.current = false;
    const first = p.entries[0];
    if (first) {
      setSel({ r: first.row, c: first.col });
      setDir(first.dir);
    }
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  useEffect(() => {
    newPuzzle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!puzzle || solved) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [puzzle, solved]);

  const entriesAt = useMemo(() => {
    const map = new Map<string, Entry[]>();
    puzzle?.entries.forEach((e) =>
      cellsOf(e).forEach(([r, c]) => {
        const arr = map.get(k(r, c)) ?? [];
        arr.push(e);
        map.set(k(r, c), arr);
      })
    );
    return map;
  }, [puzzle]);

  const active: Entry | null = useMemo(() => {
    if (!sel) return null;
    const list = entriesAt.get(k(sel.r, sel.c)) ?? [];
    return list.find((e) => e.dir === dir) ?? list[0] ?? null;
  }, [sel, dir, entriesAt]);

  const activeCells = useMemo(() => new Set(active ? cellsOf(active).map(([r, c]) => k(r, c)) : []), [active]);

  // completion check
  useEffect(() => {
    if (!puzzle) return;
    let total = 0;
    let ok = 0;
    puzzle.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (!ch) return;
        total++;
        if (values[k(r, c)] === ch) ok++;
      })
    );
    if (total > 0 && ok === total && !solved) {
      setSolved(true);
      if (!rewarded.current) {
        rewarded.current = true;
        const help = Object.keys(revealed).length;
        const pts = Math.max(20, puzzle.entries.length * 25 - help * 8 + Math.max(0, 300 - seconds) / 6);
        onSolved(Math.round(pts));
      }
    }
  }, [values, puzzle]);

  if (!puzzle) return null;

  const filled = Object.keys(values).filter((x) => values[x]).length;
  const totalCells = puzzle.grid.flat().filter(Boolean).length;
  const pct = Math.round((filled / totalCells) * 100);

  function isSolvedEntry(e: Entry) {
    return cellsOf(e).every(([r, c]) => values[k(r, c)] === puzzle!.grid[r][c]);
  }

  function select(r: number, c: number) {
    if (!puzzle!.grid[r]?.[c]) return;
    const list = entriesAt.get(k(r, c)) ?? [];
    if (sel && sel.r === r && sel.c === c && list.length > 1) {
      setDir((d) => (d === "across" ? "down" : "across"));
    } else if (!list.some((e) => e.dir === dir) && list[0]) {
      setDir(list[0].dir);
    }
    setSel({ r, c });
    inputRef.current?.focus();
  }

  function selectEntry(e: Entry) {
    const firstEmpty = cellsOf(e).find(([r, c]) => !values[k(r, c)]) ?? [e.row, e.col];
    setDir(e.dir);
    setSel({ r: firstEmpty[0], c: firstEmpty[1] });
    inputRef.current?.focus();
  }

  function step(delta: number) {
    if (!active || !sel) return;
    const cells = cellsOf(active);
    const idx = cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
    const next = cells[idx + delta];
    if (next) setSel({ r: next[0], c: next[1] });
  }

  function jumpEntry(delta: number) {
    const list = puzzle!.entries;
    const idx = active ? list.indexOf(active) : -1;
    const next = list[(idx + delta + list.length) % list.length];
    selectEntry(next);
  }

  function typeLetter(ch: string) {
    if (!sel || solved) return;
    const key = k(sel.r, sel.c);
    if (revealed[key]) {
      step(1);
      return;
    }
    setValues((v) => ({ ...v, [key]: ch }));
    step(1);
  }

  function erase() {
    if (!sel || solved) return;
    const key = k(sel.r, sel.c);
    if (values[key] && !revealed[key]) {
      setValues((v) => ({ ...v, [key]: "" }));
    } else {
      step(-1);
      if (active) {
        const cells = cellsOf(active);
        const idx = cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
        const prev = cells[idx - 1];
        if (prev && !revealed[k(prev[0], prev[1])]) setValues((v) => ({ ...v, [k(prev[0], prev[1])]: "" }));
      }
    }
  }

  function moveArrow(dr: number, dc: number) {
    if (!sel) return;
    let r = sel.r + dr;
    let c = sel.c + dc;
    while (r >= 0 && c >= 0 && r < puzzle!.rows && c < puzzle!.cols) {
      if (puzzle!.grid[r][c]) {
        setSel({ r, c });
        const newDir: Dir = dr !== 0 ? "down" : "across";
        if ((entriesAt.get(k(r, c)) ?? []).some((e) => e.dir === newDir)) setDir(newDir);
        return;
      }
      r += dr;
      c += dc;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      erase();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveArrow(0, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveArrow(0, -1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveArrow(1, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveArrow(-1, 0);
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      jumpEntry(e.shiftKey ? -1 : 1);
    } else if (e.key === " ") {
      e.preventDefault();
      setDir((d) => (d === "across" ? "down" : "across"));
    }
  }

  function onInput(e: React.FormEvent<HTMLInputElement>) {
    const val = (e.target as HTMLInputElement).value;
    (e.target as HTMLInputElement).value = "";
    for (const ch of val) {
      const cy = toCyr(ch);
      if (cy) typeLetter(cy);
    }
  }

  function revealCell() {
    if (!sel) return;
    const key = k(sel.r, sel.c);
    setValues((v) => ({ ...v, [key]: puzzle!.grid[sel.r][sel.c]! }));
    setRevealed((x) => ({ ...x, [key]: true }));
    step(1);
    inputRef.current?.focus();
  }

  function revealWord() {
    if (!active) return;
    const nv: Record<string, string> = {};
    const nr: Record<string, true> = {};
    cellsOf(active).forEach(([r, c]) => {
      nv[k(r, c)] = puzzle!.grid[r][c]!;
      if (values[k(r, c)] !== puzzle!.grid[r][c]) nr[k(r, c)] = true;
    });
    setValues((v) => ({ ...v, ...nv }));
    setRevealed((x) => ({ ...x, ...nr }));
    inputRef.current?.focus();
  }

  function clueText(e: Entry) {
    if (clueMode === "country") return `${e.capital.flag} Столица: ${e.capital.country}`;
    const facts = e.capital.facts;
    const f = facts[(e.num + puzzle!.seed) % facts.length];
    return maskFact(f, e.capital);
  }

  const across = puzzle.entries.filter((e) => e.dir === "across");
  const down = puzzle.entries.filter((e) => e.dir === "down");
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[#d4a853]">новый каждый раз</p>
          <h2 className="mt-2 font-serif text-4xl sm:text-6xl">
            Кроссворд <span className="gold-text italic">столиц</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm text-[#f4ead5]/70">
            Сетка строится заново из случайных столиц: слова пересекаются по общим буквам, нумерация — как в газете,
            слева направо и сверху вниз. Пиши прямо на клавиатуре; если забыла переключить раскладку — не страшно.
          </p>
        </div>
        <div className="flex gap-3">
          <Stat label="время" value={`${mm}:${ss}`} />
          <Stat label="заполнено" value={`${pct}%`} />
        </div>
      </div>

      {/* settings */}
      <div className="glass mt-6 grid gap-4 rounded-3xl p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
        <select
          value={region}
          onChange={(e) => {
            const r = e.target.value as RegionId;
            setRegion(r);
            newPuzzle(r, size);
          }}
          className="input-gold rounded-full px-4 py-2.5 text-sm"
        >
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id} className="bg-[#0c1c2a]">
              {r.title} — {r.hint}
            </option>
          ))}
        </select>
        <div className="flex rounded-full border border-white/10 p-1">
          {SIZES.map((s) => (
            <button
              key={s.id}
              title={s.hint}
              onClick={() => {
                setSize(s.id);
                newPuzzle(region, s.id);
              }}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm transition ${
                size === s.id ? "bg-[#d4a853] text-[#071018]" : "text-[#e8d5a3]/80 hover:bg-white/5"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-white/10 p-1">
          {(
            [
              ["country", "По стране"],
              ["fact", "По фактам"],
            ] as const
          ).map(([id, title]) => (
            <button
              key={id}
              onClick={() => setClueMode(id)}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm transition ${
                clueMode === id ? "bg-[#d4a853] text-[#071018]" : "text-[#e8d5a3]/80 hover:bg-white/5"
              }`}
            >
              {title}
            </button>
          ))}
        </div>
        <button
          onClick={() => newPuzzle()}
          className="rounded-full bg-gradient-to-r from-[#f0d78c] to-[#d4a853] px-5 py-2.5 text-sm font-semibold text-[#071018] shadow-lg shadow-amber-900/30 hover:brightness-110"
        >
          ↻ Новый кроссворд
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* grid */}
        <div>
          {active && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10 px-4 py-3">
              <span className="font-serif text-2xl text-[#d4a853]">
                {active.num}
                <span className="text-sm">{active.dir === "across" ? "→" : "↓"}</span>
              </span>
              <span className="text-sm leading-snug text-[#f4ead5]">
                {clueText(active)} <span className="text-[#e8d5a3]/60">({active.answer.length})</span>
              </span>
            </div>
          )}

          <div
            className="relative mx-auto rounded-[1.75rem] border border-[#e8d5a3]/15 bg-[#0a1724] p-3 shadow-2xl shadow-black/50 sm:p-5"
            style={{ maxWidth: Math.min(puzzle.cols * 46 + 40, 760) }}
          >
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`, containerType: "inline-size" }}
              onClick={() => inputRef.current?.focus()}
            >
              {puzzle.grid.map((row, r) =>
                row.map((ch, c) => {
                  if (!ch)
                    return <div key={k(r, c)} className="aspect-square rounded-[4px] bg-white/[0.02]" />;
                  const key = k(r, c);
                  const v = values[key] ?? "";
                  const isSel = sel?.r === r && sel?.c === c;
                  const inWord = activeCells.has(key);
                  const wrong = checking && v && v !== ch;
                  const right = checking && v === ch;
                  const num = puzzle.numbers[r][c];
                  return (
                    <button
                      key={key}
                      onClick={(e) => {
                        e.stopPropagation();
                        select(r, c);
                      }}
                      className={`relative aspect-square select-none rounded-[5px] font-serif font-semibold uppercase leading-none transition-colors duration-150 ${
                        isSel
                          ? "bg-[#d4a853] text-[#071018] shadow-[0_0_0_2px_#fff3c4_inset]"
                          : inWord
                          ? "bg-[#f0dfb3] text-[#071018]"
                          : solved
                          ? "bg-[#cfe9dc] text-[#0b3b2c]"
                          : "bg-[#f4ead5] text-[#071018] hover:bg-[#fbf3e1]"
                      }`}
                      style={{ fontSize: `calc(100cqw / ${puzzle.cols} * 0.52)` }}
                    >
                      {num && (
                        <span
                          className="absolute left-[8%] top-[4%] font-sans font-bold text-[#071018]/60"
                          style={{ fontSize: `calc(100cqw / ${puzzle.cols} * 0.22)` }}
                        >
                          {num}
                        </span>
                      )}
                      <span
                        className={`${wrong ? "text-rose-600" : right ? "text-emerald-700" : ""} ${
                          revealed[key] ? "italic text-[#8a6a2a]" : ""
                        }`}
                      >
                        {v}
                      </span>
                      {wrong && <span className="absolute inset-x-[15%] bottom-[12%] h-[2px] rounded bg-rose-500" />}
                    </button>
                  );
                })
              )}
            </div>

            <input
              ref={inputRef}
              onKeyDown={onKeyDown}
              onInput={onInput}
              aria-label="Ввод буквы кроссворда"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="pointer-events-none absolute left-1/2 top-1/2 h-px w-px opacity-0"
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ToolBtn onClick={() => setChecking((x) => !x)} active={checking}>
              {checking ? "✓ Проверка вкл." : "Проверить"}
            </ToolBtn>
            <ToolBtn onClick={revealCell}>Открыть букву</ToolBtn>
            <ToolBtn onClick={revealWord}>Открыть слово</ToolBtn>
            <ToolBtn
              onClick={() => {
                setDir((d) => (d === "across" ? "down" : "across"));
                inputRef.current?.focus();
              }}
            >
              ⇄ Направление
            </ToolBtn>
          </div>
          <p className="mt-3 text-center text-xs text-[#e8d5a3]/45">
            Стрелки — ходить по клеткам · Пробел или повторный клик — сменить направление · Enter/Tab — следующее слово
          </p>

          {solved && (
            <div className="animate-pop mt-6 rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-emerald-500/15 to-[#d4a853]/10 p-6 text-center">
              <div className="font-serif text-4xl">Кроссворд решён!</div>
              <p className="mt-2 text-sm text-[#f4ead5]/75">
                {puzzle.entries.length} столиц за {mm}:{ss}
                {Object.keys(revealed).length > 0 ? ` · подсказок: ${Object.keys(revealed).length}` : " · без подсказок!"}
              </p>
              <button
                onClick={() => newPuzzle()}
                className="mt-4 rounded-full bg-[#d4a853] px-6 py-2.5 text-sm font-semibold text-[#071018]"
              >
                Ещё один
              </button>
            </div>
          )}
        </div>

        {/* clues */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <ClueList
            title="По горизонтали"
            entries={across}
            active={active}
            clueText={clueText}
            isSolved={isSolvedEntry}
            onPick={selectEntry}
            clueMode={clueMode}
            showCountry={showCountry}
            onShowCountry={(id) => setShowCountry((s) => ({ ...s, [id]: true }))}
          />
          <ClueList
            title="По вертикали"
            entries={down}
            active={active}
            clueText={clueText}
            isSolved={isSolvedEntry}
            onPick={selectEntry}
            clueMode={clueMode}
            showCountry={showCountry}
            onShowCountry={(id) => setShowCountry((s) => ({ ...s, [id]: true }))}
          />
        </div>
      </div>
    </div>
  );
}

function ClueList({
  title,
  entries,
  active,
  clueText,
  isSolved,
  onPick,
  clueMode,
  showCountry,
  onShowCountry,
}: {
  title: string;
  entries: Entry[];
  active: Entry | null;
  clueText: (e: Entry) => string;
  isSolved: (e: Entry) => boolean;
  onPick: (e: Entry) => void;
  clueMode: ClueMode;
  showCountry: Record<string, true>;
  onShowCountry: (id: string) => void;
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <h3 className="font-serif text-2xl">{title}</h3>
      <ol className="scroll-thin mt-3 max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
        {entries.map((e) => {
          const on = active === e;
          const done = isSolved(e);
          const key = `${e.num}-${e.dir}`;
          return (
            <li key={key}>
              <button
                onClick={() => onPick(e)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm leading-snug transition ${
                  on ? "bg-[#d4a853]/20 ring-1 ring-[#d4a853]/60" : "hover:bg-white/5"
                } ${done ? "text-[#f4ead5]/45 line-through decoration-[#d4a853]/50" : "text-[#f4ead5]/90"}`}
              >
                <b className="mr-2 font-serif text-base text-[#d4a853]">{e.num}</b>
                {clueText(e)} <span className="text-[#e8d5a3]/50">({e.answer.length})</span>
              </button>
              {clueMode === "fact" && !done && (
                <div className="pl-9 text-xs">
                  {showCountry[key] ? (
                    <span className="text-[#e8d5a3]/70">
                      {e.capital.flag} {e.capital.country}
                    </span>
                  ) : (
                    <button onClick={() => onShowCountry(key)} className="text-[#d4a853]/70 hover:text-[#d4a853]">
                      показать страну
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-200"
          : "border-[#e8d5a3]/25 text-[#f4ead5] hover:border-[#d4a853]/60 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass min-w-24 rounded-2xl px-4 py-2 text-center">
      <div className="font-serif text-2xl text-[#d4a853]">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#e8d5a3]/50">{label}</div>
    </div>
  );
}
