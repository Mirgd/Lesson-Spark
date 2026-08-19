import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, FileCheck2, X, CheckCircle2, Play, Pencil } from "lucide-react";
import { extractText } from "@/lib/curriculum";
import { useUiLanguage } from "@/lib/ui-language";
import {
  extractPdfAsImages,
  setLastPdfFile,
  getCurrentFileId,
  pool,
  type PageImage,
} from "@/lib/pdf-images";
 import {
  generateCompleteLesson,
  readTextFromImages,
} from "@/lib/autoplan.functions";
import { clearFileArtifacts } from "@/lib/lesson-reset";

/*import { analyzePageForPhase } from "@/lib/vision.functions";*/
import {
  /*buildPresentation,*/
  clearPageImages,
  putPageImage,
  /*saveSlides,*/
  type AnalyzedPage,
} from "@/lib/presentation";
import { planLang, useCurriculum, type LessonPlan, type PhaseId } from "@/lib/lesson-types";
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
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  return (
    <div
      className="mb-3 rounded-xl bg-primary p-5"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gold">
          {done
            ? isArabic
              ? "✅ اكتملت الخطة"
              : "✅ Plan Complete"
            : isArabic
              ? "🔄 جارٍ المعالجة..."
              : "🔄 Processing..."}
        </span>

        <span className="text-[13px] text-white/60">
          {isArabic
            ? `${step} من ${total}`
            : `${step} of ${total}`}
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

      <p className="m-0 text-[13px] text-white/75">
        {message}
      </p>
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
  const { language } = useUiLanguage();
  const isArabic = language === "ar";
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
setProgress({
  step: 1,
  total: 4,
  message: isArabic
    ? "استخراج النص والصور من الملف..."
    : "Extracting text and images from the file...",
});    try {
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
  setProgress({
    step: 1,
    total: 4,
    message: isArabic
      ? `تحويل صفحات الكتاب إلى صور (${d}/${t})...`
      : `Converting book pages to images (${d}/${t})...`,
  }),
);
        fullText = await extractText(file);
        if (fullText.trim().length < 100) {
setProgress({
  step: 1,
  total: 4,
  message: isArabic
    ? "الملف مصوّر — جارٍ القراءة البصرية..."
    : "Scanned document — reading visually...",
});
          const r = await readTextFromImages({
            data: { images: pages.slice(0, 1).map((p) => p.base64) },
          });
          fullText = r.text;
        }
      } else {
        fullText = await extractText(file);
      }

if (!fullText.trim())
  throw new Error(
    isArabic
      ? "تعذّر قراءة الملف — تأكد أنه PDF أو DOCX سليم"
      : "Unable to read the file — make sure it is a valid PDF or DOCX file."
  );      set(fullText, file.name);

      /* ── 2) تحليل المقرر وبناء الخطة في طلب واحد ── */
setProgress({
  step: 2,
  total: 3,
  message: isArabic
    ? "تحليل المقرر وبناء خطة الدرس..."
    : "Analyzing the curriculum and building the lesson plan...",
});

const generated = await generateCompleteLesson({
  data: {
    text: fullText,
    firstPageImage: pages[0]?.base64,
    lang: planLang(plan),
  },
});

setPlan((p) => ({
  ...p,

  topic: generated.topic || p.topic,

  subject: generated.subject || p.subject,

  grade: generated.grade || p.grade,

  objectives:
    generated.objectives?.length
      ? generated.objectives.join("\n")
      : p.objectives,

  outcomes:
    generated.outcomes?.length
      ? generated.outcomes
      : p.outcomes,

  phases: p.phases.map((ph) => {
    const g = generated[ph.id];

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
    teacherNote:
      generated.homework?.teacher ||
      p.homework.teacherNote,
    studentText:
      generated.homework?.student ||
      p.homework.studentText,
  },
}));
const bankCount = 0;
            /* ── 4) العرض التقديمي ── */
      /*
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
      }*/
      
      let slideCount = 0;
      setSummary({
        outcomes: generated.outcomes ?? [],
        slides: slideCount,
      });
setProgress({
  step: 4,
  total: 4,
  message: isArabic
    ? "تم حفظ صفحات المقرر ✅"
    : "Curriculum pages saved successfully ✅",
  done: true,
});
toast.success(
  bankCount
    ? isArabic
      ? `تم استخراج خطة الدرس — و${bankCount} سؤالاً في بنك الأسئلة`
      : `Lesson plan extracted — ${bankCount} questions added to the question bank`
    : isArabic
      ? "تم استخراج خطة الدرس من المقرر"
      : "Lesson plan extracted from the curriculum"
);
} catch (e) {
  const msg = reportAiError(
    e,
    isArabic
      ? "الاستخراج التلقائي"
      : "Automatic Extraction",
    isArabic
      ? "تعذّر إكمال الاستخراج"
      : "Unable to complete the extraction"
  );

  toast.error(msg);
  setProgress(null);
}
  };

  const ReplaceDialog = () =>
    pendingFile ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
          <h3 className="text-lg font-bold text-primary">
  {isArabic ? "استبدال ملف الدرس؟" : "Replace Lesson File?"}
