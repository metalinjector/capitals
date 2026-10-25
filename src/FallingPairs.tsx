import { useEffect, useRef, useState, type CSSProperties } from "react";
import { capitals } from "./data/capitals";
import {
  createFallingRound,
  FALLING_ROUND_SIZE,
  FALLING_SPAWN_INTERVAL_MS,
  FALLING_TILE_DURATION_MS,
  type FallingRound,
  type FallingTile,
} from "./fallingGame";
import { playCorrect, playWin, playWrong } from "./lib";

type GamePhase = "ready" | "playing" | "finished" | "lost";
type Feedback = { kind: "good" | "bad"; text: string } | null;

export default function FallingPairs({
  sound,
  onBack,
  onPoints,
}: {
  sound: boolean;
  onBack: () => void;
  onPoints: (points: number) => void;
}) {
  const [round, setRound] = useState<FallingRound | null>(null);
  const [tiles, setTiles] = useState<FallingTile[]>([]);
  const [phase, setPhaseState] = useState<GamePhase>("ready");
  const [mistakes, setMistakes] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const phaseRef = useRef<GamePhase>("ready");
  const mistakesRef = useRef(0);
  const matchedRef = useRef(0);
  const resolvedRef = useRef(0);
  const resolvedIdsRef = useRef(new Set<string>());
  const pairTimersRef = useRef(new Map<string, Set<number>>());
  const feedbackTimerRef = useRef<number | null>(null);
  const resolvePairRef = useRef<(pairId: string, matched: boolean) => void>(() => {});

  function changePhase(next: GamePhase) {
    phaseRef.current = next;
    setPhaseState(next);
    if (next !== "playing") {
      pairTimersRef.current.forEach((timers) => timers.forEach((timer) => window.clearTimeout(timer)));
      pairTimersRef.current.clear();
    }
  }

  function clearPairTimers(pairId: string) {
    const timers = pairTimersRef.current.get(pairId);
    timers?.forEach((timer) => window.clearTimeout(timer));
    pairTimersRef.current.delete(pairId);
  }

  function showFeedback(next: Feedback) {
    setFeedback(next);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    if (next) {
      feedbackTimerRef.current = window.setTimeout(() => {
        feedbackTimerRef.current = null;
        setFeedback(null);
      }, 1500);
    } else {
      feedbackTimerRef.current = null;
    }
  }

  function registerMistake(message: string) {
    if (phaseRef.current !== "playing") return;
    const next = mistakesRef.current + 1;
    mistakesRef.current = next;
    setMistakes(next);
    showFeedback({ kind: "bad", text: `${message} · ошибка ${next} из 3` });
    if (sound) playWrong();
    if (next >= 3) changePhase("lost");
  }

  function resolvePair(pairId: string, matched: boolean) {
    if (phaseRef.current !== "playing" || resolvedIdsRef.current.has(pairId)) return;
    resolvedIdsRef.current.add(pairId);
    clearPairTimers(pairId);
    setTiles((current) => current.filter((tile) => tile.pairId !== pairId));
    setSelectedId(null);

    const resolved = resolvedRef.current + 1;
    resolvedRef.current = resolved;

    if (matched) {
      const nextMatched = matchedRef.current + 1;
      matchedRef.current = nextMatched;
      setMatchedPairs(nextMatched);
      setScore((current) => current + 10);
      onPoints(10);
      showFeedback({ kind: "good", text: "Идеальная пара · +10 очков" });
      if (sound) {
        if (nextMatched === (round?.capitals.length ?? FALLING_ROUND_SIZE)) playWin();
        else playCorrect();
      }
    } else {
      registerMistake("Плитка ушла за край");
    }

    if (
      phaseRef.current === "playing" &&
      resolved >= (round?.capitals.length ?? FALLING_ROUND_SIZE)
    ) {
      changePhase("finished");
    }
  }

  resolvePairRef.current = resolvePair;

  function startGame() {
    pairTimersRef.current.forEach((timers) => timers.forEach((timer) => window.clearTimeout(timer)));
    pairTimersRef.current.clear();
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    resolvedIdsRef.current = new Set();
    mistakesRef.current = 0;
    matchedRef.current = 0;
    resolvedRef.current = 0;
    setMistakes(0);
    setMatchedPairs(0);
    setScore(0);
    setSelectedId(null);
    setTiles([]);
    showFeedback(null);
    const nextRound = createFallingRound(capitals);
    setRound(nextRound);
    changePhase("playing");
  }

  function chooseTile(tile: FallingTile) {
    if (phaseRef.current !== "playing" || resolvedIdsRef.current.has(tile.pairId)) return;
    if (!selectedId) {
      setSelectedId(tile.id);
      return;
    }
    if (selectedId === tile.id) {
      setSelectedId(null);
      return;
    }

    const first = tiles.find((candidate) => candidate.id === selectedId);
    if (!first) {
      setSelectedId(tile.id);
      return;
    }
    if (first.kind === tile.kind) {
      setSelectedId(tile.id);
      return;
    }
    if (first.pairId === tile.pairId) {
      resolvePair(tile.pairId, true);
    } else {
      setSelectedId(null);
      registerMistake("Это не пара");
    }
  }

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !round) return;
    let nextIndex = 0;
    let interval: number | undefined;

    const spawnNext = () => {
      while (nextIndex < round.queue.length && resolvedIdsRef.current.has(round.queue[nextIndex].pairId)) {
        nextIndex += 1;
      }
      if (nextIndex >= round.queue.length) {
        if (interval !== undefined) window.clearInterval(interval);
        return;
      }

      const tile = round.queue[nextIndex];
      nextIndex += 1;
      setTiles((current) => [...current, tile]);
      const timer = window.setTimeout(
        () => resolvePairRef.current(tile.pairId, false),
        FALLING_TILE_DURATION_MS
      );
      const timers = pairTimersRef.current.get(tile.pairId) ?? new Set<number>();
      timers.add(timer);
      pairTimersRef.current.set(tile.pairId, timers);

      if (nextIndex >= round.queue.length && interval !== undefined) window.clearInterval(interval);
    };

    spawnNext();
    interval = window.setInterval(spawnNext, FALLING_SPAWN_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [phase, round]);

  useEffect(
    () => () => {
      pairTimersRef.current.forEach((timers) => timers.forEach((timer) => window.clearTimeout(timer)));
      pairTimersRef.current.clear();
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  const totalPairs = round?.capitals.length ?? FALLING_ROUND_SIZE;
  const tileStyle = (tile: FallingTile): CSSProperties => ({
    left: tile.lane === 0 ? "26%" : "74%",
    animationDuration: `${FALLING_TILE_DURATION_MS}ms`,
    "--tile-width": `${Math.min(340, Math.max(154, 68 + tile.label.length * 8.4))}px`,
    "--tile-row-offset": `${tile.queueRow * 5}rem`,
  } as CSSProperties);

  return (
    <section className="animate-rise mx-auto max-w-5xl">
      <button onClick={onBack} className="mb-6 text-sm text-[#e8d5a3]/70 hover:text-[#d4a853]">
        ← на главную
      </button>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[#d4a853]">игра на скорость · 45 стран</p>
          <h1 className="mt-2 font-serif text-4xl sm:text-6xl">Поймай пару</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#f4ead5]/70 sm:text-base">
            Столицы и государства падают вперемешку. Найди плитки одной и той же страны — верная пара исчезнет. Не дай им долететь до края.
          </p>
        </div>
        <div className="rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/[0.06] px-4 py-3 text-xs text-[#e8d5a3]/70">
          8 пар <span className="mx-2 text-[#d4a853]/50">/</span> 3 ошибки
        </div>
      </div>

      <div className="glass-strong rounded-[2rem] p-4 shadow-2xl shadow-black/30 sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <GameStat label="найдено" value={`${matchedPairs}/${totalPairs}`} />
          <GameStat label="очки раунда" value={String(score)} />
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#e8d5a3]/55 sm:text-[10px]">ошибки</div>
            <div className="mt-1 flex justify-center gap-1.5" aria-label={`Ошибок: ${mistakes} из 3`}>
              {[0, 1, 2].map((life) => (
                <span key={life} aria-hidden="true" className={`text-xl leading-none ${life < mistakes ? "text-white/20" : "text-rose-300"}`}>
                  ♥
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`falling-board mt-5 ${reducedMotion ? "motion-reduced" : ""}`}
          role="group"
          aria-label="Игровое поле. Выбери столицу и соответствующее государство."
        >
          <div className="falling-board-grid" aria-hidden="true" />
          <div className="falling-lane-label falling-lane-label-left" aria-hidden="true">дорожка 01</div>
          <div className="falling-lane-label falling-lane-label-right" aria-hidden="true">дорожка 02</div>

          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              disabled={phase !== "playing"}
              onClick={() => chooseTile(tile)}
              style={tileStyle(tile)}
              aria-label={`${tile.kind === "capital" ? "Столица" : "Государство"}: ${tile.label}`}
              aria-pressed={selectedId === tile.id}
              className={`falling-tile ${tile.kind === "capital" ? "falling-tile-capital" : "falling-tile-country"} ${selectedId === tile.id ? "falling-tile-selected" : ""}`}
            >
              <span className="falling-tile-kind">{tile.kind === "capital" ? "СТОЛИЦА" : "ГОСУДАРСТВО"}</span>
              <span className="falling-tile-label">{tile.label}</span>
            </button>
          ))}

          {phase === "ready" && (
            <div className="falling-overlay">
              <div className="falling-overlay-card">
                <span className="falling-emblem" aria-hidden="true">✦</span>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#d4a853]">быстрый раунд · 8 пар</p>
                <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Узнай страну по столице</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#f4ead5]/70">
                  Выбирай соответствующие государство и столицу — в любом порядке. За неверную пару или плитку, долетевшую до низа, теряешь жизнь.
                </p>
                <button onClick={startGame} className="mt-6 min-h-12 rounded-full bg-[#d4a853] px-7 py-3 text-sm font-semibold text-[#071018] shadow-lg shadow-amber-900/30 transition hover:brightness-110">
                  Начать игру <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          )}

          {(phase === "finished" || phase === "lost") && (
            <div className="falling-overlay">
              <div className="falling-overlay-card">
                <span className="falling-emblem" aria-hidden="true">{phase === "finished" && matchedPairs === totalPairs ? "✦" : "◈"}</span>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#d4a853]">раунд завершён</p>
                <h2 className="mt-2 font-serif text-3xl sm:text-4xl">
                  {phase === "lost"
                    ? "Три ошибки — попытка окончена"
                    : matchedPairs === totalPairs
                      ? "Все пары найдены!"
                      : "Хороший спринт!"}
                </h2>
                <p className="mt-3 text-sm text-[#f4ead5]/70">
                  Совпало {matchedPairs} из {totalPairs} · {score} очков
                </p>
                <button onClick={startGame} className="mt-6 min-h-12 rounded-full bg-[#d4a853] px-7 py-3 text-sm font-semibold text-[#071018] shadow-lg shadow-amber-900/30 transition hover:brightness-110">
                  Ещё раунд <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex min-h-7 flex-wrap items-center justify-between gap-3 text-xs text-[#e8d5a3]/55">
          <p>Неверный выбор или упавшая плитка = одна ошибка. Три ошибки завершают раунд.</p>
          {reducedMotion && <p>Анимация падения отключена по настройке устройства; плитки показаны рядами.</p>}
        </div>
        <p className="sr-only" role="status" aria-live="polite">{feedback?.text ?? ""}</p>
        {feedback && (
          <div aria-hidden="true" className={`mt-1 text-sm ${feedback.kind === "good" ? "text-emerald-300" : "text-rose-300"}`}>
            {feedback.text}
          </div>
        )}
      </div>
    </section>
  );
}

function GameStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center sm:p-4">
      <div className="text-[9px] uppercase tracking-[0.18em] text-[#e8d5a3]/55 sm:text-[10px]">{label}</div>
      <div className="mt-1 font-serif text-2xl text-[#f4ead5] sm:text-3xl">{value}</div>
    </div>
  );
}
