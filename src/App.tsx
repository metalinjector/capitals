import { Component, useEffect, useMemo, useRef, useState } from "react";
import { capitals, REGIONS, type Capital, type RegionId } from "./data/capitals";
import { britannicaUrl, photosOf, wikipediaUrl } from "./wiki";
import Crossword from "./Crossword";
import EuropeMap from "./EuropeMap";
import { MAP_IDS } from "./data/europeMap";
import {
  buildDeckFromIds,
  capitalOfTheDay,
  clampMastery,
  distractors,
  dueIds,
  emptyProgress,
  exportProgress,
  filterCapitals,
  gradeLabel,
  isCapitalMatch,
  importProgress,
  isCountryMatch,
  loadProgress,
  modeTitle,
  pickN,
  playCorrect,
  playHint,
  playWin,
  playWrong,
  saveProgress,
  scheduleReview,
  shuffle,
  todayKey,
  type Mode,
  type Progress,
} from "./lib";

type View = "home" | "setup" | "quiz" | "atlas" | "card" | "map" | "stats" | "results" | "crossword";

const COUNTS = [8, 12, 20] as const;
const VIEWS: View[] = ["home", "setup", "quiz", "atlas", "card", "map", "stats", "results", "crossword"];

/** Sections have their own URLs, so direct links and the browser Back button work. */
function parseHash(hash: string): { view: View; focusId: string | null } {
  const raw = hash.replace(/^#\/?/, "");
  if (raw.startsWith("card/")) {
    const id = raw.slice("card/".length);
    if (id && capitals.some((c) => c.id === id)) return { view: "card", focusId: id };
    return { view: "atlas", focusId: null };
  }
  const view = (VIEWS as string[]).includes(raw) ? (raw as View) : "home";
  return { view, focusId: null };
}

function hashFor(view: View, focusId: string | null) {
  if (view === "card" && focusId) return `#/card/${focusId}`;
  return `#/${view}`;
}

export default function App() {
  const [view, setView] = useState<View>(() => parseHash(window.location.hash).view);
  const [focusId, setFocusId] = useState<string | null>(() => parseHash(window.location.hash).focusId);
  const [mode, setMode] = useState<Mode>("choice");
  const [region, setRegion] = useState<RegionId>("school");
  const [count, setCount] = useState<number | "all">(12);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [sound, setSound] = useState(true);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [dailyDone, setDailyDone] = useState(false);
  const [customIds, setCustomIds] = useState<string[] | null>(null);
  const lastHash = useRef<string | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
    setDailyDone(localStorage.getItem("atlas-daily") === todayKey());
  }, []);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    const next = hashFor(view, focusId);
    lastHash.current = next;
    if (window.location.hash !== next) window.history.pushState(null, "", next);
  }, [view, focusId]);

  useEffect(() => {
    function onHash() {
      if (window.location.hash === lastHash.current) return;
      const next = parseHash(window.location.hash);
      lastHash.current = window.location.hash;
      setView(next.view);
      setFocusId(next.focusId);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function markDailyRead() {
    try {
      localStorage.setItem("atlas-daily", todayKey());
    } catch {
      /* ignore */
    }
    setDailyDone(true);
  }

  const known = Object.values(progress.mastery).filter((m) => m >= 3).length;
  const daily = capitalOfTheDay();

  function start(m: Mode, r = region, c: number | "all" = count, ids: string[] | null = null) {
    setMode(m);
    setRegion(r);
    setCount(c);
    setCustomIds(ids);
    setView("quiz");
  }

  function goHome() {
    setView("home");
    setFocusId(null);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#071018] text-[#f4ead5]">
      <div className="pointer-events-none fixed inset-0">
        <div className="aurora absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-amber-500/[0.13] blur-3xl" />
        <div className="aurora-2 absolute -right-32 top-1/3 h-[30rem] w-[30rem] rounded-full bg-teal-600/[0.12] blur-3xl" />
        <div className="aurora absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-indigo-700/[0.12] blur-3xl" />
        <div className="meridians absolute inset-0 opacity-[0.35]" />
        <div className="noise absolute inset-0 opacity-[0.06]" />
      </div>

      <Header
        view={view}
        onNav={(v) => setView(v)}
        known={known}
        total={capitals.length}
        points={progress.totalPoints}
        sound={sound}
        onSound={() => setSound((s) => !s)}
      />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-36 sm:px-6 sm:pt-24">
        <SectionBoundary key={`${view}:${focusId ?? ""}`} onReset={goHome}>
          {view === "home" && (
            <Home
              progress={progress}
              daily={daily}
              dailyDone={dailyDone}
              dueCount={dueIds(progress).length}
              onOpenDaily={() => {
                setFocusId(daily.id);
                setView("card");
                markDailyRead();
              }}
              onMode={(m) => {
                setMode(m);
                setView("setup");
              }}
              onAtlas={() => setView("atlas")}
              onStats={() => setView("stats")}
              onCrossword={() => setView("crossword")}
              onReview={() => {
                const due = dueIds(progress);
                start("review", "all", due.length, due);
              }}
            />
          )}
          {view === "crossword" && (
            <Crossword
              onSolved={(pts) =>
                setProgress((p) => ({ ...p, totalPoints: p.totalPoints + pts }))
              }
            />
          )}
          {view === "setup" && (
            <Setup
              mode={mode}
              region={region}
              count={count}
              onRegion={setRegion}
              onCount={setCount}
              onBack={() => setView("home")}
              onStart={() => start(mode, region, mode === "exam" ? 15 : mode === "blitz" ? 30 : count)}
            />
          )}
          {view === "quiz" && (
            <Quiz
              mode={mode}
              region={region}
              ids={customIds}
              count={mode === "exam" ? 15 : mode === "blitz" ? 40 : count}
              sound={sound}
              progress={progress}
              setProgress={setProgress}
              onExit={goHome}
              onDone={(r) => {
                setResult(r);
                setView("results");
              }}
            />
          )}
          {view === "map" && (
            <MapView
              progress={progress}
              onOpen={(id) => {
                setFocusId(id);
                setView("card");
              }}
            />
          )}
          {view === "atlas" && (
            <Atlas
              progress={progress}
              onOpen={(id) => {
                setFocusId(id);
                setView("card");
              }}
            />
          )}
          {view === "card" && focusId && (
            <CapitalPage
              id={focusId}
              progress={progress}
              onBack={() => setView("atlas")}
              onQuiz={() => {
                const item = capitals.find((c) => c.id === focusId);
                if (!item) return;
                setMode("type");
                setRegion("all");
                setCount(1);
                start("choice", item.region, 8);
              }}
            />
          )}
          {view === "stats" && (
            <Stats
              progress={progress}
              onReset={() => setProgress(emptyProgress())}
              onImport={(p) => setProgress(p)}
            />
          )}
          {view === "results" && result && (
            <Results
              result={result}
              onHome={goHome}
              onRetry={() => start(result.mode, result.region, result.count)}
              onMissed={() =>
                start(
                  "review",
                  result.region,
                  result.missed.length,
                  result.missed.map((c) => c.id)
                )
              }
              onAtlas={() => setView("atlas")}
            />
          )}
        </SectionBoundary>
      </main>
    </div>
  );
}

/**
 * A failure inside one section must not blank the whole site:
 * show a short message and keep the navigation alive.
 */
class SectionBoundary extends Component<
  { onReset: () => void; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="glass mx-auto max-w-xl rounded-3xl p-8 text-center">
          <div className="font-serif text-3xl">Раздел не открылся</div>
          <p className="mt-3 break-words text-sm text-[#f4ead5]/70">{this.state.error.message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset();
              }}
              className="rounded-full bg-[#d4a853] px-6 py-2.5 text-sm font-semibold text-[#071018]"
            >
              На главную
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-full border border-[#e8d5a3]/30 px-6 py-2.5 text-sm"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Header({
  view,
  onNav,
  known,
  total,
  points,
  sound,
  onSound,
}: {
  view: View;
  onNav: (v: View) => void;
  known: number;
  total: number;
  points: number;
  sound: boolean;
  onSound: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[#e8d5a3]/[0.06] bg-[#071018]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
        <button onClick={() => onNav("home")} className="group flex items-center gap-3">
          <Compass className="h-10 w-10 text-[#d4a853] transition group-hover:rotate-45" />
          <div className="text-left">
            <div className="font-serif text-xl font-semibold tracking-[0.18em] text-[#f4ead5] sm:text-2xl">
              ATLAS EUROPA
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.32em] text-[#d4a853]/80 sm:block">
              столицы · факты · квиз
            </div>
          </div>
        </button>
        <nav className="glass flex w-full items-center justify-between gap-0 overflow-x-auto rounded-full p-1 sm:w-auto sm:gap-1">
          <NavBtn active={view === "home" || view === "setup" || view === "quiz"} onClick={() => onNav("home")}>
            Квиз
          </NavBtn>
          <NavBtn active={view === "crossword"} onClick={() => onNav("crossword")}>
            Кроссворд
          </NavBtn>
          <NavBtn active={view === "atlas" || view === "card"} onClick={() => onNav("atlas")}>
            Атлас
          </NavBtn>
          <NavBtn active={view === "map"} onClick={() => onNav("map")}>
            Карта
          </NavBtn>
          <NavBtn active={view === "stats"} onClick={() => onNav("stats")}>
            Прогресс
          </NavBtn>
          <button
            onClick={onSound}
            className="ml-1 hidden h-9 w-9 place-items-center rounded-full text-sm text-[#e8d5a3]/80 hover:bg-white/5 sm:grid"
            title={sound ? "Звук включён" : "Звук выключен"}
          >
            {sound ? "♪" : "×"}
          </button>
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <MiniStat label="изучено" value={`${known}/${total}`} />
          <MiniStat label="очки" value={String(points)} />
        </div>
      </div>
    </header>
  );
}

function NavBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-1.5 py-1.5 text-[11px] font-medium transition sm:px-4 sm:text-sm ${
        active ? "bg-[#d4a853] text-[#071018]" : "text-[#e8d5a3]/80 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="font-serif text-lg leading-none text-[#d4a853]">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#e8d5a3]/50">{label}</div>
    </div>
  );
}

function Home({
  progress,
  daily,
  dailyDone,
  dueCount,
  onOpenDaily,
  onMode,
  onAtlas,
  onStats,
  onCrossword,
  onReview,
}: {
  progress: Progress;
  daily: Capital;
  dailyDone: boolean;
  dueCount: number;
  onOpenDaily: () => void;
  onMode: (m: Mode) => void;
  onAtlas: () => void;
  onStats: () => void;
  onCrossword: () => void;
  onReview: () => void;
}) {
  const mastered = Object.values(progress.mastery).filter((m) => m >= 3).length;
  const pct = Math.round((mastered / capitals.length) * 100);
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * 1000));
  const ticker = useMemo(
    () => shuffle(capitals.flatMap((c) => c.facts.map((f) => ({ c, f })))).slice(0, 60),
    []
  );
  const current = ticker[factIdx % ticker.length];
  useEffect(() => {
    const t = setInterval(() => setFactIdx((i) => i + 1), 9000);
    return () => clearInterval(t);
  }, []);
  const totalFacts = capitals.reduce((s, c) => s + c.facts.length, 0);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#e8d5a3]/15 shadow-2xl shadow-black/40">
        <img
          src="/images/hero.jpg"
          alt="Европа с высоты"
          className="h-[34rem] w-full object-cover sm:h-[32rem]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071018] via-[#071018]/75 to-[#071018]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071018] via-transparent to-[#071018]/40" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12">
          <p className="animate-rise mb-3 text-xs uppercase tracking-[0.42em] text-[#d4a853]">
            интерактивный атлас · 45 столиц · {totalFacts} фактов
          </p>
          <h1 className="animate-rise font-serif text-4xl font-semibold leading-[0.95] sm:text-7xl">
            Выучи столицы
            <br />
            <span className="gold-text italic">как путешественница</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#f4ead5]/75 sm:text-base">
            Три варианта, если ещё неуверенно. Своими буквами — когда уже почти знаешь. Подсказка
            откроет первую, максимум две первые буквы. А ещё — занимательные истории про каждый город.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => onMode("choice")}
              className="rounded-full bg-[#d4a853] px-6 py-3 text-sm font-semibold text-[#071018] shadow-lg shadow-amber-900/30 transition hover:brightness-110"
            >
              Начать квиз
            </button>
            <button
              onClick={onCrossword}
              className="rounded-full border border-[#e8d5a3]/30 bg-white/5 px-6 py-3 text-sm font-semibold text-[#f4ead5] backdrop-blur hover:bg-white/10"
            >
              ✎ Кроссворд
            </button>
            <button
              onClick={onAtlas}
              className="rounded-full px-6 py-3 text-sm font-semibold text-[#e8d5a3]/80 hover:text-[#f4ead5]"
            >
              Открыть атлас →
            </button>
          </div>
        </div>
      </section>

      {/* rotating "did you know" ribbon */}
      {current && (
        <section className="relative overflow-hidden rounded-3xl border border-[#d4a853]/25 bg-gradient-to-r from-[#d4a853]/[0.12] via-transparent to-teal-500/[0.08] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="hidden shrink-0 sm:block">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#d4a853]/40 bg-[#071018]/60 text-3xl">
                {current.c.flag}
              </div>
            </div>
            <div key={factIdx} className="animate-rise min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#d4a853]">
                а знаешь ли ты · {current.c.capital}, {current.c.country}
              </div>
              <p className="mt-2 font-serif text-xl leading-snug text-[#f4ead5] sm:text-2xl">{current.f}</p>
            </div>
            <button
              onClick={() => setFactIdx((i) => i + 1)}
              className="shrink-0 rounded-full border border-[#e8d5a3]/25 px-3 py-1.5 text-xs text-[#e8d5a3] hover:bg-white/5"
            >
              ещё →
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <button onClick={onOpenDaily} className="glass group overflow-hidden rounded-3xl text-left transition hover:-translate-y-1">
          <div className="grid h-28 grid-cols-3">
            {photosOf(daily.id).slice(0, 3).map((src) => (
              <WikiImg key={src} src={src} alt="" className="h-full w-full object-cover" />
            ))}
          </div>
          <div className="p-5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a853]">столица дня</div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-4xl">{daily.flag}</span>
              <div>
                <div className="font-serif text-2xl">{daily.capital}</div>
                <div className="text-sm text-[#e8d5a3]/70">{daily.country}</div>
              </div>
            </div>
            <p className="mt-4 line-clamp-2 text-sm text-[#f4ead5]/70">{daily.facts[0]}</p>
            <div className="mt-4 text-xs text-[#d4a853]">{dailyDone ? "уже в дневнике" : "прочитать историю →"}</div>
          </div>
        </button>
        <button onClick={onStats} className="glass rounded-3xl p-5 text-left transition hover:-translate-y-1">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a853]">твой атлас</div>
          <div className="mt-3 font-serif text-4xl">{pct}%</div>
          <div className="mt-1 text-sm text-[#e8d5a3]/70">столиц на твёрдую «знаю»</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#d4a853]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 text-xs text-[#f4ead5]/50">серия рекорд: {progress.bestStreak}</div>
        </button>
        <div className="glass rounded-3xl p-5">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a853]">как учить</div>
          <ul className="mt-3 space-y-2 text-sm text-[#f4ead5]/80">
            <li>— сначала три варианта;</li>
            <li>— потом пиши слово сама;</li>
            <li>— две буквы-подсказки, не больше;</li>
            <li>— факты в атласе закрепляют память.</li>
          </ul>
        </div>
      </section>

      {dueCount > 0 && (
        <section className="relative overflow-hidden rounded-3xl border border-[#3d9b7a]/35 bg-gradient-to-r from-[#3d9b7a]/15 via-transparent to-[#d4a853]/10 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#8fd6ba]">интервальное повторение</div>
              <div className="mt-2 font-serif text-2xl">
                Пора освежить {dueCount} {plural(dueCount, "столицу", "столицы", "столиц")}
              </div>
              <p className="mt-1 text-sm text-[#f4ead5]/70">
                Карточки возвращаются через 1, 3, 7, 16 и 35 дней — так забывание не побеждает.
              </p>
            </div>
            <button
              onClick={onReview}
              className="rounded-full bg-[#3d9b7a] px-6 py-3 text-sm font-semibold text-[#04140f] hover:brightness-110"
            >
              Повторить сейчас
            </button>
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-serif text-3xl sm:text-4xl">Режимы</h2>
          <p className="text-xs uppercase tracking-[0.24em] text-[#e8d5a3]/50">выбери уровень смелости</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModeCard
            kicker="легко"
            title="Три варианта"
            text="Страна на экране — столица из трёх. Идеально, чтобы войти в ритм и не бояться ошибки."
            icon="Ⅲ"
            onClick={() => onMode("choice")}
          />
          <ModeCard
            kicker="как на контрольной"
            title="Напиши столицу"
            text="Вводи слово целиком. Если забыла — открой первую букву, максимум две. Дальше уже сама."
            icon="Aa"
            featured
            onClick={() => onMode("type")}
          />
          <ModeCard
            kicker="наоборот"
            title="Страна по столице"
            text="Показывают «Берн» — а ты вспоминаешь, что это не Цюрих и не Женева, а Швейцария."
            icon="⇄"
            onClick={() => onMode("reverse")}
          />
          <ModeCard
            kicker="60 секунд"
            title="Блиц"
            text="Как можно больше верных ответов за минуту. Комбо растёт, сердце стучит, Европа кружится."
            icon="⚡"
            onClick={() => onMode("blitz")}
          />
          <ModeCard
            kicker="до 15 вопросов"
            title="Экзамен"
            text="Смесь режимов, оценка в конце, слабые места подсветим. Почти как у доски, только без мела."
            icon="★"
            onClick={() => onMode("exam")}
          />
          <ModeCard
            kicker="новый каждый раз"
            title="Кроссворд"
            text="Сетка собирается заново из случайных столиц. Подсказки — по стране или по занимательным фактам."
            icon="✎"
            featured
            onClick={onCrossword}
          />
          <ModeCard
            kicker="география"
            title="Страна на карте"
            text="Показывают страну — ты находишь её на карте Европы. Компас не нужен."
            icon="◈"
            onClick={() => onMode("map")}
          />
          <ModeCard
            kicker="читать"
            title="Атлас историй"
            text={`${totalFacts} занимательных фактов: медведи Берна, круассан Вены, дракон Любляны и галереи фото.`}
            icon="✦"
            onClick={onAtlas}
          />
        </div>
      </section>
    </div>
  );
}

