import { useState } from "react";
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
  onApply,
}: {
  subject: string;
  grade: string;
  topic: string;
  curriculum: string;
  lang: ContentLanguage;
  onApply: (outcomes: string[]) => void;
}) {
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
      const result = await run({ data: { curriculum, topic, subject, grade, lang } });
      if (!result.outcomes.length) {
        toast.info(
          "لم أجد نواتج محددة لهذا الموضوع في النص المرفوع — جرّب تحديد عنوان الدرس كما هو مكتوب في الكتاب بالضبط",
        );
        return;
      }
      setOutcomes(result.outcomes);
      setSelected(Object.fromEntries(result.outcomes.map((_, i) => [i, true])));
      setSource(result.source ?? "");
      setOpen(true);
    } catch (e) {
      toast.error(reportAiError(e, "استخراج نواتج التعلم", "تعذّر استخراج نواتج التعلم"));
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    const picked = outcomes.filter((_, i) => selected[i]);
    if (!picked.length) {
      toast.warning("حدّد ناتجاً واحداً على الأقل");
      return;
    }
    onApply(picked);
    setOpen(false);
    toast.success("تمت إضافة نواتج التعلم للخطة");
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
            ? "ارفع ملف المقرر أولاً"
            : missingTopic
              ? "اكتب عنوان الدرس أولاً"
              : undefined
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "جارٍ استخراج النواتج..." : "✨ استخرج نواتج التعلم من المقرر"}
      </button>
      {blocked && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {missingCurriculum
            ? "ارفع ملف الدرس مرة واحدة من قسم «تحميل ملف الدرس» أعلاه"
            : "اكتب عنوان الدرس لتفعيل الاستخراج"}
        </p>
      )}


      {open && (

        <div
          dir="rtl"
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
                  ✨ نواتج التعلم المستخرجة من المقرر
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  المادة: {subject || "—"} · الصف: {grade || "—"}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="mb-3 text-sm font-bold">ماذا سأتعلم في هذا الدرس؟</div>
              <ul className="space-y-2">
                {outcomes.map((o, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSelected((s) => ({ ...s, [i]: !s[i] }))}
                      className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-right text-sm transition-colors ${
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
                    📌 المصدر من المقرر:
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
                إلغاء
              </button>
              <button
                onClick={apply}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                أضف المحدد لخطة الدرس ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
