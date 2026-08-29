import { useEffect, useState } from "react";
import { getPageImage, PHASE_LABELS, type Slide } from "@/lib/presentation";

/* =========================================================
   صورة صفحة الكتاب الأصلية
========================================================= */

export function SlideImage({ pageNumber, alt }: { pageNumber?: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (pageNumber == null) {
      setSrc(null);

      return;
    }

    getPageImage(pageNumber)
      .then((value) => {
        if (alive) {
          setSrc(value);
        }
      })
      .catch(() => {
        if (alive) {
          setSrc(null);
        }
      });

    return () => {
      alive = false;
    };
  }, [pageNumber]);

  if (!src) {
    return (
      <div className="flex h-full min-h-[180px] w-full items-center justify-center rounded-lg bg-white/5 text-xs text-white/40">
        {pageNumber ? `صفحة ${pageNumber}` : "—"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full max-h-[420px] w-full rounded-lg bg-white object-contain"
      loading="lazy"
    />
  );
}

/* =========================================================
   صورة أضافتها المعلمة
========================================================= */

function CustomSlideImage({ slide }: { slide: Slide }) {
  /*
   * نعطي الأولوية للصورة التي أضيفت
   * أثناء تعديل الشريحة.
   *
   * وإذا لم توجد نستخدم imageUrl.
   */
  const src = slide.imageDataUrl || slide.imageUrl || null;

  if (!src) {
    return null;
  }

  return (
    <div className="flex h-full min-h-[180px] items-center justify-center">
      <img
        src={src}
        alt={slide.title || ""}
        className="max-h-[420px] max-w-full rounded-lg bg-white object-contain"
      />
    </div>
  );
}
/* =========================================================
   فيديو أضافته المعلمة
========================================================= */

function CustomSlideVideo({ slide }: { slide: Slide }) {
  if (!slide.videoDataUrl) {
    return null;
  }

  return (
    <div className="flex h-full min-h-[180px] items-center justify-center">
      <video
        src={slide.videoDataUrl}
        controls
        className="max-h-[420px] w-full rounded-lg bg-black object-contain"
      />
    </div>
  );
}

/* =========================================================
   صوت أضافته المعلمة
========================================================= */

function CustomSlideAudio({ slide }: { slide: Slide }) {
  if (!slide.audioDataUrl) {
    return null;
  }

  return (
    <div className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-lg bg-white/5 p-5">
      <div className="mb-4 text-5xl">🎵</div>

      {slide.audioName && (
        <div className="mb-3 max-w-full truncate text-sm text-white/70">{slide.audioName}</div>
      )}

      <audio src={slide.audioDataUrl} controls className="w-full max-w-lg" />
    </div>
  );
}

/* =========================================================
   Slide View
========================================================= */

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

  /*
   * هل أضافت المعلمة صورة مخصصة؟
   */
  const hasCustomImage = Boolean(slide.imageDataUrl || slide.imageUrl);
  const hasCustomVideo = Boolean(slide.videoDataUrl);
  const hasCustomAudio = Boolean(slide.audioDataUrl);

  const hasCustomMedia = hasCustomVideo || hasCustomAudio || hasCustomImage;
  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col overflow-hidden rounded-xl"
      style={{
        background: "#1B2A4A",
      }}
    >
      {/* =========================
          Phase Bar
      ========================= */}

      <div
        className="flex items-center justify-between px-4 py-2 text-white"
        style={{
          background: meta.color,
        }}
      >
        <span className="text-sm font-bold">● {meta.ar}</span>

        <span className="truncate px-2 text-sm opacity-80">{topic}</span>

        <span className="text-sm tabular-nums opacity-90">
          {index + 1} / {count}
        </span>
      </div>

      {/* =========================
          Main Content
      ========================= */}

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/* =========================
            Cover
        ========================= */}

        {slide.type === "cover" ? (
          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <h2
              className="text-3xl font-black"
              style={{
                color: "#B8860B",
              }}
            >
              {slide.title}
            </h2>

            <div className="mt-2 text-white/70">
              {slide.subject || "—"} · {slide.grade || "—"}
            </div>

            {/* صورة الغلاف المضافة يدوياً */}

            {hasCustomMedia && (
              <div className="mt-5 w-full max-w-xl">
                {hasCustomVideo ? (
                  <CustomSlideVideo slide={slide} />
                ) : hasCustomAudio ? (
                  <CustomSlideAudio slide={slide} />
                ) : (
                  <CustomSlideImage slide={slide} />
                )}
              </div>
            )}

            {slide.outcomes && slide.outcomes.length > 0 && (
              <>
                <div
                  className="mt-6 text-base font-bold"
                  style={{
                    color: "#B8860B",
                  }}
                >
                  ماذا سأتعلم اليوم؟
                </div>

                <ul className="mt-2 space-y-2 text-right text-lg text-white">
                  {slide.outcomes.map((outcome, outcomeIndex) => (
                    <li key={outcomeIndex}>• {outcome}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : slide.type === "homework" ? (
          /* =========================
              Homework
          ========================= */

          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <h2
              className="text-3xl font-black"
              style={{
                color: "#B8860B",
              }}
            >
              📋 {slide.title}
            </h2>

            {/* صورة الواجب */}

            {hasCustomMedia && (
              <div className="mt-5 w-full max-w-xl">
                {hasCustomVideo ? (
                  <CustomSlideVideo slide={slide} />
                ) : hasCustomAudio ? (
                  <CustomSlideAudio slide={slide} />
                ) : (
                  <CustomSlideImage slide={slide} />
                )}
              </div>
            )}

            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-xl leading-loose text-white">
              {slide.homework?.trim() || "—"}
            </p>
          </div>
        ) : (
          /* =========================
              Content / Blank
          ========================= */

          <div className="grid min-h-full gap-4 md:grid-cols-2">
            {/* النص */}

            <div className="min-w-0">
              <h2
                className="mb-3 border-b-2 pb-2 text-2xl font-black"
                style={{
                  color: "#B8860B",
                  borderColor: "#B8860B55",
                }}
              >
                {slide.title}
              </h2>

              <ul className="space-y-3 text-lg leading-relaxed text-white">
                {(slide.points ?? []).map((point, pointIndex) => (
                  <li key={pointIndex}>• {point}</li>
                ))}
              </ul>
            </div>

            {/* الصورة */}

            <div className="min-h-[180px]">
              {hasCustomVideo ? (
                <CustomSlideVideo slide={slide} />
              ) : hasCustomAudio ? (
                <CustomSlideAudio slide={slide} />
              ) : hasCustomImage ? (
                <CustomSlideImage slide={slide} />
              ) : (
                <SlideImage pageNumber={slide.pageNumber} alt={slide.title} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================
          Interactive Question
      ========================= */}

      {slide.question && (
        <div
          className="px-5 py-3 text-lg font-bold"
          style={{
            background: "#B8860B22",
            color: "#B8860B",
          }}
        >
          💬 {slide.question}
        </div>
      )}
    </div>
  );
}