</h3>
          <p className="mt-2 text-sm text-muted-foreground">
  {isArabic
    ? `سيُمسح الملف الحالي (${name || "—"}) وكل ما بُني عليه: صور الكتاب، العرض التقديمي، ورقة العمل، بنك الأسئلة، وواجب الغائب — ثم يُبنى الدرس من الملف الجديد (${pendingFile.name}).`
    : `The current file (${name || "—"}) and everything built from it will be removed: book images, presentation, worksheet, question bank, and absent-student homework. The lesson will then be rebuilt from the new file (${pendingFile.name}).`}
</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setPendingFile(null)}
              className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {isArabic ? "إلغاء" : "Cancel"}
            </button>
            <button
              onClick={() => {
                const f = pendingFile;
                setPendingFile(null);
                void process(f);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
{isArabic
  ? "امسح وابدأ بالملف الجديد"
  : "Replace and Start with New File"}            </button>
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
{isArabic
  ? "✓ تم تحميل المقرر — الاقتراحات الآن مرتبطة بمحتواه"
  : "✓ Curriculum uploaded — suggestions are now based on its content"}            </div>
            <div className="truncate text-xs text-muted-foreground">{name}</div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border px-3 py-2 text-xs font-bold text-primary hover:bg-accent"
          >
{isArabic ? "استبدال الملف" : "Replace File"}          </button>
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
toast.success(
  isArabic
    ? "تم حذف الملف وكل ما بُني عليه"
    : "The file and everything built from it were deleted"
);            }}
            className="rounded-md border p-2 text-muted-foreground hover:bg-accent"
            aria-label={isArabic ? "حذف المقرر" : "Delete Curriculum"}
          >
            <X className="h-4 w-4" />

          </button>
        </div>

        {summary && (
          <div className="card-elevated border border-gold/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
{isArabic
  ? "تم استخراج خطة الدرس من المقرر"
  : "Lesson plan extracted from the curriculum"}            </div>
            <dl className="space-y-1 text-xs text-muted-foreground">
              <div>
              {isArabic ? "موضوع الدرس:" : "Lesson Topic:"} <span className="font-bold text-foreground">{plan.topic || "—"}</span>
              </div>
              <div>
               {isArabic ? "المادة:" : "Subject:"}<span className="font-bold text-foreground">{plan.subject || "—"}</span> ·
               {isArabic ? "الصف:" : "Grade:"}<span className="font-bold text-foreground">{plan.grade || "—"}</span>
              </div>
              <div>
               {isArabic ? "نواتج التعلم:" : "Learning Outcomes:"}{" "}
                <span className="font-bold text-foreground">{summary.outcomes.length}</span> · خطة
                {isArabic ? "خطة 5E:" : "5E Plan:"} <span className="font-bold text-green-700">{isArabic ? "مكتملة" : "Complete"}</span> {isArabic ? "العرض:" : "Presentation:"}{" "}
                <span className="font-bold text-foreground">{summary.slides} {isArabic ? "شرائح" : "slides"}</span>
              </div>
            </dl>
            <p className="mt-3 rounded-md bg-gold/10 p-2 text-xs text-foreground">
              {isArabic
  ? "💡 راجع الخطة وعدّل ما يلزم — كل الحقول قابلة للتعديل اليدوي."
  : "💡 Review the plan and edit as needed — all fields can be edited manually."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSummary(null)}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" /> {isArabic ? "عدّل الخطة" : "Edit Plan"}
              </button>
              <a
                href="/execute"
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                <Play className="h-3.5 w-3.5" /> {isArabic ? "ابدأ التنفيذ" : "Start Lesson"}
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
        {isArabic
  ? "📚 ارفع المقرر — تُبنى الخطة كاملة تلقائياً"
  : "📚 Upload Curriculum — Build the Full Plan Automatically"}
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
{busy
  ? isArabic
    ? "جارٍ بناء الخطة..."
    : "Building the lesson plan..."
  : isArabic
    ? "اسحب ملف PDF أو DOCX هنا"
    : "Drag a PDF or DOCX file here"}        </div>
        <div className="text-xs text-muted-foreground">
{busy
  ? isArabic
    ? "لا تغلق الصفحة"
    : "Please keep this page open"
  : isArabic
    ? "أو اضغط لاختيار من جهازك"
    : "or click to choose a file from your device"}        </div>
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
  {isArabic ? (
    <>
      بمجرد الرفع: يُستخرج عنوان الدرس والمادة والصف ونواتج التعلم،
      وتُبنى خطة 5E والعرض التقديمي من صور الكتاب — بدون أي ضغطة
      أزرار إضافية. حمّل كتابك من{" "}
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
    </>
  ) : (
    <>
      Once uploaded, the lesson topic, subject, grade, and learning
      outcomes are extracted automatically, and the 5E lesson plan is
      built from the curriculum content. You can download your textbook
      from{" "}
      <a
        href="https://q.tahdiri.com"
        target="_blank"
        rel="noreferrer"
        className="text-primary underline"
      >
        q.tahdiri.com
      </a>{" "}
      or{" "}
      <a
        href="https://ien.edu.sa"
        target="_blank"
        rel="noreferrer"
        className="text-primary underline"
      >
        ien.edu.sa
      </a>
    </>
  )}
</p>
    </div>
  );
}
