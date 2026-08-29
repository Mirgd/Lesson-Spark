import { useUiLanguage } from "@/lib/ui-language";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save, Printer } from "lucide-react";
import { PHASES, useCurrentPlan, useSavedLessons } from "@/lib/lesson-types";
import { NewLessonButton } from "@/components/NewLessonButton";

export const Route = createFileRoute("/reflection")({
  head: () => ({
    meta: [
      { title: "التأمل — المدرسة الرمز · التعلم العميق" },
      { name: "description", content: "تأمل ما بعد الحصة لتحسين الدرس القادم." },
    ],
  }),
  component: Reflection,
});

function Reflection() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [plan, setPlan] = useCurrentPlan();
  const [, setLessons] = useSavedLessons();

  const reflection = plan.reflection ?? {
    wentWell: "",
    toImprove: "",
    needsSupport: "",
    slowPhase: undefined,
  };

  const update = (patch: Partial<typeof reflection>) =>
    setPlan((p) => ({
      ...p,
      reflection: {
        ...reflection,
        ...patch,
      },
    }));

  const save = () => {
    setLessons((prev) => {
      const filtered = prev.filter((l) => l.id !== plan.id);

      return [
        {
          ...plan,
          createdAt: new Date().toISOString(),
        },
        ...filtered,
      ];
    });

    toast.success(isArabic ? "تم حفظ التأمل مع الدرس" : "Reflection saved with the lesson");
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="card-elevated overflow-hidden print-page">
        <header
          className="p-6 text-white"
          style={{
            background: "linear-gradient(135deg, var(--primary), #2a3d6b)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-primary">
              ✓
            </span>

            <div>
              <h1 className="text-xl font-black">
                {isArabic ? "انتهت الحصة" : "Lesson Completed"}
              </h1>

              <p className="text-xs opacity-80">
                {new Date().toLocaleString(isArabic ? "ar" : "en", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm opacity-90">
            {plan.subject || "—"} · {plan.grade || "—"} ·{" "}
            {plan.topic || (isArabic ? "بدون موضوع" : "No Topic")}
          </p>

          <p className="mt-4 text-sm italic opacity-80">
            {isArabic
              ? "كل درس يُعلّمك شيئاً — ما الأهم اليوم؟"
              : "Every lesson teaches you something — what mattered most today?"}
          </p>
        </header>

        <div className="space-y-5 p-6">
          <Field
            label={
              isArabic ? "ما الذي نجح وأريد الإبقاء عليه؟" : "What worked well and should I keep?"
            }
          >
            <textarea
              className={inputCls}
              value={reflection.wentWell}
              onChange={(e) =>
                update({
                  wentWell: e.target.value,
                })
              }
              placeholder={
                isArabic
                  ? "لحظة، سؤال، نشاط أعطى شرارة..."
                  : "A moment, question, or activity that worked especially well..."
              }
            />
          </Field>

          <Field
            label={
              isArabic
                ? "ما الذي سأعدّله في الحصة القادمة؟"
                : "What will I adjust in the next lesson?"
            }
          >
            <textarea
              className={inputCls}
              value={reflection.toImprove}
              onChange={(e) =>
                update({
                  toImprove: e.target.value,
                })
              }
              placeholder={
                isArabic ? "التوقيت، الأدوات، ترتيب المراحل..." : "Timing, tools, phase order..."
              }
            />
          </Field>

          <Field
            label={
              isArabic ? "أي طالب يحتاج دعماً إضافياً؟" : "Which student needs additional support?"
            }
          >
            <textarea
              className={inputCls}
              value={reflection.needsSupport}
              onChange={(e) =>
                update({
                  needsSupport: e.target.value,
                })
              }
              placeholder={isArabic ? "أسماء أو ملاحظات..." : "Names or notes..."}
            />
          </Field>

          <Field
            label={
              isArabic
                ? "أي مرحلة استغرقت وقتاً أكثر من المخطط؟"
                : "Which phase took longer than planned?"
            }
          >
            <select
              className={inputCls}
              value={reflection.slowPhase ?? ""}
              onChange={(e) =>
                update({
                  slowPhase: e.target.value || undefined,
                })
              }
            >
              <option value="">{isArabic ? "— اختر مرحلة —" : "— Select Phase —"}</option>

              {PHASES.map((m) => (
                <option key={m.id} value={m.id}>
                  {isArabic ? m.nameAr : m.nameEn}
                </option>
              ))}
            </select>
          </Field>

          <div
            className="rounded-lg border p-4"
            style={{
              borderInlineStartWidth: 4,
              borderInlineStartColor: "#888",
            }}
          >
            <div className="mb-1 text-sm font-bold text-primary">
              📋 {isArabic ? "الواجب المنزلي المخطط" : "Planned Homework"}
            </div>

            {plan.homework.studentText.trim() || plan.homework.teacherNote.trim() ? (
              <div className="space-y-2 text-sm">
                {plan.homework.teacherNote.trim() && (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold text-primary">
                      {isArabic ? "للمعلم: " : "Teacher: "}
                    </span>

                    {plan.homework.teacherNote}
                  </p>
                )}

                {plan.homework.studentText.trim() && (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold text-primary">
                      {isArabic ? "للطالب: " : "Student: "}
                    </span>

                    {plan.homework.studentText}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gold">
                {isArabic
                  ? "لم تُحدد واجباً — ننصح بإضافته قبل الحصة القادمة."
                  : "No homework has been set — consider adding one before the next lesson."}
              </p>
            )}
          </div>
        </div>

        <div className="no-print flex flex-wrap justify-end gap-2 border-t bg-muted/30 p-4">
          <button onClick={save} className={btnGhost}>
            <Save className="h-4 w-4" />

            {isArabic ? "حفظ التأمل" : "Save Reflection"}
          </button>

          <button onClick={() => window.print()} className={btnGhost}>
            <Printer className="h-4 w-4" />

            {isArabic ? "طباعة التقرير" : "Print Report"}
          </button>

          <NewLessonButton
            variant="primary"
            label={isArabic ? "خطط درساً جديداً" : "Plan a New Lesson"}
          />
        </div>
      </div>

      <div className="no-print mt-4 text-center text-sm">
        <Link to="/lessons" className="text-primary underline">
          {isArabic ? "عرض الدروس المحفوظة" : "View Saved Lessons"}
        </Link>
      </div>
    </main>
  );
}

const inputCls =
  "w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
