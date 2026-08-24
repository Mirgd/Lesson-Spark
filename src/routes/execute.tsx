import { useUiLanguage } from "@/lib/ui-language";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhaseImages } from "@/components/PhaseImages";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Monitor } from "lucide-react";
import { useCurrentPlan, totalDuration, phaseMeta } from "@/lib/lesson-types";
import { EXEC_PHASE_KEY, usePresentation } from "@/lib/presentation";
import { SlideView } from "@/components/SlideView";
import { useSelfCheck, useWorksheet } from "@/lib/worksheet";
import { WorksheetQuestions } from "@/components/WorksheetQuestions";
import { publishExecTimer, useExecTimer } from "@/lib/exec-timer";
import { TimerBadge } from "@/components/TimerBadge";


export const Route = createFileRoute("/execute")({
  head: () => ({
    meta: [
      { title: "التنفيذ — المدرسة الرمز · التعلم العميق" },
      { name: "description", content: "وضع تنفيذ الحصة مع عرض متزامن للطالب." },
    ],
  }),
  component: Execute,
});

function Execute() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [plan] = useCurrentPlan();
  const navigate = useNavigate();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    (plan.phases[0]?.duration ?? 0) * 60
  );
  const [running, setRunning] = useState(false);
  const [elapsedByPhase, setElapsedByPhase] = useState<number[]>(() =>
    plan.phases.map(() => 0)
  );

  const intervalRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const [slides] = usePresentation();
  const [slideIdx, setSlideIdx] = useState(0);
  const [worksheet] = useWorksheet();
  const [checked, toggleCheck] = useSelfCheck();
  const [combined, setCombined] = useState(true);
  const liveTimer = useExecTimer();

  const current = plan.phases[phaseIdx];
  const meta = current ? phaseMeta(current.id) : null;
  const next = plan.phases[phaseIdx + 1];
  const nextMeta = next ? phaseMeta(next.id) : null;
  const total = totalDuration(plan);

  useEffect(() => {
    const phase = plan.phases[phaseIdx]?.id;

    if (!phase) return;

    try {
      localStorage.setItem(EXEC_PHASE_KEY, phase);
    } catch (e) {
      console.error(e);
    }

    const target = slides.findIndex(
      (s) => s.phase === phase
    );

    if (target >= 0) {
      setSlideIdx(target);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx, slides.length]);

  useEffect(() => {
    if (current) {
      setSecondsLeft(current.duration * 60);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) =>
        s <= 1
          ? (setRunning(false), 0)
          : s - 1
      );

      setElapsedByPhase((arr) => {
        const copy = [...arr];
        copy[phaseIdx] =
          (copy[phaseIdx] ?? 0) + 1;
        return copy;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [running, phaseIdx]);

  useEffect(() => {
    const ph = plan.phases[phaseIdx];
    const m = ph ? phaseMeta(ph.id) : null;

    if (!ph || !m) return;

    publishExecTimer({
      phaseAr: m.nameAr,
      phaseEn: m.nameEn,
      color: m.color,
      secondsLeft,
      durationSec: ph.duration * 60,
      running,
      phaseIdx,
      phaseCount: plan.phases.length,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    secondsLeft,
    running,
    phaseIdx,
    plan.phases.length,
  ]);

  if (!current || !meta) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">
          {isArabic
            ? "لا توجد خطة حالية."
            : "There is no active lesson plan."}
        </p>

        <Link
          to="/planning"
          className="mt-4 inline-block text-primary underline"
        >
          {isArabic
            ? "اذهب للتخطيط"
            : "Go to Planning"}
        </Link>
      </main>
    );
  }

  const mm = String(
    Math.floor(secondsLeft / 60)
  ).padStart(2, "0");

  const ss = String(
    secondsLeft % 60
  ).padStart(2, "0");

  const warning =
    secondsLeft > 0 &&
    secondsLeft <= 120;

  const finished = secondsLeft === 0;

  const isLast =
    phaseIdx ===
    plan.phases.length - 1;

  const pct =
    current.duration > 0
      ? 1 -
        secondsLeft /
          (current.duration * 60)
      : 0;

  const R = 112;
  const C = 2 * Math.PI * R;

  const goNext = () => {
    if (isLast) {
      navigate({
        to: "/reflection",
      });

      return;
    }

    setPhaseIdx((i) => i + 1);
    setRunning(false);
  };

  const goPrev = () => {
    if (phaseIdx === 0) return;

    setPhaseIdx((i) => i - 1);
    setRunning(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const openStudentScreen = () => {
    const w = window.open(
      "/presentation",
      "student",
      "width=1280,height=800"
    );

    w?.focus();
  };

  const currentSlide = slides.length
    ? Math.min(
        slideIdx,
        slides.length - 1
      )
    : -1;

  const sheet =
    currentSlide >= 0
      ? worksheet.find(
          (w) =>
            w.slideIndex === currentSlide
        )
      : undefined;

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#0D1F3C] p-4 transition-colors duration-500 sm:p-6">
      <div className="mx-auto max-w-3xl">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {plan.phases.map((ph, idx) => {
              const m = phaseMeta(ph.id);
              const isDone = idx < phaseIdx;
              const isCurrent =
                idx === phaseIdx;

              return (
                <div
                  key={ph.id}
                  style={{
                    flex:
                      ph.duration || 1,
                    background:
                      m.color,
                    color:
                      m.color,
                    opacity:
                      isDone ||
                      isCurrent
                        ? 1
                        : 0.25,
                    boxShadow:
                      isCurrent
                        ? "0 0 12px currentColor"
                        : undefined,
                  }}
                  className={`h-1.5 rounded-full transition-all duration-400 ${
                    isCurrent
                      ? "animate-pulse"
                      : ""
                  }`}
                />
              );
            })}
          </div>

          <div className="shrink-0 text-xs text-white/60">
            {phaseIdx + 1}/
            {plan.phases.length}
          </div>

          <button
            onClick={openStudentScreen}
            className="hidden shrink-0 items-center gap-2 rounded-lg border-2 border-gold bg-gold/15 px-3 py-1.5 text-[14px] font-bold text-[#D4A017] transition-colors hover:bg-gold/25 sm:inline-flex"
          >
            <Monitor className="h-4 w-4" />

            {isArabic
              ? "افتح شاشة الطالب"
              : "Open Student Screen"}
          </button>

          <button
            onClick={() =>
              setCombined((v) => !v)
            }
            className="shrink-0 rounded-md border border-white/15 px-2.5 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/10"
          >
            {combined
              ? isArabic
                ? "مؤقت كبير"
                : "Large Timer"
              : isArabic
                ? "عرض + مؤقت"
                : "Slides + Timer"}
          </button>

          <button
            onClick={toggleFullscreen}
            className="shrink-0 rounded-md border border-white/15 p-2 text-white/70 hover:bg-white/10"
            aria-label={
              isArabic
                ? "ملء الشاشة"
                : "Fullscreen"
            }
            title={
              isArabic
                ? "ملء الشاشة"
                : "Fullscreen"
            }
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Phase badge */}
        <div className="mb-5 flex justify-center">
          <div
            className="inline-flex items-center gap-2.5 rounded-3xl px-5 py-2 text-[18px] font-bold text-white shadow-lg"
            style={{
              background: meta.color,
            }}
          >
            <span className="h-2 w-2 rounded-full bg-white" />

            <span>
              {isArabic
                ? meta.nameAr
                : meta.nameEn}
            </span>

            <span className="text-xs font-medium opacity-80">
              ·{" "}
              {isArabic
                ? meta.nameEn
                : meta.nameAr}
            </span>
          </div>
        </div>

        {/* Combined slide + timer */}
{combined && slides.length > 0 && (
  <div className="mb-5 overflow-hidden rounded-2xl border border-white/12 bg-black">

    {/* =========================
        Top controls / timer bar
    ========================= */}
    {liveTimer && (
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#1B2A4A] px-4 py-3">
        <div className="text-xs font-bold text-white/60">
          {isArabic
            ? "مؤقت المرحلة"
            : "Phase Timer"}
        </div>

        <TimerBadge
          state={liveTimer}
          size={82}
        />
      </div>
    )}

    {/* =========================
        Slide
    ========================= */}
    <div className="aspect-video">
      <SlideView
        slide={
          slides[
            Math.min(
              slideIdx,
              slides.length - 1,
            )
          ]
        }
        index={Math.min(
          slideIdx,
          slides.length - 1,
        )}
        count={slides.length}
        topic={plan.topic}
      />
    </div>

    {/* =========================
        Slide navigation
    ========================= */}
    <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/90 px-4 py-3">
      <button
        onClick={() =>
          setSlideIdx((i) =>
            Math.max(i - 1, 0),
          )
        }
        className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/20"
        aria-label={
          isArabic
            ? "الشريحة السابقة"
            : "Previous Slide"
        }
      >
        {isArabic ? "→" : "←"}
      </button>

      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
        {Math.min(
          slideIdx,
          slides.length - 1,
        ) + 1}
        /{slides.length}
      </span>

      <button
        onClick={() =>
          setSlideIdx((i) =>
            Math.min(
              i + 1,
              slides.length - 1,
            ),
          )
        }
        className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/20"
        aria-label={
          isArabic
            ? "الشريحة التالية"
            : "Next Slide"
        }
      >
        {isArabic ? "←" : "→"}
      </button>
    </div>
  </div>
)}

        {/* Big circular timer */}
        <div
          className={`mb-5 flex justify-center ${
            combined &&
            slides.length > 0
              ? "hidden"
              : ""
          }`}
        >
          <div className="relative">
            <svg
              width={260}
              height={260}
              className="-rotate-90"
            >
              <circle
                cx={130}
                cy={130}
                r={R}
                fill="none"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={12}
              />

              <circle
                cx={130}
                cy={130}
                r={R}
                fill="none"
                stroke={meta.color}
                strokeWidth={12}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={
                  C * pct
                }
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={`font-extrabold tabular-nums leading-none tracking-[-2px] ${
                  warning
                    ? "animate-pulse text-[#FC8181]"
                    : "text-white"
                }`}
                style={{
                  fontSize: 64,
                }}
              >
                {mm}:{ss}
              </div>

              <div className="mt-2 text-xs text-white/50">
                {isArabic
                  ? "دقيقة"
                  : "minutes"}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-4 flex items-center justify-center gap-4">
          <button
            onClick={goPrev}
            disabled={phaseIdx === 0}
            className="rounded-full border border-white/15 bg-white/5 p-3 text-white hover:bg-white/10 disabled:opacity-30"
            aria-label={
              isArabic
                ? "السابق"
                : "Previous"
            }
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <button
            onClick={() =>
              setRunning((r) => !r)
            }
            disabled={finished}
            className="rounded-full p-6 text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-40"
            style={{
              background: meta.color,
            }}
            aria-label={
              running
                ? isArabic
                  ? "إيقاف"
                  : "Pause"
                : isArabic
                  ? "تشغيل"
                  : "Start"
            }
          >
            {running ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8" />
            )}
          </button>

          <button
            onClick={goNext}
            className="rounded-full border border-white/15 bg-white/5 p-3 text-white hover:bg-white/10"
            aria-label={
              isArabic
                ? "التالي"
                : "Next"
            }
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Student screen mobile */}
        <div className="mb-4 flex justify-center sm:hidden">
          <button
            onClick={openStudentScreen}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gold bg-gold/15 px-4 py-2 text-[15px] font-bold text-[#D4A017]"
          >
            <Monitor className="h-4 w-4" />

            {isArabic
              ? "افتح شاشة الطالب"
              : "Open Student Screen"}
          </button>
        </div>

        {finished && (
          <div className="mb-4 rounded-xl border border-[#FC8181]/40 bg-[#FC8181]/10 p-4 text-center text-white">
            <p className="mb-3 font-bold">
              {isArabic
                ? "انتهى وقت هذه المرحلة"
                : "Time for this phase has ended"}
            </p>

            <button
              onClick={goNext}
              className="rounded-lg bg-gold px-5 py-2 text-[15px] font-bold text-white hover:bg-[#D4A017]"
            >
              {isLast
                ? isArabic
                  ? "إنهاء الحصة والانتقال للتأمل"
                  : "Finish Lesson and Continue to Reflection"
                : isArabic
                  ? "الانتقال للمرحلة التالية"
                  : "Continue to Next Phase"}
            </button>
          </div>
        )}

        {/* Hint */}
        <div className="mb-3 rounded-xl border border-white/12 border-r-[3px] border-r-gold bg-white/8 p-4">
          <div className="mb-1 text-[14px] font-bold text-[#D4A017]">
            📌{" "}
            {isArabic
              ? "ماذا يجب أن يحدث الآن؟"
              : "What Should Happen Now?"}
          </div>

          <p className="text-[16px] leading-[1.7] text-white/85">
            {isArabic
              ? meta.teacherHint
              : `Guide students through the ${meta.nameEn} phase using the planned activity and questions.`}
          </p>
        </div>

        {/* Teacher activity */}
        <div className="mb-3 rounded-xl bg-white/5 p-4">
          <div className="mb-2 text-[14px] font-bold text-white/60">
            📋{" "}
            {isArabic
              ? "نشاطك المخطط"
              : "Your Planned Activity"}
          </div>

          <p className="whitespace-pre-wrap text-[16px] leading-[1.7] text-white/75">
            {current.teacherActivity.trim() ||
              (
                <span className="text-white/40">
                  {isArabic
                    ? "لم تُدخل نشاطاً لهذه المرحلة."
                    : "No teacher activity has been added for this phase."}
                </span>
              )}
          </p>
        </div>

        {/* Student view */}
        <div className="mb-3 rounded-xl bg-white/5 p-4">
          <div className="mb-2 text-[14px] font-bold text-white/60">
            👁{" "}
            {isArabic
              ? "ما يراه الطالب الآن"
              : "What Students See Now"}
          </div>

          <p className="whitespace-pre-wrap text-[16px] leading-[1.7] text-white/75">
            {current.studentActivity.trim() ||
              (
                <span className="italic text-white/40">
                  {isArabic
                    ? meta.studentPlaceholder
                    : `Student activity for the ${meta.nameEn} phase`}
                </span>
              )}
          </p>

          <PhaseImages
            images={current.images}
            className="mt-3"
            dark
          />
        </div>

        {/* Slide control */}
        {slides.length > 0 && (
          <div className="card-elevated mb-3 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0 text-sm font-bold text-primary">
                🎬{" "}
                {isArabic
                  ? `الشريحة ${currentSlide + 1}/${slides.length}`
                  : `Slide ${currentSlide + 1}/${slides.length}`}
              </div>

              <a
                href="/worksheet"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-md px-3 py-1 text-xs font-bold text-white"
                style={{
                  background: "#1E7CA8",
                }}
              >
                🖨{" "}
                {isArabic
                  ? "ورقة العمل"
                  : "Worksheet"}
              </a>
            </div>

            <div className="h-56">
              <SlideView
                slide={
                  slides[currentSlide]
                }
                index={currentSlide}
                count={slides.length}
                topic={plan.topic}
              />
            </div>

            <div className="mt-2 flex justify-center gap-3 text-sm">
              <button
                onClick={() =>
                  setSlideIdx((i) =>
                    Math.max(
                      i - 1,
                      0
                    )
                  )
                }
                className="rounded border px-4 py-1 hover:bg-accent"
              >
                {isArabic
                  ? "←"
                  : "←"}
              </button>

              <button
                onClick={() =>
                  setSlideIdx((i) =>
                    Math.min(
                      i + 1,
                      slides.length - 1
                    )
                  )
                }
                className="rounded border px-4 py-1 hover:bg-accent"
              >
                {isArabic
                  ? "→"
                  : "→"}
              </button>
            </div>

            {sheet && (
              <div
                className="mt-3 rounded-xl border-2 bg-card p-4"
                style={{
                  borderColor:
                    "#1E7CA8",
                }}
              >
                <div
                  className="mb-2 text-xs font-bold"
                  style={{
                    color: "#1E7CA8",
                  }}
                >
                  📝{" "}
                  {isArabic
                    ? "أسئلة هذه الشريحة"
                    : "Questions for This Slide"}
                </div>

                <WorksheetQuestions
                  item={sheet}
                />

                <label
                  className="mt-3 flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm font-bold"
                  style={{
                    background:
                      "#B8860B18",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(
                      checked[
                        `s${currentSlide}`
                      ]
                    )}
                    onChange={() =>
                      toggleCheck(
                        `s${currentSlide}`
                      )
                    }
                    className="mt-1"
                  />

                  <span>
                    {sheet.selfCheck}
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Next up */}
        {nextMeta && (
          <div className="rounded-xl border border-white/12 bg-white/5 p-3 text-center text-[15px] text-white/70">
            ⟳{" "}
            {isArabic
              ? "التالي:"
              : "Next:"}{" "}
            <span className="font-bold text-white">
              {isArabic
                ? nextMeta.nameAr
                : nextMeta.nameEn}
            </span>{" "}
            — {next!.duration}{" "}
            {isArabic ? "دق" : "min"}
          </div>
        )}

        <div className="mt-3 text-center text-xs text-white/45">
          {isArabic
            ? "الوقت المنقضي في هذه المرحلة:"
            : "Elapsed time in this phase:"}{" "}
          {Math.floor(
            (elapsedByPhase[
              phaseIdx
            ] ?? 0) / 60
          )}
          :
          {String(
            (elapsedByPhase[
              phaseIdx
            ] ?? 0) % 60
          ).padStart(2, "0")}
        </div>
      </div>
    </main>
  );
}

