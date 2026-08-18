import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Trash2, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import {
  buildPresentation,
  clearPageImages,
  putPageImage,
  reindex,
  usePresentation,
  PHASE_LABELS,
  type AnalyzedPage,
  type Slide,
} from "@/lib/presentation";
import {
  extractPdfAsImages,
  useSharedFile,
  pool,
  setLastPdfFile,
  getCurrentFileId,
} from "@/lib/pdf-images";

import { analyzePagesForPhase } from "@/lib/vision.functions";
import { clearFileArtifacts } from "@/lib/lesson-reset";
import { SlideView } from "@/components/SlideView";
import { planLang, type LessonPlan } from "@/lib/lesson-types";
import { reportAiError } from "@/lib/ai-error";
import { SharedFileBadge } from "@/components/SharedFileBadge";

const PURPLE = "#5D3FA0";

export function PresentationBuilder({ plan }: { plan: LessonPlan }) {
  const [slides, setSlides] = usePresentation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const { file: sharedFile, name: sharedName } = useSharedFile();
  const hasPdf = Boolean(sharedFile);
  const [preview, setPreview] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);


const run = async (file: File) => {
  setBusy(true);
  setDone(0);
  setTotal(0);
  setStatus("جارٍ تحويل صفحات الكتاب إلى صور...");

  try {
    const fileId = getCurrentFileId();

    const pages = await extractPdfAsImages(file, 15, (d, t) => {
      setDone(d);
      setTotal(t);
    });

    await clearPageImages();

    for (const p of pages) {
      await putPageImage(p.page, p.dataUrl, fileId);
    }

    if (getCurrentFileId() !== fileId) return;

    setDone(0);
    setTotal(pages.length);
    setStatus("جارٍ تحليل محتوى الصفحات...");

    const analyzed: AnalyzedPage[] = [];

    const BATCH_SIZE = 2;

    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      if (getCurrentFileId() !== fileId) return;

      const batch = pages.slice(i, i + BATCH_SIZE);

      setStatus(
        `جارٍ تحليل الصفحات ${batch[0].page} إلى ${
          batch[batch.length - 1].page
        } من ${pages.length}...`
      );

      const r = await analyzePagesForPhase({
        data: {
          pages: batch.map((p) => ({
            imageBase64: p.base64,
            pageNumber: p.page,
          })),
          topic: plan.topic,
          subject: plan.subject,
          lang: planLang(plan),
        },
      });

      analyzed.push(...(r as AnalyzedPage[]));

      setDone((d) => d + batch.length);

         }

    if (getCurrentFileId() !== fileId) return;

    const built = buildPresentation(analyzed, plan);
    setSlides(built);

    toast.success(`تم بناء العرض — ${built.length} شرائح`);
  } catch (e) {
    toast.error(
      reportAiError(
        e,
        "بناء العرض التقديمي",
        "فشل بناء العرض"
      )
    );
  } finally {
    setBusy(false);
    setStatus("");
  }
};

  const start = () => {
    if (sharedFile) void run(sharedFile);
    else inputRef.current?.click();
  };


  const removeSlide = (i: number) => setSlides(reindex(slides.filter((_, idx) => idx !== i)));

  const addBlank = () =>
    setSlides(
      reindex([
        ...slides,
        {
          id: slides.length,
          type: "blank",
          phase: "explain",
          title: "شريحة جديدة",
          points: [""],
          question: "",
        } as Slide,
      ]),
    );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= slides.length) return;
    const copy = [...slides];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    setSlides(reindex(copy));
  };

  const patch = (i: number, p: Partial<Slide>) =>
    setSlides(slides.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const counts = slides.reduce<Record<string, number>>((acc, s) => {
    acc[s.phase] = (acc[s.phase] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="card-elevated p-4">
      <SharedFileBadge name={hasPdf ? sharedName : ""} />

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          void (async () => {
            // ملف جديد ⇒ امسح صور وشرائح أي ملف سابق قبل البدء.
            if (f.name !== sharedName) await clearFileArtifacts();
            setLastPdfFile(f);
            await run(f);
          })();
        }}

      />

      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: PURPLE }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>🎬</span>}
        {busy ? "جارٍ البناء..." : "أنشئ عرضاً من صور الكتاب"}
      </button>
      {!hasPdf && !busy && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          إن لم يكن الملف مرفوعاً من قسم «تحميل ملف الدرس»، اضغط الزر لاختيار ملف PDF مباشرة
        </p>
      )}


      {busy && (
        <div className="mt-4 rounded-lg border p-3">
          <div className="mb-2 text-sm font-bold">🔄 جارٍ بناء العرض من الكتاب...</div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full transition-all"
              style={{
                width: `${total ? (done / total) * 100 : 0}%`,
                background: PURPLE,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{status}</span>
            <span>
              {done} من {total} صفحات
            </span>
          </div>
        </div>
      )}

      {slides.length > 0 && !busy && (
        <div className="mt-4 space-y-3">
          <div className="text-sm font-bold text-green-700">
            ✅ تم بناء العرض — {slides.length} شرائح
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(counts).map(([phase, n]) => (
              <span
                key={phase}
                className="rounded-full px-3 py-1 font-bold text-white"
                style={{ background: PHASE_LABELS[phase as Slide["phase"]]?.color ?? "#888" }}
              >
                {PHASE_LABELS[phase as Slide["phase"]]?.ar ?? phase} ×{n}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            اسحب الشرائح لإعادة الترتيب — أو استخدم الأسهم. يمكنك تعديل النقاط والسؤال.
          </p>

          <ul className="space-y-2">
            {slides.map((s, i) => (
              <li
                key={`${s.id}-${i}`}
                draggable
                onDragStart={() => (dragIdx.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx.current !== null) move(dragIdx.current, i);
                  dragIdx.current = null;
                }}
                className="rounded-lg border bg-card p-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: PHASE_LABELS[s.phase]?.color ?? "#888" }}
                  >
                    {PHASE_LABELS[s.phase]?.ar ?? s.phase}
                  </span>
                  <input
                    value={s.title}
                    onChange={(e) => patch(i, { title: e.target.value })}
                    className="min-w-0 flex-1 rounded border-none bg-transparent px-1 text-sm font-bold outline-none focus:bg-accent/40"
                  />
                  <button
                    onClick={() => move(i, i - 1)}
                    className="rounded p-1 hover:bg-accent"
                    aria-label="لأعلى"
                  >
                    <ChevronRight className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    onClick={() => move(i, i + 1)}
                    className="rounded p-1 hover:bg-accent"
                    aria-label="لأسفل"
                  >
                    <ChevronLeft className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    onClick={() => setPreview(preview === i ? null : i)}
                    className="rounded p-1 text-xs hover:bg-accent"
                  >
                    معاينة
                  </button>
                  <button
                    onClick={() => removeSlide(i)}
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {preview === i && (
                  <div className="mt-2 space-y-2">
                    <div className="h-72">
                      <SlideView slide={s} index={i} count={slides.length} topic={plan.topic} />
                    </div>
                    {s.type !== "cover" && (
                      <>
                        <textarea
                          value={(s.points ?? []).join("\n")}
                          onChange={(e) =>
                            patch(i, { points: e.target.value.split("\n") })
                          }
                          rows={3}
                          placeholder="نقطة في كل سطر"
                          className="w-full rounded border p-2 text-sm"
                        />
                        <input
                          value={s.question ?? ""}
                          onChange={(e) => patch(i, { question: e.target.value })}
                          placeholder="سؤال تفاعلي للطالب"
                          className="w-full rounded border p-2 text-sm"
                        />
                      </>
                    )}
                    {s.type === "homework" && (
                      <textarea
                        value={s.homework ?? ""}
                        onChange={(e) => patch(i, { homework: e.target.value })}
                        rows={3}
                        className="w-full rounded border p-2 text-sm"
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={addBlank}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> شريحة فارغة
            </button>
            <a
              href="/presentation"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              style={{ background: PURPLE }}
            >
              <Play className="h-4 w-4" /> ابدأ العرض
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
