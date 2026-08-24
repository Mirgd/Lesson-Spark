import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, Maximize2 } from "lucide-react";
import { EXEC_PHASE_KEY, downloadPresentationPptx, usePresentation } from "@/lib/presentation";
import { SlideView } from "@/components/SlideView";
import { useCurrentPlan } from "@/lib/lesson-types";
import { useExecTimer } from "@/lib/exec-timer";
import { TimerBadge } from "@/components/TimerBadge";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "العرض التقديمي — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content: "عرض شرائح مبني من صور الكتاب المدرسي ومتزامن مع مراحل 5E.",
      },
      { property: "og:title", content: "العرض التقديمي — التعلم العميق" },
      {
        property: "og:description",
        content: "شرائح 5E مبنية من صفحات الكتاب المدرسي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresentationPage,
});

function PresentationPage() {
  const [slides] = usePresentation();
  const [plan] = useCurrentPlan();
  const [idx, setIdx] = useState(0);
  const timer = useExecTimer();
  const [showTimer, setShowTimer] = useState(true);

  
  // Sync with execution phase across windows.
  useEffect(() => {
    const sync = () => {
      const phase = localStorage.getItem(EXEC_PHASE_KEY);
      if (!phase) return;
      const target = slides.findIndex((s) => s.phase === phase);
      if (target >= 0) setIdx(target);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [slides]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#1B2A4A] p-8 text-center text-white">
        <p>لا يوجد عرض محفوظ — أنشئ العرض من صفحة التخطيط.</p>
      </main>
    );
  }

  const slide = slides[Math.min(idx, slides.length - 1)];

  return (
    <main dir="rtl" className="relative flex min-h-screen flex-col bg-black p-3">
      {timer && showTimer && (
        <div className="absolute left-4 top-4 z-20">
          <TimerBadge state={timer} size={130} />
        </div>
      )}
      <div className="min-h-0 flex-1">
        <SlideView slide={slide} index={idx} count={slides.length} topic={plan.topic} />
      </div>
      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="السابق"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`شريحة ${i + 1}`}
              className={`h-2 w-2 rounded-full ${i === idx ? "bg-[#B8860B]" : "bg-white/30"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(i + 1, slides.length - 1))}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="التالي"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() =>
            document.fullscreenElement
              ? document.exitFullscreen?.()
              : document.documentElement.requestFullscreen?.()
          }
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="ملء الشاشة"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowTimer((v) => !v)}
          className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
        >
          {showTimer ? "إخفاء المؤقت" : "إظهار المؤقت"}
        </button>
      </div>
    </main>
  );
}