function ModeCard({
  kicker,
  title,
  text,
  icon,
  featured,
  onClick,
}: {
  kicker: string;
  title: string;
  text: string;
  icon: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl p-6 text-left transition duration-300 hover:-translate-y-1 ${
        featured
          ? "shine bg-gradient-to-br from-[#f0d78c] via-[#d4a853] to-[#8a6a2a] text-[#071018] shadow-xl shadow-amber-900/30"
          : "glass"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`text-[10px] uppercase tracking-[0.28em] ${featured ? "text-[#071018]/70" : "text-[#d4a853]"}`}>
          {kicker}
        </div>
        <span className={`font-serif text-2xl ${featured ? "text-[#071018]/70" : "text-[#d4a853]/70"}`}>{icon}</span>
      </div>
      <h3 className="mt-4 font-serif text-3xl">{title}</h3>
      <p className={`mt-3 text-sm leading-relaxed ${featured ? "text-[#071018]/80" : "text-[#f4ead5]/70"}`}>{text}</p>
      <div className={`mt-5 text-xs font-semibold tracking-wide ${featured ? "text-[#071018]" : "text-[#d4a853]"}`}>
        открыть →
      </div>
    </button>
  );
}

function Setup({
  mode,
  region,
  count,
  onRegion,
  onCount,
  onBack,
  onStart,
}: {
  mode: Mode;
  region: RegionId;
  count: number | "all";
  onRegion: (r: RegionId) => void;
  onCount: (c: number | "all") => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const pool = filterCapitals(region);
  const exam = mode === "exam";
  const blitz = mode === "blitz";
  const mapMode = mode === "map";
  const mapPool = pool.filter((c) => MAP_IDS.has(c.id));

  return (
    <div className="mx-auto max-w-3xl animate-rise">
      <button onClick={onBack} className="mb-6 text-sm text-[#e8d5a3]/70 hover:text-[#d4a853]">
        ← на главную
      </button>
      <p className="text-xs uppercase tracking-[0.32em] text-[#d4a853]">{modeTitle(mode)}</p>
      <h2 className="mt-2 font-serif text-4xl sm:text-5xl">Собери маршрут</h2>
      <p className="mt-3 text-[#f4ead5]/70">
        Выбери, какую часть Европы повторяем. В пуле сейчас {pool.length}{" "}
        {plural(pool.length, "столица", "столицы", "столиц")}.
      </p>

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => onRegion(r.id)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              region === r.id
                ? "border-[#d4a853] bg-[#d4a853]/15"
                : "border-white/10 bg-white/5 hover:border-[#d4a853]/40"
            }`}
          >
            <div className="font-medium">{r.title}</div>
            <div className="text-xs text-[#e8d5a3]/60">{r.hint}</div>
          </button>
        ))}
      </div>

      {!exam && !blitz && (
        <div className="mt-8">
          <div className="text-xs uppercase tracking-[0.28em] text-[#d4a853]">сколько вопросов</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {COUNTS.map((n) => (
              <Chip key={n} active={count === n} onClick={() => onCount(n)}>
                {n}
              </Chip>
            ))}
            <Chip active={count === "all"} onClick={() => onCount("all")}>
              все {pool.length}
            </Chip>
          </div>
        </div>
      )}
      {exam && (
        <p className="mt-8 text-sm text-[#e8d5a3]/70">
          {pool.length >= 15
            ? "Экзамен из 15 вопросов: и выбор, и ввод слова."
            : `В этом регионе ${pool.length} ${plural(pool.length, "столица", "столицы", "столиц")} — экзамен будет из ${pool.length}: и выбор, и ввод слова.`}
        </p>
      )}
      {blitz && <p className="mt-8 text-sm text-[#e8d5a3]/70">Минута на всё. Очки растут с комбо. Ошибки не останавливают часы.</p>}
      {mapMode && (
        <p className="mt-8 text-sm text-[#e8d5a3]/70">
          Показываем страну — находишь её на карте. Здесь {mapPool.length}{" "}
          {plural(mapPool.length, "страна", "страны", "стран")}: микрогосударства отмечены точками.
        </p>
      )}

      <button
        onClick={onStart}
        className="mt-10 w-full rounded-full bg-[#d4a853] py-4 text-base font-semibold text-[#071018] shadow-lg shadow-amber-900/30 hover:brightness-110"
      >
        В путь
      </button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm ${
        active ? "bg-[#d4a853] text-[#071018]" : "border border-white/15 text-[#f4ead5] hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

interface QuizResult {
  mode: Mode;
  region: RegionId;
  count: number | "all";
  score: number;
  total: number;
  points: number;
  streak: number;
  missed: Capital[];
}

function Quiz({
  mode,
  region,
  count,
  sound,
  progress,
  setProgress,
  onExit,
  onDone,
  ids,
}: {
  mode: Mode;
  region: RegionId;
  count: number | "all";
  sound: boolean;
  progress: Progress;
  setProgress: React.Dispatch<React.SetStateAction<Progress>>;
  onExit: () => void;
  onDone: (r: QuizResult) => void;
  ids?: string[] | null;
}) {
  const pool = useMemo(() => filterCapitals(region), [region]);
  // the map quiz can only ask about countries that exist on the map
  const effectivePool = useMemo(
    () => (mode === "map" ? pool.filter((c) => MAP_IDS.has(c.id)) : pool),
    [pool, mode]
  );

  function makeDeck(): Capital[] {
    if (ids && ids.length > 0) {
      const picked = buildDeckFromIds(ids);
      if (picked.length > 0) return picked;
    }
    return count === "all" ? shuffle(effectivePool) : pickN(effectivePool, count);
  }

  const [deck, setDeck] = useState<Capital[]>(() => makeDeck());
  const [i, setI] = useState(0);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hints, setHints] = useState(0);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [picked, setPicked] = useState<string | null>(null);
  const [time, setTime] = useState(mode === "blitz" ? 60 : 0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typedRef = useRef("");
  const statusRef = useRef<"idle" | "ok" | "bad">("idle");
  const doneRef = useRef(false);
  const live = useRef({ score: 0, points: 0, streak: 0, best: 0, missed: [] as Capital[], i: 0, answered: 0 });
  typedRef.current = typed;
  statusRef.current = status;

  const item = deck[i];
  const examType = mode === "exam" && i % 2 === 1;
  const isType = mode === "type" || examType;
  const isReverse = mode === "reverse";

  const options = useMemo(() => {
    if (!item || isType) return [];
    return shuffle([item, ...distractors(item, pool.length > 3 ? pool : capitals, 2)]);
  }, [item?.id, isType, pool]);

  const deckKey = `${region}:${count}:${mode}:${(ids ?? []).join(",")}`;
  const deckKeyRef = useRef(deckKey);
  useEffect(() => {
    if (deckKeyRef.current === deckKey) return;
    deckKeyRef.current = deckKey;
    setDeck(makeDeck());
    setI(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckKey]);

  useEffect(() => {
    if (mode !== "blitz") return;
    const t = setInterval(() => {
      setTime((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (mode === "blitz" && time <= 0) finishRun();
  }, [time]);

  useEffect(() => {
    if (isType) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [i, isType]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (statusRef.current !== "idle") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";

      if (isType) {
        if (inField) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Enter") {
          e.preventDefault();
          submitType();
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          typedRef.current = typedRef.current.slice(0, -1);
          setTyped(typedRef.current);
          inputRef.current?.focus();
          return;
        }
        if (e.key.length === 1) {
          e.preventDefault();
          typedRef.current += e.key;
          setTyped(typedRef.current);
          inputRef.current?.focus();
        }
        return;
      }

      if (inField) return;
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        const opt = options[Number(e.key) - 1];
        if (opt) choose(opt);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isType, options, i]);

  if (!item) {
    return null;
  }

  function applyProgress(id: string, ok: boolean, usedHints: number) {
    setProgress((prev) => {
      const seen = { ...prev.seen, [id]: (prev.seen[id] || 0) + 1 };
      const correct = ok ? { ...prev.correct, [id]: (prev.correct[id] || 0) + 1 } : prev.correct;
      const delta = ok ? (usedHints === 0 ? 1 : 0.5) : -1;
      return {
        ...prev,
        seen,
        correct,
        mastery: { ...prev.mastery, [id]: clampMastery((prev.mastery[id] || 0) + delta) },
        srs: { ...prev.srs, [id]: scheduleReview(prev.srs[id], ok) },
      };
    });
  }

  function resolve(ok: boolean) {
    applyProgress(item.id, ok, hints);
    const L = live.current;
    L.answered += 1;
    if (ok) {
      const gained = isType ? (hints === 0 ? 20 : hints === 1 ? 12 : 6) : 10;
      const combo = 1 + Math.min(L.streak, 8) * 0.15;
      const add = Math.round(gained * (mode === "blitz" ? combo : 1));
      L.points += add;
      L.score += 1;
      L.streak += 1;
      L.best = Math.max(L.best, L.streak);
      setPoints(L.points);
      setStreak(L.streak);
      if (sound) playCorrect();
    } else {
      L.streak = 0;
      if (!L.missed.find((x) => x.id === item.id)) L.missed = [...L.missed, item];
      setStreak(0);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      if (sound) playWrong();
    }
    setStatus(ok ? "ok" : "bad");
    if (mode === "blitz") {
      setTimeout(() => advance(), 420);
    }
  }

  function choose(opt: Capital) {
    if (status !== "idle") return;
    setPicked(opt.id);
    resolve(opt.id === item.id);
  }

  function mapPick(id: string) {
    if (statusRef.current !== "idle") return;
    setPicked(id);
    resolve(id === item.id);
  }

  function submitType() {
    if (statusRef.current !== "idle") return;
    const value = typedRef.current;
    const ok = isReverse ? isCountryMatch(value, item) : isCapitalMatch(value, item);
    resolve(ok);
  }

  function hint() {
    if (hints >= 2 || statusRef.current !== "idle") return;
    const next = hints + 1;
    setHints(next);
    const word = isReverse ? item.country : item.capital;
    const prevHint = firstLetters(word, hints);
    setTyped((t) => {
      // the field may still hold only the previous hint — extend it; keep anything the player typed
      const untouched = !t.trim() || t === prevHint;
      const nextVal = untouched ? firstLetters(word, next) : t;
      typedRef.current = nextVal;
      return nextVal;
    });
    if (sound) playHint();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function giveUp() {
    if (status !== "idle") return;
    resolve(false);
  }

  function advance() {
    if (i + 1 >= deck.length) {
      // Blitz runs on the clock, not on a finite deck: build the next round on the fly.
      if (mode === "blitz") {
        const more = shuffle(effectivePool).filter((c) => c.id !== item.id);
        if (more.length > 0) {
          setDeck((d) => [...d, ...more]);
        } else {
          finishRun();
          return;
        }
      } else {
        finishRun();
        return;
      }
    }
    live.current.i = i + 1;
    setI((x) => x + 1);
    setHints(0);
    setTyped("");
    setStatus("idle");
    setPicked(null);
  }

  function finishRun() {
    if (doneRef.current) return;
    doneRef.current = true;
    const L = live.current;
    const total = mode === "blitz" ? Math.max(L.answered, 1) : deck.length;
    setProgress((prev) => ({
      ...prev,
      totalPoints: prev.totalPoints + L.points,
      bestStreak: Math.max(prev.bestStreak, L.best),
      totalSessions: (prev.totalSessions || 0) + 1,
      sessions: [
        {
          date: new Date().toISOString(),
          mode,
          region,
          score: L.score,
          total,
          points: L.points,
        },
        ...prev.sessions,
      ].slice(0, 20),
    }));
    if (L.score / total >= 0.8 && sound) playWin();
    onDone({
      mode,
      region,
      count,
      score: L.score,
      total,
      points: L.points,
      streak: L.best,
      missed: L.missed,
    });
  }

  const qTotal = mode === "blitz" ? "∞" : deck.length;
  const targetWord = isReverse && isType ? item.country : item.capital;
  const letters = revealLetters(targetWord, hints);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button onClick={onExit} className="text-sm text-[#e8d5a3]/70 hover:text-[#d4a853]">
          ← выход
        </button>
        <div className="flex items-center gap-3 text-sm">
          {mode === "blitz" && (
            <span className={`rounded-full px-3 py-1 font-semibold ${time <= 10 ? "bg-rose-500/20 text-rose-300" : "bg-white/10"}`}>
              {time}s
            </span>
          )}
          <span className="text-[#e8d5a3]/70">
            {Math.min(i + 1, deck.length)} / {qTotal}
          </span>
          <span className="text-[#d4a853]">★ {points}</span>
          {mode === "review" && <span className="text-[#8fd6ba]">повторение</span>}
          {streak > 1 && <span className="text-teal-300">комбо ×{streak}</span>}
        </div>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#d4a853] transition-all"
          style={{ width: `${mode === "blitz" ? (time / 60) * 100 : (i / deck.length) * 100}%` }}
        />
      </div>

      <div
        key={item.id + "-" + i}
        className={`glass-strong rounded-[2rem] p-6 sm:p-10 ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[#d4a853]">
            {mode === "map" ? "найди страну на карте" : isReverse ? "какая это страна?" : "назови столицу"}
          </div>
          {mode !== "map" && <div className="mt-4 text-6xl">{item.flag}</div>}
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">{isReverse ? item.capital : item.country}</h2>
          {!isReverse && mode !== "map" && <p className="mt-2 text-sm text-[#e8d5a3]/60">{item.countryEn}</p>}
        </div>

        {isType ? (
          <div className="mt-8">
            <div className="mb-5 flex flex-wrap justify-center gap-1.5">
              {letters.map((l, idx) =>
                l.gap ? (
                  <span key={idx} className="w-3" />
                ) : (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => inputRef.current?.focus()}
                    className={`blank-tile grid h-11 min-w-9 place-items-center rounded-lg border px-2 font-serif text-2xl ${
                      l.show
                        ? "border-[#d4a853] bg-[#d4a853]/15 text-[#d4a853]"
                        : "border-white/15 text-[#e8d5a3]/25"
                    }`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {l.show ? l.ch : ""}
                  </button>
                )
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitType();
              }}
            >
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => {
                  typedRef.current = e.target.value;
                  setTyped(e.target.value);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                disabled={status !== "idle"}
                placeholder={isReverse ? "введи страну…" : "введи столицу…"}
                className="input-gold w-full rounded-2xl px-5 py-4 text-center font-serif text-2xl text-[#f4ead5] caret-[#d4a853]"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                name="atlas-answer"
                inputMode="text"
              />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="submit"
                  disabled={status !== "idle" || !typed.trim()}
                  className="rounded-full bg-[#d4a853] px-6 py-2.5 text-sm font-semibold text-[#071018] disabled:opacity-40"
                >
                  Проверить
                </button>
                <button
                  type="button"
                  onClick={hint}
                  disabled={hints >= 2 || status !== "idle"}
                  className="rounded-full border border-[#e8d5a3]/30 px-5 py-2.5 text-sm disabled:opacity-40"
                >
                  Открыть букву {hints}/2
                </button>
                <button
                  type="button"
                  onClick={giveUp}
                  disabled={status !== "idle"}
                  className="rounded-full px-4 py-2.5 text-sm text-[#e8d5a3]/60 hover:text-rose-300"
                >
                  Не знаю
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-[#e8d5a3]/45">
                Можно писать по-русски или латиницей. Ё и Е — одно и то же.
              </p>
            </form>
          </div>
        ) : mode === "map" ? (
          <div className="mt-4">
            <EuropeMap
              onPick={mapPick}
              mastery={progress.mastery}
              highlight={status !== "idle" ? item.id : null}
              wrong={status === "bad" ? picked : null}
              selected={status === "idle" ? picked : null}
              hideNames
              className="h-auto w-full rounded-2xl bg-[#071018]/60"
            />
            <p className="mt-3 text-center text-xs text-[#e8d5a3]/45">
              Микрогосударства отмечены точками · нажми на страну
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {options.map((opt, idx) => {
              const right = opt.id === item.id;
              const selected = picked === opt.id;
              let cls = "border-white/10 bg-white/5 hover:border-[#d4a853]/50 hover:bg-white/8";
              if (status !== "idle") {
                if (right) cls = "border-teal-400/70 bg-teal-400/15";
                else if (selected) cls = "border-rose-400/70 bg-rose-400/10";
                else cls = "border-white/5 opacity-50";
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => choose(opt)}
                  disabled={status !== "idle"}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${cls}`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-xs text-[#e8d5a3]/70">
                    {idx + 1}
                  </span>
                  <span className="font-serif text-2xl">{isReverse ? opt.country : opt.capital}</span>
                </button>
              );
            })}
          </div>
        )}

        {status !== "idle" && (
          <div className="mt-8 animate-rise rounded-2xl border border-[#e8d5a3]/15 bg-black/20 p-5">
            <div className={`flex items-center gap-3 font-serif text-2xl ${status === "ok" ? "text-teal-300" : "text-rose-300"}`}>
              <span className="text-3xl">{item.flag}</span>
              <span>{status === "ok" ? "Верно!" : `Это ${item.capital}, ${item.country}`}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#f4ead5]/80">{item.facts[i % item.facts.length]}</p>
            {mode !== "blitz" && (
              <button
                onClick={advance}
                className="mt-4 rounded-full bg-[#d4a853] px-6 py-2 text-sm font-semibold text-[#071018]"
              >
                {i + 1 >= deck.length ? "Результат" : "Дальше"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function revealLetters(word: string, hints: number) {
  let n = 0;
  return [...word].map((ch) => {
    if (ch === " " || ch === "-") return { ch, show: true, gap: true };
    const show = n < hints;
    n += 1;
    return { ch: ch.toUpperCase(), show, gap: false };
  });
}

function firstLetters(word: string, hints: number) {
  let n = 0;
  let out = "";
  for (const ch of word) {
    if (ch === " " || ch === "-") {
      if (n > 0 && n <= hints) out += ch;
      continue;
    }
    if (n < hints) out += ch;
    n += 1;
  }
  return out;
}

function Atlas({
  progress,
  onOpen,
}: {
  progress: Progress;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<RegionId>("all");
  const list = filterCapitals(region).filter((c) => {
    const s = q.toLowerCase();
    if (!s) return true;
    return (
      c.country.toLowerCase().includes(s) ||
      c.capital.toLowerCase().includes(s) ||
      c.capitalEn.toLowerCase().includes(s) ||
      c.countryEn.toLowerCase().includes(s)
    );
  });

  return (
    <div className="animate-rise">
      <p className="text-xs uppercase tracking-[0.32em] text-[#d4a853]">библиотека городов</p>
      <h2 className="mt-2 font-serif text-4xl sm:text-5xl">Атлас столиц</h2>
      <p className="mt-3 max-w-2xl text-[#f4ead5]/70">
        45 европейских столиц — три и больше фотографий на каждый город с Wikimedia Commons и Wikipedia,
        плюс истории, которые запоминаются лучше зубрёжки.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Найти страну или столицу…"
          className="input-gold flex-1 rounded-full px-5 py-3"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <Chip key={r.id} active={region === r.id} onClick={() => setRegion(r.id)}>
            {r.title}
          </Chip>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => {
          const m = progress.mastery[c.id] || 0;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="glass group overflow-hidden rounded-3xl text-left transition hover:-translate-y-1"
            >
              <div className="relative h-40 overflow-hidden">
                <div className="grid h-full grid-cols-3">
                  {photosOf(c.id).slice(0, 3).map((src, idx) => (
                    <WikiImg
                      key={src}
                      src={src}
                      alt={`${c.capital} — фото ${idx + 1}`}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#071018] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 text-3xl">{c.flag}</div>
                <div className="absolute bottom-3 right-4 text-xs text-[#e8d5a3]">
                  {"★".repeat(Math.round(m))}
                  {"☆".repeat(5 - Math.round(m))}
                </div>
              </div>
              <div className="p-4">
                <div className="font-serif text-2xl">{c.capital}</div>
                <div className="text-sm text-[#e8d5a3]/70">{c.country}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#f4ead5]/60">{c.facts[0]}</p>
              </div>
            </button>
          );
        })}
      </div>
      {list.length === 0 && <p className="mt-10 text-center text-[#e8d5a3]/60">Ничего не нашлось — попробуй другое имя.</p>}
    </div>
  );
}

function CapitalPage({
  id,
  progress,
  onBack,
  onQuiz,
}: {
  id: string;
  progress: Progress;
  onBack: () => void;
  onQuiz: () => void;
}) {
  const [shot, setShot] = useState(0);
  useEffect(() => {
    setShot(0);
  }, [id]);
  const c = capitals.find((x) => x.id === id);
  if (!c) return null;
  const m = progress.mastery[c.id] || 0;
  const seen = progress.seen[c.id] || 0;
  const ok = progress.correct[c.id] || 0;
  const shots = photosOf(c.id);

  return (
    <article className="animate-rise mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-6 text-sm text-[#e8d5a3]/70 hover:text-[#d4a853]">
        ← весь атлас
      </button>
      <div className="overflow-hidden rounded-[2rem] border border-[#e8d5a3]/15">
        <div className="relative h-64 sm:h-[28rem]">
          <WikiImg
            src={shots[shot] || shots[0]}
            alt={`${c.capital}, ${c.country}`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071018] via-[#071018]/10 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="text-5xl">{c.flag}</div>
            <h1 className="mt-2 font-serif text-5xl">{c.capital}</h1>
            <p className="text-[#e8d5a3]/80">
              {c.country} · {c.native} · {c.capitalEn}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-black sm:grid-cols-6">
          {shots.slice(0, 6).map((src, i) => (
            <button
              key={src}
              onClick={() => setShot(i)}
              className={`relative h-20 overflow-hidden sm:h-24 ${shot === i ? "ring-2 ring-[#d4a853]" : "opacity-80 hover:opacity-100"}`}
            >
              <WikiImg src={src} alt={`${c.capital} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="bg-[#0c1c2a] p-6 sm:p-8">
          <p className="mb-6 text-[11px] leading-relaxed text-[#e8d5a3]/55">
            Фотографии: Wikimedia Commons / Wikipedia. Источники:{" "}
            <a className="text-[#d4a853] underline-offset-2 hover:underline" href={wikipediaUrl(c.id)} target="_blank" rel="noreferrer">
              Wikipedia
            </a>
            {" · "}
            <a className="text-[#d4a853] underline-offset-2 hover:underline" href={britannicaUrl(c.capitalEn)} target="_blank" rel="noreferrer">
              Encyclopædia Britannica
            </a>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="население" value={c.population} />
            <Info label="основан" value={c.founded} />
            <Info label="символ" value={c.landmark} />
            <Info
              label="сложность"
              value={c.difficulty === 1 ? "легко" : c.difficulty === 2 ? "средне" : "каверзно"}
            />
          </div>
          <h3 className="mt-8 font-serif text-2xl">Занимательное</h3>
          <ol className="mt-4 space-y-4">
            {c.facts.map((f, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-serif text-2xl text-[#d4a853]">{i + 1}</span>
                <p className="text-[#f4ead5]/85 leading-relaxed">{f}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#d4a853]">твоя память</div>
              <div className="font-serif text-xl">
                {"★".repeat(Math.round(m))}
                {"☆".repeat(5 - Math.round(m))}
              </div>
              <div className="text-xs text-[#e8d5a3]/60">
                верно {ok} из {seen || 0} попыток
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={onQuiz} className="rounded-full bg-[#d4a853] px-5 py-2 text-sm font-semibold text-[#071018]">
                Повторить регион
              </button>
              <button onClick={onBack} className="rounded-full border border-white/15 px-5 py-2 text-sm">
                К другим городам
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a853]">{label}</div>
      <div className="mt-1 text-sm leading-snug">{value}</div>
    </div>
  );
}

function MapView({ progress, onOpen }: { progress: Progress; onOpen: (id: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const c = pick ? capitals.find((x) => x.id === pick) : null;
  const known = capitals.filter((x) => (progress.mastery[x.id] || 0) >= 3).length;

  return (
    <div className="animate-rise">
      <p className="text-xs uppercase tracking-[0.32em] text-[#d4a853]">география на глаз</p>
      <h2 className="mt-2 font-serif text-4xl sm:text-5xl">Карта Европы</h2>
      <p className="mt-3 max-w-2xl text-[#f4ead5]/70">
        Нажми на страну, чтобы открыть её столицу. Золотым подсвечены столицы, которые ты уже знаешь на
        «твёрдо», бледным — те, что только начались.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-[#e8d5a3]/15 bg-[#0a1724] p-3 shadow-2xl shadow-black/40 sm:p-5">
          <EuropeMap mastery={progress.mastery} selected={pick} onPick={(id) => setPick(id)} />
        </div>
        <div className="glass rounded-3xl p-5">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a853]">выбрано</div>
          {c ? (
            <>
              <div className="mt-3 text-4xl">{c.flag}</div>
              <div className="mt-2 font-serif text-3xl">{c.capital}</div>
              <div className="text-sm text-[#e8d5a3]/80">{c.country}</div>
              <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-[#f4ead5]/70">{c.facts[0]}</p>
              <button
                onClick={() => onOpen(c.id)}
                className="mt-4 rounded-full bg-[#d4a853] px-5 py-2 text-sm font-semibold text-[#071018]"
              >
                Открыть карточку
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#e8d5a3]/60">Ткни в любую страну — покажу столицу и факт.</p>
          )}
          <div className="mt-6 flex items-center justify-between text-xs text-[#e8d5a3]/50">
            <span>
              изучено {known} из {capitals.length}
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#d4a853]/60" /> знаю
              <span className="inline-block h-3 w-3 rounded-sm bg-[#f4ead5]/20" /> впереди
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stats({
  progress,
  onReset,
  onImport,
}: {
  progress: Progress;
  onReset: () => void;
  onImport: (p: Progress) => void;
}) {
  const rows = [...capitals].sort((a, b) => (progress.mastery[a.id] || 0) - (progress.mastery[b.id] || 0));
  const weak = rows
    .filter((c) => (progress.seen[c.id] || 0) > 0 && (progress.mastery[c.id] || 0) < 3)
    .slice(0, 8);
  const strong = [...capitals]
    .sort((a, b) => (progress.mastery[b.id] || 0) - (progress.mastery[a.id] || 0))
    .filter((c) => (progress.mastery[c.id] || 0) >= 3)
    .slice(0, 8);

  return (
    <div className="animate-rise space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-[#d4a853]">дневник путешествий</p>
        <h2 className="mt-2 font-serif text-4xl sm:text-5xl">Прогресс</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatBox k="очки" v={String(progress.totalPoints)} />
        <StatBox k="рекорд серии" v={String(progress.bestStreak)} />
        <StatBox k="сессий" v={String(progress.totalSessions || progress.sessions.length)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-serif text-2xl">Стоит повторить</h3>
          <ul className="mt-4 space-y-2">
            {weak.length === 0 && <li className="text-sm text-[#e8d5a3]/60">Сыграй хотя бы один квиз — появятся слабые места.</li>}
            {weak.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>
                  {c.flag} {c.capital}
                  <span className="text-[#e8d5a3]/50"> · {c.country}</span>
                </span>
                <span className="text-[#d4a853]">{progress.correct[c.id] || 0}/{progress.seen[c.id]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-3xl p-6">
          <h3 className="font-serif text-2xl">Уже блестит</h3>
          <ul className="mt-4 space-y-2">
            {strong.length === 0 && <li className="text-sm text-[#e8d5a3]/60">Пока пусто — звёзды появятся после верных ответов.</li>}
            {strong.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>
                  {c.flag} {c.capital}
                </span>
                <span className="text-[#d4a853]">{"★".repeat(Math.round(progress.mastery[c.id] || 0))}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="glass rounded-3xl p-6">
        <h3 className="font-serif text-2xl">Последние забеги</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {progress.sessions.length === 0 && <li className="text-[#e8d5a3]/60">История пуста.</li>}
          {progress.sessions.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2">
              <span>
                {modeTitle(s.mode)} · {REGIONS.find((r) => r.id === s.region)?.title}
              </span>
              <span className="text-[#d4a853]">
                {s.score}/{s.total} · {s.points} очков
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="glass rounded-3xl p-6">
        <h3 className="font-serif text-2xl">Данные</h3>
        <p className="mt-2 text-sm text-[#f4ead5]/70">
          Прогресс хранится только в этом браузере. Скачай файл, чтобы перенести его на телефон или сохранить
          копию — аккаунт и сервер не нужны.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              const blob = new Blob([exportProgress(progress)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `atlas-europa-${todayKey()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="rounded-full bg-[#d4a853] px-5 py-2 text-sm font-semibold text-[#071018]"
          >
            Скачать прогресс
          </button>
          <label className="cursor-pointer rounded-full border border-[#e8d5a3]/30 px-5 py-2 text-sm">
            Загрузить файл
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const restored = importProgress(await file.text());
                if (restored) onImport(restored);
                else alert("Не получилось прочитать файл прогресса.");
              }}
            />
          </label>
        </div>
        <div className="mt-4 text-xs text-[#e8d5a3]/55">
          К повторению сейчас: {dueIds(progress).length} · всего карточек в расписании:{" "}
          {Object.keys(progress.srs).length}
        </div>
      </div>
      <button
        onClick={() => {
          if (confirm("Сбросить весь прогресс?")) onReset();
        }}
        className="text-xs text-[#e8d5a3]/40 hover:text-rose-300"
      >
        сбросить прогресс
      </button>
    </div>
  );
}

function StatBox({ k, v }: { k: string; v: string }) {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[#d4a853]">{k}</div>
      <div className="mt-2 font-serif text-4xl">{v}</div>
    </div>
  );
}

function Results({
  result,
  onHome,
  onRetry,
  onAtlas,
  onMissed,
}: {
  result: QuizResult;
  onHome: () => void;
  onRetry: () => void;
  onAtlas: () => void;
  onMissed: () => void;
}) {
  const pct = Math.round((result.score / Math.max(result.total, 1)) * 100);
  const g = gradeLabel(pct);
  const showConfetti = pct >= 80;

  return (
    <div className="relative mx-auto max-w-2xl text-center">
      {showConfetti && <Confetti />}
      <p className="text-xs uppercase tracking-[0.32em] text-[#d4a853]">{modeTitle(result.mode)}</p>
      <div className="mt-4 font-serif text-8xl gold-text">{g.mark}</div>
      <h2 className="mt-2 font-serif text-4xl">{g.title}</h2>
      <p className="mt-2 text-[#e8d5a3]/70">{g.sub}</p>
      <div className="mt-8 grid grid-cols-3 gap-3">
        <StatBox k="верно" v={`${result.score}/${result.total}`} />
        <StatBox k="очки" v={String(result.points)} />
        <StatBox k="серия" v={String(result.streak)} />
      </div>
      {result.missed.length > 0 && (
        <div className="glass mt-8 rounded-3xl p-6 text-left">
          <h3 className="font-serif text-2xl">Разобрать ошибки</h3>
          <ul className="mt-4 space-y-3">
            {result.missed.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="text-lg">{c.flag}</span>{" "}
                <b>{c.country}</b> — {c.capital}
                <div className="text-[#e8d5a3]/60">{c.facts[0]}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {result.missed.length > 0 && (
          <button
            onClick={onMissed}
            className="rounded-full bg-[#3d9b7a] px-6 py-3 text-sm font-semibold text-[#04140f]"
          >
            Повторить ошибки ({result.missed.length})
          </button>
        )}
        <button onClick={onRetry} className="rounded-full bg-[#d4a853] px-6 py-3 text-sm font-semibold text-[#071018]">
          Ещё раз
        </button>
        <button onClick={onAtlas} className="rounded-full border border-[#e8d5a3]/30 px-6 py-3 text-sm">
          Читать факты
        </button>
        <button onClick={onHome} className="rounded-full px-6 py-3 text-sm text-[#e8d5a3]/70">
          На главную
        </button>
      </div>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: i % 3 === 0 ? "#d4a853" : i % 3 === 1 ? "#3d9b7a" : "#f4ead5",
            animation: `confetti-fall ${2 + (i % 5) * 0.35}s linear ${i * 0.05}s both`,
            transform: `rotate(${i * 18}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function WikiImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
    />
  );
}

function Compass({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <path d="M32 8 L36 32 L32 56 L28 32 Z" fill="currentColor" opacity="0.9" />
      <path d="M8 32 L32 28 L56 32 L32 36 Z" fill="currentColor" opacity="0.35" />
      <circle cx="32" cy="32" r="3" fill="#071018" stroke="currentColor" />
    </svg>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}
