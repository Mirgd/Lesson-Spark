import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Printer,
  Save,
  Play,
  Sparkles,
  Loader2,
  Monitor,
} from "lucide-react";
import type { PhaseImage } from "@/lib/lesson-types";
import { PhaseImagePicker } from "@/components/PhaseImagePicker";
import {
  PHASES,
  QUESTION_BANKS,
  type PhaseId,
  useCurrentPlan,
  planLang,

  useSavedLessons,
  useCurriculum,
  totalDuration,
  completionRatio,
  type PhaseData,
  type PhaseMeta,
  type LessonPlan,
} from "@/lib/lesson-types";
import { suggestActivity, suggestHomework } from "@/lib/ai.functions";
import { autoFillLesson } from "@/lib/autofill.functions";
import { CONTENT_LANGUAGES, type ContentLanguage } from "@/lib/lang";

import { useServerFn } from "@tanstack/react-start";
import { OutcomesExtractor } from "@/components/OutcomesExtractor";
import { PresentationBuilder } from "@/components/PresentationBuilder";
import { WorksheetBuilder } from "@/components/WorksheetBuilder";
import { QuestionBank } from "@/components/QuestionBank";
import { CurriculumAutoUpload } from "@/components/AutoCurriculumUpload";
import { PlanAutoSave } from "@/components/PlanAutoSave";
import { reportAiError } from "@/lib/ai-error";
import { currentBundle, upsertPlan } from "@/lib/plans-db";
import { useSession } from "@/lib/session";


export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "التخطيط — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content: "خطط حصة STEM 60 دقيقة وفق نموذج 5E مع عرض متزامن للطالب.",
      },
    ],
  }),
  component: Planning,
});

