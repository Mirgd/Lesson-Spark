import { useState } from "react";
import { useUiLanguage } from "@/lib/ui-language";
import { toast } from "sonner";
import { Sparkles, Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { extractOutcomes } from "@/lib/outcomes.functions";
import { useCurriculum } from "@/lib/lesson-types";
import { reportAiError } from "@/lib/ai-error";
import type { ContentLanguage } from "@/lib/lang";
import { SharedFileBadge } from "@/components/SharedFileBadge";

export function OutcomesExtractor({
  subject,
  grade,
  topic,
  curriculum,
  lang,
  existingOutcomes,
  onApply,
}: {
  subject: string;
  grade: string;
  topic: string;
  curriculum: string;
  lang: ContentLanguage;
  existingOutcomes?: string[];
  onApply: (outcomes: string[]) => void;
}) {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const run = useServerFn(extractOutcomes);
  const { name: fileName } = useCurriculum();

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [source, setSource] = useState("");

  const missingCurriculum = !curriculum.trim();
  const missingTopic = !topic.trim();
  const blocked = missingCurriculum || missingTopic;

  const start = async () => {
    setLoading(true);

    try {
      // إذا كانت النواتج موجودة بالفعل، لا نرسل Gemini request جديدًا
      if (existingOutcomes?.length) {
        setOutcomes(existingOutcomes);

        setSelected(Object.fromEntries(existingOutcomes.map((_, index) => [index, true])));

        setSource(
          isArabic ? "تم استخراجها مسبقًا من المقرر" : "Previously extracted from the curriculum",
        );

        setOpen(true);

        toast.success(
          isArabic
            ? "تم تحميل نواتج التعلم المستخرجة مسبقًا"
            : "Previously extracted learning outcomes loaded",
        );

        return;
      }

      const result = await run({
        data: {
          curriculum,
          topic,
          subject,
          grade,
          lang,
        },
      });

      setOutcomes(result.outcomes);

      setSelected(Object.fromEntries(result.outcomes.map((_, i) => [i, true])));

      setSource(result.source ?? "");
      setOpen(true);
    } catch (e) {
      toast.error(
        reportAiError(
          e,
          isArabic ? "استخراج نواتج التعلم" : "Learning Outcomes Extraction",
          isArabic ? "تعذّر استخراج نواتج التعلم" : "Unable to extract learning outcomes",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    const picked = outcomes.filter((_, i) => selected[i]);

    if (!picked.length) {
      toast.warning(
        isArabic ? "حدّد ناتجاً واحداً على الأقل" : "Select at least one learning outcome",
      );

      return;
    }

    onApply(picked);
    setOpen(false);

    toast.success(
      isArabic ? "تمت إضافة نواتج التعلم للخطة" : "Learning outcomes added to the lesson plan",
    );
  };

  return (
    <>
      {!missingCurriculum && <SharedFileBadge name={fileName} />}

      <button
        type="button"
        onClick={start}
        disabled={loading || blocked}
        title={
          missingCurriculum
            ? isArabic
              ? "ارفع ملف المقرر أولاً"
              : "Upload the curriculum file first"
            : missingTopic
              ? isArabic
                ? "اكتب عنوان الدرس أولاً"
                : "Enter the lesson topic first"
              : undefined
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}

        {loading
          ? isArabic
            ? "جارٍ استخراج النواتج..."
            : "Extracting learning outcomes..."
          : isArabic
            ? "✨ استخرج نواتج التعلم من المقرر"
            : "✨ Extract Learning Outcomes from Curriculum"}
      </button>

      {blocked && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {missingCurriculum
            ? isArabic
              ? "ارفع ملف الدرس مرة واحدة من قسم «تحميل ملف الدرس» أعلاه"
              : "Upload the lesson file once from the upload section above"
            : isArabic
              ? "اكتب عنوان الدرس لتفعيل الاستخراج"
              : "Enter the lesson topic to enable extraction"}
        </p>
      )}

      {open && (
        <div
          dir={isArabic ? "rtl" : "ltr"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <h2 className="text-base font-black text-primary">
                  {isArabic
                    ? "✨ نواتج التعلم المستخرجة من المقرر"
                    : "✨ Learning Outcomes Extracted from Curriculum"}
                </h2>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isArabic ? "المادة:" : "Subject:"} {subject || "—"} ·{" "}
                  {isArabic ? "الصف:" : "Grade:"} {grade || "—"}
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                aria-label={isArabic ? "إغلاق" : "Close"}
                className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="mb-3 text-sm font-bold">
                {isArabic ? "ماذا سأتعلم في هذا الدرس؟" : "What Will I Learn in This Lesson?"}
              </div>

              <ul className="space-y-2">
                {outcomes.map((o, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((s) => ({
                          ...s,
                          [i]: !s[i],
                        }))
                      }
                      className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-start text-sm transition-colors ${
                        selected[i]
                          ? "border-gold/50 bg-gold/10 font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      <span className={selected[i] ? "text-gold" : "text-muted-foreground"}>
                        {selected[i] ? "☑" : "○"}
                      </span>

                      <span className="flex-1">{o}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {source && (
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <div className="mb-1 text-xs font-bold text-muted-foreground">
                    {isArabic ? "📌 المصدر من المقرر:" : "📌 Source from Curriculum:"}
                  </div>

                  <p className="text-xs italic leading-relaxed text-muted-foreground">“{source}”</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t p-4">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
              >
                {isArabic ? "إلغاء" : "Cancel"}
              </button>

              <button
                onClick={apply}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                {isArabic ? "أضف المحدد لخطة الدرس ✓" : "Add Selected to Lesson Plan ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
