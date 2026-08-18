import { useEffect, useState } from "react";
import { getPageImage, PHASE_LABELS, type Slide } from "@/lib/presentation";

export function SlideImage({ pageNumber, alt }: { pageNumber?: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (pageNumber == null) {
      setSrc(null);
      return;
    }
    getPageImage(pageNumber)
      .then((v) => {
        if (alive) setSrc(v);
      })
      .catch(() => setSrc(null));
    return () => {
      alive = false;
    };
  }, [pageNumber]);

  if (!src)
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-white/5 text-xs text-white/40">
        {pageNumber ? `صفحة ${pageNumber}` : "—"}
      </div>
    );

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full rounded-lg bg-white object-contain"
      loading="lazy"
    />
  );
}

export function SlideView({
  slide,
  index,
  count,
  topic,
}: {
  slide: Slide;
  index: number;
  count: number;
  topic: string;
}) {
  const meta = PHASE_LABELS[slide.phase] ?? PHASE_LABELS.cover;

  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col overflow-hidden rounded-xl"
      style={{ background: "#1B2A4A" }}
    >
      {/* phase bar */}
      <div
        className="flex items-center justify-between px-4 py-2 text-white"
        style={{ background: meta.color }}
      >
        <span className="text-sm font-bold">● {meta.ar}</span>
        <span className="truncate px-2 text-sm opacity-80">{topic}</span>
        <span className="text-sm tabular-nums opacity-90">
          {index + 1} / {count}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {slide.type === "cover" ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-black" style={{ color: "#B8860B" }}>
              {slide.title}
            </h2>
            <div className="mt-2 text-white/70">
              {slide.subject || "—"} · {slide.grade || "—"}
            </div>
            {slide.outcomes && slide.outcomes.length > 0 && (
              <>
              <div className="mt-6 text-base font-bold" style={{ color: "#B8860B" }}>
                ماذا سأتعلم اليوم؟
              </div>
              <ul className="mt-2 space-y-2 text-right text-lg text-white">
                {slide.outcomes.map((o, i) => (
                  <li key={i}>• {o}</li>
                ))}
              </ul>
              </>
            )}
          </div>
        ) : slide.type === "homework" ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-black" style={{ color: "#B8860B" }}>
              📋 {slide.title}
            </h2>
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-xl leading-loose text-white">
              {slide.homework?.trim() || "—"}
            </p>
          </div>
        ) : (
          <div className="grid h-full gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <h2
                className="mb-3 border-b-2 pb-2 text-2xl font-black"
                style={{ color: "#B8860B", borderColor: "#B8860B55" }}
              >
                {slide.title}
              </h2>
              <ul className="space-y-3 text-lg leading-relaxed text-white">
                {(slide.points ?? []).map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
            <div className="min-h-[180px]">
              <SlideImage pageNumber={slide.pageNumber} alt={slide.title} />
            </div>
          </div>
        )}
      </div>

      {slide.question && (
        <div
          className="px-5 py-3 text-lg font-bold"
          style={{ background: "#B8860B22", color: "#B8860B" }}
        >
          💬 {slide.question}
        </div>
      )}
    </div>
  );
}
