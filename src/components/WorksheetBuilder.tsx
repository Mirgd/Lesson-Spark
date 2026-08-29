import { useUiLanguage } from "@/lib/ui-language";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Printer, UserX } from "lucide-react";
import { PHASE_LABELS, usePresentation } from "@/lib/presentation";
import { useWorksheet } from "@/lib/worksheet";
import { generateWorksheet } from "@/lib/worksheet.functions";
import { selectedQuestions, useQuestionBank } from "@/lib/question-bank";
import { planLang, type LessonPlan } from "@/lib/lesson-types";
import { reportAiError } from "@/lib/ai-error";
import { SharedFileBadge } from "@/components/SharedFileBadge";
import { useSharedFile } from "@/lib/pdf-images";

const TEAL = "#1E7CA8";

export function WorksheetBuilder({ plan }: { plan: LessonPlan }) {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [slides] = usePresentation();
  const [items, setItems] = useWorksheet();
  const [busy, setBusy] = useState(false);
  const { addMany, markUsed } = useQuestionBank();
  const { name: sharedName } = useSharedFile();

  const phaseName = (phase: keyof typeof PHASE_LABELS) => {
    if (isArabic) {
      return PHASE_LABELS[phase]?.ar ?? phase;
    }

    const names: Record<string, string> = {
      engage: "Engage",
      explore: "Explore",
      explain: "Explain",
      elaborate: "Elaborate",
      evaluate: "Evaluate",
      homework: "Homework",
    };

    return names[phase] ?? phase;
  };

  const run = async () => {
    if (slides.length === 0) {
      toast.error(
        isArabic
          ? "أنشئ العرض أولاً — ورقة العمل مرتبطة بالشرائح."
          : "Create the presentation first — the worksheet is linked to the slides.",
      );
      return;
    }

    setBusy(true);

    try {
      const reuseSource = selectedQuestions();

      const res = await generateWorksheet({
        data: {
          subject: plan.subject,
          grade: plan.grade,
          topic: plan.topic,
          lang: planLang(plan),

          slides: slides
            .filter((s) => s.type !== "cover")
            .map((s) => ({
              slideIndex: slides.indexOf(s),
              title: s.title,
              phase: s.phase,
              points: s.points ?? [],
              question: s.question ?? "",
            })),

          reuse: reuseSource.map((q) => ({
            phase: String(q.phase),
            text: q.text,
            answer: q.answer,
          })),
        },
      });

      setItems(res.items);

      markUsed(reuseSource.map((q) => q.id));

      // حفظ الأسئلة الناتجة في بنك الأسئلة للاستخدام لاحقاً
      const added = addMany(
        res.items.flatMap((it) =>
          it.questions.filter(Boolean).map((q, qi) => ({
            phase: it.phase,
            subject: plan.subject,
            topic: plan.topic,
            text: q,
            answer: it.answers?.[qi] ?? "",
          })),
        ),
      );

      toast.success(
        isArabic
          ? `تم توليد ورقة العمل — ${res.items.length} أنشطة${
              added ? ` · أُضيف ${added} سؤالاً للبنك` : ""
            }`
          : `Worksheet generated — ${res.items.length} activities${
              added ? ` · ${added} questions added to the question bank` : ""
            }`,
      );
    } catch (e) {
      toast.error(
        reportAiError(
          e,
          isArabic ? "توليد ورقة العمل" : "Worksheet Generator",
          isArabic ? "فشل توليد ورقة العمل" : "Failed to generate the worksheet",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const patch = (i: number, p: Partial<(typeof items)[number]>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  return (
    <div className="card-elevated p-4">
      <SharedFileBadge name={sharedName} />

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: TEAL }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}

        {busy
          ? isArabic
            ? "جارٍ توليد ورقة العمل..."
            : "Generating worksheet..."
          : isArabic
            ? "📝 ولّد ورقة عمل الطالب من الشرائح"
            : "📝 Generate Student Worksheet from Slides"}
      </button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        {isArabic
          ? "أسئلة قصيرة وتحقق ذاتي لكل شريحة — تظهر تلقائياً في شاشة التنفيذ."
          : "Short questions and self-checks for each slide — automatically shown during lesson execution."}
      </p>

      {items.length > 0 && !busy && (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-bold text-green-700">
            {isArabic
              ? `✅ ورقة العمل جاهزة — ${items.length} أنشطة مرتبطة بالشرائح`
              : `✅ Worksheet ready — ${items.length} activities linked to the slides`}
          </div>

          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={`${it.slideIndex}-${i}`} className="rounded-lg border bg-card p-2">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{
                      background:
                        PHASE_LABELS[it.phase as keyof typeof PHASE_LABELS]?.color ?? "#888",
                    }}
                  >
                    {phaseName(it.phase as keyof typeof PHASE_LABELS)}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{it.slideTitle}</span>

                  <span className="text-[11px] text-muted-foreground">
                    {isArabic ? `شريحة ${it.slideIndex + 1}` : `Slide ${it.slideIndex + 1}`}
                  </span>
                </div>

                <textarea
                  value={it.questions.join("\n")}
                  onChange={(e) =>
                    patch(i, {
                      questions: e.target.value.split("\n"),
                    })
                  }
                  rows={2}
                  placeholder={isArabic ? "سؤال في كل سطر" : "One question per line"}
                  className="w-full rounded border p-2 text-sm"
                />

                <textarea
                  value={(it.answers ?? []).join("\n")}
                  onChange={(e) =>
                    patch(i, {
                      answers: e.target.value.split("\n"),
                    })
                  }
                  rows={2}
                  placeholder={
                    isArabic
                      ? "الإجابة النموذجية لكل سؤال (بنفس الترتيب)"
                      : "Model answer for each question (in the same order)"
                  }
                  className="mt-1 w-full rounded border p-2 text-sm"
                  style={{
                    background: "#16794A0F",
                  }}
                />

                <input
                  value={it.selfCheck}
                  onChange={(e) =>
                    patch(i, {
                      selfCheck: e.target.value,
                    })
                  }
                  placeholder={isArabic ? "أستطيع أن..." : "I can..."}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <a
              href="/worksheet"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              style={{ background: TEAL }}
            >
              <Printer className="h-4 w-4" />

              {isArabic ? "اطبع ورقة الطالب" : "Print Student Worksheet"}
            </a>

            <a
              href="/absent"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              style={{ background: "#1B2A4A" }}
            >
              <UserX className="h-4 w-4" />

              {isArabic ? "نسخة الطالب الغائب (شاملة)" : "Absent Student Version"}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
