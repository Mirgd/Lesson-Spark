import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, FileCheck2, X, CheckCircle2, Play, Pencil } from "lucide-react";
import { extractText } from "@/lib/curriculum";
import {
  extractPdfAsImages,
  setLastPdfFile,
  getCurrentFileId,
  pool,
  type PageImage,
} from "@/lib/pdf-images";
import { clearFileArtifacts } from "@/lib/lesson-reset";

import {
  extractLessonInfo,
  generateFullPlan,
  readTextFromImages,
  type LessonInfo,
} from "@/lib/autoplan.functions";
import { analyzePageForPhase } from "@/lib/vision.functions";
import {
  buildPresentation,
  clearPageImages,
  putPageImage,
  saveSlides,
  type AnalyzedPage,
} from "@/lib/presentation";
import { planLang, useCurriculum, type LessonPlan, type PhaseId } from "@/lib/lesson-types";
import { generatePhaseQuestions } from "@/lib/questions.functions";
import { addQuestionsToBank } from "@/lib/question-bank";
import { reportAiError } from "@/lib/ai-error";

interface Progress {
  step: number;
  total: number;
  message: string;
  done?: boolean;
}

const DURATIONS: Record<PhaseId, number> = {
  engage: 10,
  explore: 16,
  explain: 13,
  elaborate: 11,
  evaluate: 5,
};

function ProgressBar({ step, total, message, done }: Progress) {
  return (
    <div className="mb-3 rounded-xl bg-primary p-5" dir="rtl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gold">
          {done ? "✅ اكتملت الخطة" : "🔄 جارٍ المعالجة..."}
        </span>
        <span className="text-[13px] text-white/60">
          {step} من {total}
        </span>
      </div>
      <div className="mb-2 h-1.5 rounded bg-white/20">
        <div
          className="h-full rounded transition-[width] duration-500"
          style={{
            width: `${(step / total) * 100}%`,
            background: done ? "#1A5C2A" : "#B8860B",
          }}
        />
      </div>
      <p className="m-0 text-[13px] text-white/75">{message}</p>
    </div>
  );
}