function Planning() {
  const [plan, setPlan] = useCurrentPlan();
  const [, setLessons] = useSavedLessons();
  const { text: curriculumText } = useCurriculum();
  const navigate = useNavigate();
  const { identity } = useSession();
  const total = totalDuration(plan);
  const completion = Math.round(completionRatio(plan) * 100);

  const updateField = <K extends keyof LessonPlan>(k: K, v: LessonPlan[K]) =>
    setPlan((p) => ({ ...p, [k]: v }));
  const updatePhase = (id: string, patch: Partial<PhaseData>) =>
    setPlan((p) => ({
      ...p,
      phases: p.phases.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)),
    }));
  const updateHomework = (patch: Partial<LessonPlan["homework"]>) =>
    setPlan((p) => ({ ...p, homework: { ...p.homework, ...patch } }));

  const save = async () => {
    if (!plan.topic.trim()) {
      toast.warning("أضف موضوع الدرس أولاً");
      return;
    }
    setLessons((prev) => {
      const filtered = prev.filter((l) => l.id !== plan.id);
      return [{ ...plan, createdAt: new Date().toISOString() }, ...filtered];
    });
    const name = identity?.name;
    if (name) {
      try {
        await upsertPlan(currentBundle(plan));
        toast.success(`تم حفظ الخطة باسم ${name}`);
        return;
      } catch {
        toast.error("تم الحفظ محلياً — تعذّر الحفظ في حسابك");
        return;
      }
    }
    toast.success("تم حفظ الخطة");
  };


  const startExecute = () => {
    if (!plan.topic.trim()) {
      toast.warning("أضف موضوع الدرس قبل بدء التنفيذ");
      return;
    }
    navigate({ to: "/execute" });
  };

  const openStudentScreen = () => {
    const w = window.open("/student-view", "student", "width=1280,height=800");
    w?.focus();
  };

  /* ----- auto fill from topic ----- */
  const runAutoFill = useServerFn(autoFillLesson);
  const [askAutoFill, setAskAutoFill] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillDismissed, setAutoFillDismissed] = useState(false);

  const phasesEmpty = plan.phases.every(
    (p) =>
      !p.teacherActivity.trim() && !p.studentActivity.trim() && !(p.teacherQuestions ?? "").trim(),
  );

  const onTopicBlur = () => {
    if (plan.topic.trim() && phasesEmpty && !autoFillDismissed) setAskAutoFill(true);
  };

  const doAutoFill = async () => {
    setAutoFilling(true);
    try {
      const r = await runAutoFill({
        data: {
          subject: plan.subject,
          grade: plan.grade,
          topic: plan.topic.trim(),
          objectives: plan.objectives,
          curriculumText: curriculumText || "",
          lang: planLang(plan),
        },
      });
      const outcomes = r?.outcomes ?? [];
      setPlan((p) => ({
        ...p,
        outcomes: outcomes.length ? outcomes : p.outcomes,
        objectives: outcomes.length ? outcomes.join("\n") : p.objectives,
        phases: p.phases.map((ph) => {
          const src = r?.[ph.id];
          if (!src) return ph;
          return {
            ...ph,
            teacherActivity: src.teacherActivity || ph.teacherActivity,
            teacherQuestions: src.teacherQuestions || ph.teacherQuestions,
            studentActivity: src.studentActivity || ph.studentActivity,
          };
        }),
        homework: {
          ...p.homework,
          teacherNote: r?.homework?.teacherNote || p.homework.teacherNote,
          studentText: r?.homework?.studentText || p.homework.studentText,
        },
      }));

      setAskAutoFill(false);
      toast.success("✅ تمت تعبئة الخطة — راجع وعدّل ما يلزم");
    } catch (e) {
      toast.error(reportAiError(e, "التخطيط الذكي", "تعذّر توليد الخطة"));
    } finally {
      setAutoFilling(false);
    }
  };

  const autoFillBox = askAutoFill ? (
    <div className="mt-2 rounded-[10px] border-[1.5px] border-gold/50 bg-gold/10 p-3">
      <p className="text-[14px] font-semibold leading-relaxed text-primary">
        ✨ أريد أن أملأ خطة الدرس تلقائياً بناءً على موضوع الدرس
        {curriculumText ? " ونص المقرر المرفوع" : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={doAutoFill}
          disabled={autoFilling}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {autoFilling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ إنشاء الخطة...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> نعم، أنشئ الخطة
            </>
          )}
        </button>
        <button
          onClick={() => {
            setAskAutoFill(false);
            setAutoFillDismissed(true);
          }}
          disabled={autoFilling}
          className="rounded-lg border-[1.5px] border-[#CBD5E0] bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-[#F7F9FC]"
        >
          لا، سأكتب بنفسي
        </button>
      </div>
    </div>
  ) : null;

  return (
    <main className="mx-auto max-w-3xl px-3 pb-28 pt-6">
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-primary md:text-3xl">التخطيط</h1>
          <p className="text-sm text-muted-foreground">
            خطط درسك — ثم افتح شاشة الطالب للبروجكتور
          </p>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">
          الاكتمال:{" "}
          <span className={completion === 100 ? "text-primary font-bold" : "font-bold text-gold"}>
            {completion}%
          </span>
          <PlanAutoSave plan={plan} />
        </div>
      </header>


      <div className="space-y-4">

          <LessonInfo
            plan={plan}
            updateField={updateField}
            onTopicBlur={onTopicBlur}
            autoFill={autoFillBox}
          />

          <div id="lesson-file-upload">
            <CurriculumAutoUpload plan={plan} setPlan={setPlan} />
          </div>
          <OutcomesExtractor
            subject={plan.subject}
            grade={plan.grade}
            topic={plan.topic}
            lang={planLang(plan)}
            curriculum={curriculumText}
            onApply={(outcomes) =>
              setPlan((p) => ({ ...p, outcomes, objectives: outcomes.join("\n") }))
            }
          />

          {/* Time bar */}
          <div className="card-elevated p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>توزيع الوقت (5E)</span>
              <span className={total !== 55 ? "text-gold" : "text-primary"}>
                إجمالي: {total} / 55 دقيقة + 5 للواجب = 60
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {plan.phases.map((ph) => {
                const meta = PHASES.find((p) => p.id === ph.id)!;
                return (
                  <div
                    key={ph.id}
                    style={{
                      width: `${(ph.duration / Math.max(total, 1)) * 100}%`,
                      background: meta.color,
                    }}
                    title={`${meta.nameAr} — ${ph.duration} دق`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {plan.phases.map((ph) => {
                const meta = PHASES.find((p) => p.id === ph.id)!;
                return (
                  <span key={ph.id} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {meta.nameAr} {ph.duration}د
                  </span>
                );
              })}
            </div>
          </div>

          {/* 5E cards */}
          <div className="space-y-3">
            {PHASES.map((meta) => {
              const data = plan.phases.find((p) => p.id === meta.id)!;
              return (
                <PhaseCard
                  key={meta.id}
                  meta={meta}
                  data={data}
                  onChange={(patch) => updatePhase(meta.id, patch)}
                  context={{
                    subject: plan.subject,
                    grade: plan.grade,
                    topic: plan.topic,
                    objectives: plan.objectives,
                    lang: planLang(plan),
                  }}
                />
              );
            })}
          </div>

          {/* Homework */}
          <HomeworkCard
            homework={plan.homework}
            update={updateHomework}
            context={{
              subject: plan.subject,
              grade: plan.grade,
              topic: plan.topic,
              objectives: plan.objectives,
              lang: planLang(plan),
            }}
          />

          <PresentationBuilder plan={plan} />
          <QuestionBank plan={plan} />
          <WorksheetBuilder plan={plan} />
      </div>

      {/* Bottom action bar */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2 px-4 py-3">
          <button onClick={openStudentScreen} className={btnStudent}>
            <Monitor className="h-4 w-4" />
            افتح شاشة الطالب
          </button>
          <button onClick={save} className={btnGhost}>
            <Save className="h-4 w-4" />
            حفظ الخطة
          </button>
          <button onClick={() => window.print()} className={btnGhost}>
            <Printer className="h-4 w-4" />
            طباعة PDF
          </button>
          <button onClick={startExecute} className={btnPrimary}>
            <Play className="h-4 w-4" />
            ابدأ تنفيذ الدرس
          </button>
        </div>
      </div>

    </main>
  );
}

/* ---------------- Lesson info ---------------- */
function LessonInfo({
  plan,
  updateField,
  onTopicBlur,
  autoFill,
}: {
  plan: LessonPlan;
  updateField: <K extends keyof LessonPlan>(k: K, v: LessonPlan[K]) => void;
  onTopicBlur?: () => void;
  autoFill?: React.ReactNode;
}) {

  return (
    <div className="card-elevated p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="المادة">
          <select
            className={inputCls}
            value={SUBJECTS.includes(plan.subject) ? plan.subject : (plan.subject ? "__other__" : "")}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__other__") updateField("subject", " ");
              else updateField("subject", v);
            }}
          >
            <option value="">— اختر المادة —</option>
            <optgroup label="العلوم والرياضيات">
              {SUBJECTS_SCIENCE.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
            <optgroup label="اللغات">
              {SUBJECTS_LANGUAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
            <optgroup label="العلوم الشرعية والاجتماعية">
              {SUBJECTS_SOCIAL.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
            <optgroup label="المهارات والفنون">
              {SUBJECTS_SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
            <option value="__other__">أخرى (اكتب المادة)…</option>
          </select>
          {!SUBJECTS.includes(plan.subject) && plan.subject !== "" && (
            <input
              className={`${inputCls} mt-2`}
              value={plan.subject.trim() === "" ? "" : plan.subject}
              onChange={(e) => updateField("subject", e.target.value)}
              placeholder="اكتب اسم المادة"
              autoFocus
            />
          )}
        </Field>
        <Field label="الصف">
          <select
            className={inputCls}
            value={plan.grade}
            onChange={(e) => updateField("grade", e.target.value)}
          >
            <option value="">— اختر الصف —</option>
            <optgroup label="الابتدائي">
              {GRADES_PRIMARY.map((g) => <option key={g} value={g}>{g}</option>)}
            </optgroup>
            <optgroup label="المتوسط">
              {GRADES_MIDDLE.map((g) => <option key={g} value={g}>{g}</option>)}
            </optgroup>
            <optgroup label="الثانوي">
              {GRADES_HIGH.map((g) => <option key={g} value={g}>{g}</option>)}
            </optgroup>
          </select>
        </Field>
        <Field label="لغة الدرس">
          <select
            className={inputCls}
            value={plan.contentLanguage ?? "ar"}
            onChange={(e) => updateField("contentLanguage", e.target.value as ContentLanguage)}
          >
            {CONTENT_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            لغة المحتوى التعليمي المولَّد (الأسئلة، الأنشطة، أوراق العمل، الشرائح) — واجهة الموقع تبقى بالعربية.
          </p>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="موضوع الدرس">
          <input
            className={inputCls}
            value={plan.topic}
            onChange={(e) => updateField("topic", e.target.value)}
            onBlur={onTopicBlur}
            placeholder="مثال: الحرارة والانتقال الحراري"
          />
        </Field>
        {autoFill}
      </div>
      <div className="mt-3">
        <Field label="ماذا سأتعلم اليوم؟">
          <textarea
            className={`${inputCls} min-h-[110px] resize-y overflow-hidden leading-relaxed`}
            rows={Math.max(4, plan.objectives.split(/\r?\n/).length + 1)}
            value={plan.objectives}

            onChange={(e) => {
              updateField("objectives", e.target.value);
              updateField(
                "outcomes",
                e.target.value
                  .split(/\r?\n/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              );
            }}
            placeholder={"أُعرّف ...\nأُميّز ...\nأُطبّق ...\nأستنتج ..."}
          />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            اكتب كل ناتج بفعل مضارع مباشر بصيغة المتكلم — أُعرّف · أُميّز · أُطبّق · أستنتج · أربط ·
            أحلّل · أُصمّم · أبني
            <br />
            مثال: أُميّز بين أنواع الصخور الثلاثة
          </p>
        </Field>
      </div>

    </div>
  );
}

const SUBJECTS_SCIENCE = [
  "STEM",
  "العلوم",
  "الرياضيات",
  "الفيزياء",
  "الكيمياء",
  "الأحياء",
  "علوم الأرض",
  "علم البيئة",
  "الإحصاء",
];
const SUBJECTS_LANGUAGES = [
  "اللغة العربية",
  "اللغة الإنجليزية",
  "اللغة الفرنسية",
  "لغتي",
  "المطالعة",
  "النحو والصرف",
  "البلاغة والنقد",
];
const SUBJECTS_SOCIAL = [
  "الدراسات الاجتماعية",
  "التاريخ",
  "الجغرافيا",
  "الوطنية",
  "الدراسات الإسلامية",
  "التربية الإسلامية",
  "التفسير",
  "الحديث",
  "الفقه",
  "التوحيد",
  "القرآن الكريم",
  "التجويد",
  "السيرة النبوية",
  "التربية الأخلاقية",
  "علم النفس",
  "علم الاجتماع",
  "الفلسفة",
  "الاقتصاد",
];
const SUBJECTS_SKILLS = [
  "التقنية الرقمية",
  "الحاسب وتقنية المعلومات",
  "علوم الحاسب",
  "الروبوت",
  "الذكاء الاصطناعي",
  "المهارات الرقمية",
  "المهارات الحياتية والأسرية",
  "التربية المهنية",
  "التربية البدنية والدفاع عن النفس",
  "التربية الفنية",
  "التربية الموسيقية",
  "المسرح والدراما",
  "التصميم والتكنولوجيا",
  "ريادة الأعمال",
  "التفكير الناقد",
];
const SUBJECTS = [
  ...SUBJECTS_SCIENCE,
  ...SUBJECTS_LANGUAGES,
  ...SUBJECTS_SOCIAL,
  ...SUBJECTS_SKILLS,
];
const GRADES_PRIMARY = [
  "الأول الابتدائي",
  "الثاني الابتدائي",
  "الثالث الابتدائي",
  "الرابع الابتدائي",
  "الخامس الابتدائي",
  "السادس الابتدائي",
];
const GRADES_MIDDLE = ["الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط"];
const GRADES_HIGH = ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"];

/* ---------------- Phase card ---------------- */
function PhaseCard({
  meta,
  data,
  onChange,
  context,
}: {
  meta: PhaseMeta;
  data: PhaseData;
  onChange: (patch: Partial<PhaseData>) => void;
  context: { subject: string; grade: string; topic: string; objectives: string; lang: ContentLanguage };
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const suggest = useServerFn(suggestActivity);
  const { text: curriculum } = useCurriculum();

  const completed = data.teacherActivity.trim().length > 0 || data.studentActivity.trim().length > 0;

  const askAi = async () => {
    setLoading(true);
    try {
      const { text } = await suggest({
        data: {
          ...context,
          phaseNameAr: meta.nameAr,
          phaseNameEn: meta.nameEn,
          duration: data.duration,
          curriculum: curriculum || undefined,
        },
      });
      onChange({ aiSuggestion: text });
    } catch (e) {
      toast.error(reportAiError(e, "التخطيط الذكي", "تعذّر الاتصال"));
    } finally {
      setLoading(false);
    }
  };

  const useSuggestion = () => {
    const text = data.aiSuggestion ?? "";
    const teacherMatch = text.match(/\*\*للمعلم:\*\*([\s\S]*?)(?=\*\*للطالب|$)/);
    const studentMatch = text.match(/\*\*للطالب[^:]*:\*\*([\s\S]*)/);
    onChange({
      teacherActivity: (teacherMatch?.[1] ?? "").trim() || data.teacherActivity,
      studentActivity: (studentMatch?.[1] ?? "").trim() || data.studentActivity,
    });
    toast.success("تم تعبئة الحقول");
  };

  return (
    <div
      className="phase-card bg-card"
      style={{ borderInlineStartWidth: 4, borderInlineStartColor: meta.color }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3.5 bg-card px-5 py-4 text-right transition-colors hover:bg-[#F7F9FC]"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: meta.color }}
        >
          {completed ? "✓" : meta.nameEn[0]}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-[18px] font-bold leading-snug text-primary">{meta.nameAr}</span>
          <span className="mt-px block text-[12px] font-medium text-[#8896A5]">{meta.nameEn}</span>
        </div>
        <span className="shrink-0 rounded-lg bg-[#FBF4E3] px-2.5 py-1 text-[15px] font-bold text-gold">
          {data.duration} دق
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t bg-[#F7F9FC] p-5">
          <div
            className="mb-4 rounded-[10px] border bg-card px-3.5 py-2.5 text-[14px] leading-[1.7] text-[#4A5568]"
            style={{ borderInlineStartWidth: 3, borderInlineStartColor: "var(--gold)" }}
          >
            <span className="font-bold text-gold">💡 </span>
            {meta.teacherHint}
          </div>


          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-sm">
              <label className="font-medium">⏱ الوقت</label>
              <span className="font-bold text-primary">{data.duration} دق</span>
            </div>
            <input
              type="range"
              min={2}
              max={25}
              value={data.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full accent-[var(--gold)]"
            />
          </div>

          <Field label="نشاط المرحلة (توجيه المعلم)">
            <textarea
              className={`${inputCls} min-h-[80px]`}
              value={data.teacherActivity}
              onChange={(e) => onChange({ teacherActivity: e.target.value })}
              placeholder={meta.placeholder}
            />
          </Field>

          <div className="mt-3">
            <Field label="أسئلة المعلم">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={data.teacherQuestions ?? ""}
                onChange={(e) => onChange({ teacherQuestions: e.target.value })}
                placeholder={meta.questionsPlaceholder}
              />
            </Field>
            <ReadyQuestions
              phase={meta.id}
              topic={context.topic}
              onPick={(q) => {
                const cur = (data.teacherQuestions ?? "").trimEnd();
                onChange({ teacherQuestions: cur ? `${cur}\n• ${q}` : `• ${q}` });
              }}
            />
          </div>

          <div className="mt-3">
            <Field label="النشاط بصياغة الطالب (يظهر في شاشة الطالب)">
              <textarea
                className={`${inputCls} min-h-[70px]`}
                value={data.studentActivity}
                onChange={(e) => onChange({ studentActivity: e.target.value })}
                placeholder={meta.studentPlaceholder}
              />
            </Field>
          </div>

          <button
            onClick={askAi}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التفكير...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> اقترح نشاطاً بالذكاء الاصطناعي
              </>
            )}
          </button>

          {data.aiSuggestion && (
            <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {data.aiSuggestion}
              <div className="mt-3">
                <button
                  onClick={useSuggestion}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  استخدم هذا الاقتراح
                </button>
              </div>
            </div>
          )}

          <PhaseImagePicker
            images={data.images ?? []}
            onChange={(images: PhaseImage[]) => onChange({ images })}
            topic={context.topic}
            subject={context.subject}
          />

        </div>
      )}
    </div>
  );
}

/* ---------------- Ready-made questions ---------------- */
function ReadyQuestions({
  phase,
  topic,
  onPick,
}: {
  phase: PhaseId;
  topic: string;
  onPick: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const subject = topic.trim() || "الموضوع";
  const list = QUESTION_BANKS[phase].map((q) => q.replace(/\{topic\}/g, subject));

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[13px] font-semibold text-gold hover:bg-gold/20"
      >
        💡 أسئلة جاهزة
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 overflow-hidden rounded-[10px] border-[1.5px] border-[#CBD5E0] bg-card">
          {list.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                onPick(q);
                setOpen(false);
              }}
              className="block w-full border-b px-3.5 py-2.5 text-right text-[14px] leading-[1.7] last:border-b-0 hover:bg-[#F7F9FC]"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- الصور التوضيحية: انظر PhaseImagePicker ---------------- */


/* ---------------- Homework card ---------------- */
function HomeworkCard({
  homework,
  update,
  context,
}: {
  homework: LessonPlan["homework"];
  update: (patch: Partial<LessonPlan["homework"]>) => void;
  context: { subject: string; grade: string; topic: string; objectives: string; lang: ContentLanguage };
}) {
  const [loading, setLoading] = useState(false);
  const suggest = useServerFn(suggestHomework);
  const { text: curriculum } = useCurriculum();

  const askAi = async () => {
    setLoading(true);
    try {
      const { text } = await suggest({ data: { ...context, curriculum: curriculum || undefined } });
      update({ aiSuggestion: text });
    } catch (e) {
      toast.error(reportAiError(e, "التخطيط الذكي", "تعذّر الاتصال"));
    } finally {
      setLoading(false);
    }
  };

  const useSuggestion = () => {
    const text = homework.aiSuggestion ?? "";
    const teacherMatch = text.match(/\*\*توجيه المعلم:\*\*([\s\S]*?)(?=\*\*للطالب|$)/);
    const studentMatch = text.match(/\*\*للطالب:\*\*([\s\S]*)/);
    update({
      teacherNote: (teacherMatch?.[1] ?? "").trim() || homework.teacherNote,
      studentText: (studentMatch?.[1] ?? "").trim() || homework.studentText,
    });
    toast.success("تم تعبئة الواجب");
  };

  return (
    <div
      className="card-elevated p-4"
      style={{ borderInlineStartWidth: 4, borderInlineStartColor: "#888" }}
    >
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-primary">📋 الواجب المنزلي</span>
          <span className="text-xs text-muted-foreground">Home Extension</span>
        </div>
        <p className="text-xs text-muted-foreground">
          امتداد من مرحلة التقويم — تحدٍّ واقعي يربط التعلم بالحياة
        </p>
      </div>

      <Field label="توجيه المعلم">
        <textarea
          className={`${inputCls} min-h-[70px]`}
          value={homework.teacherNote}
          onChange={(e) => update({ teacherNote: e.target.value })}
          placeholder="اشرح للطالب هدف الواجب ومعايير التقييم..."
        />
      </Field>

      <div className="mt-3">
        <Field label="صياغة الطالب (يظهر في شاشة الطالب)">
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={homework.studentText}
            onChange={(e) => update({ studentText: e.target.value })}
            placeholder="تحدّيك خارج الفصل: ..."
          />
        </Field>
      </div>

      <button
        onClick={askAi}
        disabled={loading}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التفكير...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> اقترح واجباً ذكياً
          </>
        )}
      </button>

      {homework.aiSuggestion && (
        <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {homework.aiSuggestion}
          <div className="mt-3">
            <button
              onClick={useSuggestion}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              استخدم هذا الواجب
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


const inputCls =
  "w-full rounded-[10px] border-[1.5px] border-[#CBD5E0] bg-card px-3.5 py-2.5 text-[16px] leading-[1.7] outline-none transition-colors focus:border-primary focus:ring-[3px] focus:ring-primary/10";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-[10px] bg-primary px-6 py-2.5 text-[15px] font-bold text-primary-foreground transition-all hover:-translate-y-px hover:bg-[#0D1F3C] hover:shadow-[0_4px_12px_rgba(27,42,74,0.25)]";
const btnGhost =
  "inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-[#CBD5E0] bg-card px-5 py-2.5 text-[15px] font-semibold text-primary transition-all hover:border-primary hover:bg-[#F7F9FC]";
const btnStudent =
  "inline-flex items-center gap-2 rounded-[10px] bg-gold px-5 py-2.5 text-[15px] font-bold text-white transition-all hover:-translate-y-px hover:bg-[#D4A017] hover:shadow-[0_4px_12px_rgba(184,134,11,0.30)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-primary">{label}</span>
      {children}
    </label>
  );
}

