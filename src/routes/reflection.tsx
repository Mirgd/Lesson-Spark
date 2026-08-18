import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save, Printer } from "lucide-react";
import {
  PHASES,
  useCurrentPlan,
  useSavedLessons,
} from "@/lib/lesson-types";
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
  const [plan, setPlan] = useCurrentPlan();
  const [, setLessons] = useSavedLessons();
  const reflection = plan.reflection ?? {
    wentWell: "",
    toImprove: "",
    needsSupport: "",
    slowPhase: undefined,
  };

  const update = (patch: Partial<typeof reflection>) =>
    setPlan((p) => ({ ...p, reflection: { ...reflection, ...patch } }));

  const save = () => {
    setLessons((prev) => {
      const filtered = prev.filter((l) => l.id !== plan.id);
      return [{ ...plan, createdAt: new Date().toISOString() }, ...filtered];
    });
    toast.success("تم حفظ التأمل مع الدرس");
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="card-elevated overflow-hidden print-page">
        <header
          className="p-6 text-white"
          style={{ background: "linear-gradient(135deg, var(--primary), #2a3d6b)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-primary">
              ✓
            </span>
            <div>
              <h1 className="text-xl font-black">انتهت الحصة</h1>
              <p className="text-xs opacity-80">
                {new Date().toLocaleString("ar", { dateStyle: "long", timeStyle: "short" })}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm opacity-90">
            {plan.subject || "—"} · {plan.grade || "—"} · {plan.topic || "بدون موضوع"}
          </p>
          <p className="mt-4 text-sm italic opacity-80">
            كل درس يُعلّمك شيئاً — ما الأهم اليوم؟
          </p>
        </header>

        <div className="space-y-5 p-6">
          <Field label="ما الذي نجح وأريد الإبقاء عليه؟">
            <textarea
              className={inputCls}
              value={reflection.wentWell}
              onChange={(e) => update({ wentWell: e.target.value })}
              placeholder="لحظة، سؤال، نشاط أعطى شرارة..."
            />
          </Field>
          <Field label="ما الذي سأعدّله في الحصة القادمة؟">
            <textarea
              className={inputCls}
              value={reflection.toImprove}
              onChange={(e) => update({ toImprove: e.target.value })}
              placeholder="التوقيت، الأدوات، ترتيب المراحل..."
            />
          </Field>
          <Field label="أي طالب يحتاج دعماً إضافياً؟">
            <textarea
              className={inputCls}
              value={reflection.needsSupport}
              onChange={(e) => update({ needsSupport: e.target.value })}
              placeholder="أسماء أو ملاحظات..."
            />
          </Field>
          <Field label="أي مرحلة استغرقت وقتاً أكثر من المخطط؟">
            <select
              className={inputCls}
              value={reflection.slowPhase ?? ""}
              onChange={(e) => update({ slowPhase: e.target.value || undefined })}
            >
              <option value="">— اختر مرحلة —</option>
              {PHASES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameAr}
                </option>
              ))}
            </select>
          </Field>

          <div
            className="rounded-lg border p-4"
            style={{ borderInlineStartWidth: 4, borderInlineStartColor: "#888" }}
          >
            <div className="mb-1 text-sm font-bold text-primary">
              📋 الواجب المنزلي المخطط
            </div>
            {plan.homework.studentText.trim() || plan.homework.teacherNote.trim() ? (
              <div className="space-y-2 text-sm">
                {plan.homework.teacherNote.trim() && (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold text-primary">للمعلم: </span>
                    {plan.homework.teacherNote}
                  </p>
                )}
                {plan.homework.studentText.trim() && (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold text-primary">للطالب: </span>
                    {plan.homework.studentText}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gold">
                لم تُحدد واجباً — ننصح بإضافته قبل الحصة القادمة.
              </p>
            )}
          </div>
        </div>

        <div className="no-print flex flex-wrap justify-end gap-2 border-t bg-muted/30 p-4">
          <button onClick={save} className={btnGhost}>
            <Save className="h-4 w-4" /> حفظ التأمل
          </button>
          <button onClick={() => window.print()} className={btnGhost}>
            <Printer className="h-4 w-4" /> طباعة التقرير
          </button>
          <NewLessonButton variant="primary" label="خطط درساً جديداً" />
        </div>
      </div>

      <div className="no-print mt-4 text-center text-sm">
        <Link to="/lessons" className="text-primary underline">
          عرض الدروس المحفوظة
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