export function CurriculumAutoUpload({
  plan,
  setPlan,
}: {
  plan: LessonPlan;
  setPlan: (fn: (p: LessonPlan) => LessonPlan) => void;
}) {
  const { text, name, set, clear } = useCurriculum();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<{ outcomes: string[]; slides: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = Boolean(progress) && !progress?.done;

  /** يمسح كل آثار الملف السابق ثم ينظّف الواجهة. */
  const wipe = async () => {
    await clearFileArtifacts();
    clear();
    setProgress(null);
    setSummary(null);
  };

  /** رفع ملف جديد: يطلب التأكيد إن كان هناك ملف قائم. */
  const requestProcess = (file: File) => {
    if (text || name) setPendingFile(file);
    else void process(file);
  };

  const process = async (file: File) => {
    setSummary(null);
    setProgress({ step: 1, total: 4, message: "استخراج النص والصور من الملف..." });
    try {
      /* ── 0) مسح كل آثار أي ملف سابق قبل البدء ── */
      await clearFileArtifacts();

      /* ── 1) نص + صور ── */
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      let fullText = "";
      let pages: PageImage[] = [];

      setLastPdfFile(file);
      const fileId = getCurrentFileId();
      if (isPdf) {


        pages = await extractPdfAsImages(file, 15, (d, t) =>
          setProgress({ step: 1, total: 4, message: `تحويل صفحات الكتاب إلى صور (${d}/${t})...` }),
        );
        fullText = await extractText(file);
        if (fullText.trim().length < 100) {
          setProgress({ step: 1, total: 4, message: "الملف مصوّر — جارٍ القراءة البصرية..." });
          const r = await readTextFromImages({
            data: { images: pages.slice(0, 3).map((p) => p.base64) },
          });
          fullText = r.text;
        }
      } else {
        fullText = await extractText(file);
      }

      if (!fullText.trim()) throw new Error("تعذّر قراءة الملف — تأكد أنه PDF أو DOCX سليم");
      set(fullText, file.name);

      /* ── 2) معلومات الدرس ── */
      setProgress({ step: 2, total: 4, message: "استخراج عنوان الدرس ونواتج التعلم..." });
      const info = (await extractLessonInfo({
        data: { text: fullText, firstPageImage: pages[0]?.base64, lang: planLang(plan) },
      })) as LessonInfo;

      setPlan((p) => ({
        ...p,
        topic: info?.topic || p.topic,
        subject: info?.subject || p.subject,
        grade: info?.grade || p.grade,
        objectives: info?.objectives?.length ? info.objectives.join("\n") : p.objectives,
        outcomes: info?.outcomes?.length ? info.outcomes : p.outcomes,
      }));

      /* ── 3) خطة 5E ── */
      setProgress({ step: 3, total: 4, message: "توزيع الأنشطة على مراحل 5E..." });
      const generated = await generateFullPlan({
        data: {
          text: fullText,
          topic: info.topic,
          subject: info.subject,
          grade: info.grade,
          mainConcepts: info.mainConcepts,
          priorKnowledge: info.priorKnowledge,
          realWorldContext: info.realWorldContext,
          lang: planLang(plan),
        },
      });

      setPlan((p) => ({
        ...p,
        phases: p.phases.map((ph) => {
          const g = generated?.[ph.id];
          if (!g) return ph;
          return {
            ...ph,
            duration: DURATIONS[ph.id] ?? ph.duration,
            teacherActivity: g.teacher || ph.teacherActivity,
            studentActivity: g.student || ph.studentActivity,
          };
        }),
        homework: {
          ...p.homework,
          teacherNote: generated?.homework?.teacher || p.homework.teacherNote,
          studentText: generated?.homework?.student || p.homework.studentText,
        },
      }));

      /* ── 3ب) بنك الأسئلة وفق تصنيف بلوم ── */
      let bankCount = 0;
      try {
        setProgress({ step: 3, total: 4, message: "توليد أسئلة بنك الأسئلة وفق تصنيف بلوم..." });
        const qs = await generatePhaseQuestions({
          data: {
            text: fullText,
            topic: info.topic || plan.topic,
            subject: info.subject || plan.subject,
            grade: info.grade || plan.grade,
            lang: planLang(plan),
          },
        });
        bankCount = addQuestionsToBank(
          Object.entries(qs).flatMap(([phase, list]) =>
            list.map((q) => ({
              phase,
              subject: info.subject || plan.subject,
              topic: info.topic || plan.topic,
              text: q.level ? `${q.text} (${q.level})` : q.text,
              answer: q.answer,
            })),
          ),
        );
      } catch (e) {
        console.error(e);
      }

      /* ── 4) العرض التقديمي ── */
      let slideCount = 0;
      if (pages.length) {
        setProgress({ step: 4, total: 4, message: "ترتيب صور الكتاب وفق مراحل 5E..." });
        await clearPageImages();
        for (const p of pages) await putPageImage(p.page, p.dataUrl, fileId);
        // إن بدأ المعلم رفع ملف آخر أثناء المعالجة، أوقف هذا المسار كي لا تختلط الدروس.
        if (getCurrentFileId() !== fileId) return;


        let analyzedCount = 0;
        const analyzed = await pool(pages, 3, async (p) => {
          const r = (await analyzePageForPhase({
            data: {
              imageBase64: p.base64,
              pageNumber: p.page,
              topic: info.topic,
              subject: info.subject,
              lang: planLang(plan),
            },
          })) as AnalyzedPage;
          analyzedCount++;
          setProgress({
            step: 4,
            total: 4,
            message: `تحليل الصفحة ${analyzedCount} من ${pages.length}...`,
          });
          return r;
        });

        if (getCurrentFileId() !== fileId) return;
        const slides = buildPresentation(analyzed, {
          topic: info.topic || plan.topic,
          subject: info.subject || plan.subject,
          grade: info.grade || plan.grade,
          outcomes: info.outcomes,
          homework: { studentText: generated.homework.student },
        });
        saveSlides(slides);

        slideCount = slides.length;
      }

      setSummary({ outcomes: info.outcomes, slides: slideCount });
      setProgress({ step: 4, total: 4, message: "اكتملت الخطة ✅", done: true });
      toast.success(
        bankCount
          ? `تم استخراج خطة الدرس — و${bankCount} سؤالاً في بنك الأسئلة`
          : "تم استخراج خطة الدرس من المقرر",
      );
    } catch (e) {
      const msg = reportAiError(e, "الاستخراج التلقائي", "تعذّر إكمال الاستخراج");
      toast.error(msg);
      setProgress(null);
    }
  };

  const ReplaceDialog = () =>
    pendingFile ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
        <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
          <h3 className="text-lg font-bold text-primary">استبدال ملف الدرس؟</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            سيُمسح الملف الحالي ({name || "—"}) وكل ما بُني عليه: صور الكتاب، العرض التقديمي، ورقة
            العمل، بنك الأسئلة، وواجب الغائب — ثم يُبنى الدرس من الملف الجديد ({pendingFile.name}).
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setPendingFile(null)}
              className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              إلغاء
            </button>
            <button
              onClick={() => {
                const f = pendingFile;
                setPendingFile(null);
                void process(f);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              امسح وابدأ بالملف الجديد
            </button>
          </div>
        </div>
      </div>
    ) : null;

  /* ---------- حالة: تم الرفع ---------- */
  if (text && !busy) {
    return (
      <div className="space-y-3">
        <ReplaceDialog />
        {progress?.done && <ProgressBar {...progress} />}

        <div className="card-elevated flex items-center gap-3 border border-green-600/30 bg-green-50/40 p-4 dark:bg-green-950/20">
          <FileCheck2 className="h-6 w-6 shrink-0 text-green-700" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-green-800 dark:text-green-300">
              ✓ تم تحميل المقرر — الاقتراحات الآن مرتبطة بمحتواه
            </div>
            <div className="truncate text-xs text-muted-foreground">{name}</div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border px-3 py-2 text-xs font-bold text-primary hover:bg-accent"
          >
            استبدال الملف
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) requestProcess(f);
            }}
          />
          <button
            onClick={() => {
              void wipe();
              toast.success("تم حذف الملف وكل ما بُني عليه");
            }}
            className="rounded-md border p-2 text-muted-foreground hover:bg-accent"
            aria-label="حذف المقرر"
          >
            <X className="h-4 w-4" />

          </button>
        </div>

        {summary && (
          <div className="card-elevated border border-gold/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              تم استخراج خطة الدرس من المقرر
            </div>
            <dl className="space-y-1 text-xs text-muted-foreground">
              <div>
                موضوع الدرس: <span className="font-bold text-foreground">{plan.topic || "—"}</span>
              </div>
              <div>
                المادة: <span className="font-bold text-foreground">{plan.subject || "—"}</span> ·
                الصف: <span className="font-bold text-foreground">{plan.grade || "—"}</span>
              </div>
              <div>
                نواتج التعلم:{" "}
                <span className="font-bold text-foreground">{summary.outcomes.length}</span> · خطة
                5E: <span className="font-bold text-green-700">مكتملة</span> · العرض:{" "}
                <span className="font-bold text-foreground">{summary.slides} شرائح</span>
              </div>
            </dl>
            <p className="mt-3 rounded-md bg-gold/10 p-2 text-xs text-foreground">
              💡 راجع الخطة وعدّل ما يلزم — كل الحقول قابلة للتعديل اليدوي.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSummary(null)}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" /> عدّل الخطة
              </button>
              <a
                href="/execute"
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                <Play className="h-3.5 w-3.5" /> ابدأ التنفيذ
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- حالة: الرفع / المعالجة ---------- */
  return (
    <div className="card-elevated p-4">
      <ReplaceDialog />
      {progress && <ProgressBar {...progress} />}
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
        📚 ارفع المقرر — تُبنى الخطة كاملة تلقائياً
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) requestProcess(f);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors disabled:opacity-60 ${
          dragOver ? "border-gold bg-gold/5" : "border-muted-foreground/30 hover:bg-accent/40"
        }`}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        ) : (
          <Upload className="h-6 w-6 text-gold" />
        )}
        <div className="text-sm font-medium">
          {busy ? "جارٍ بناء الخطة..." : "اسحب ملف PDF أو DOCX هنا"}
        </div>
        <div className="text-xs text-muted-foreground">
          {busy ? "لا تغلق الصفحة" : "أو اضغط لاختيار من جهازك"}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) requestProcess(f);
        }}
      />

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        بمجرد الرفع: يُستخرج عنوان الدرس والمادة والصف ونواتج التعلم، وتُبنى خطة 5E والعرض
        التقديمي من صور الكتاب — بدون أي ضغطة أزرار إضافية. حمّل كتابك من{" "}
        <a
          href="https://q.tahdiri.com"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          q.tahdiri.com
        </a>{" "}
        أو{" "}
        <a
          href="https://ien.edu.sa"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          ien.edu.sa
        </a>
      </p>
    </div>
  );
}
