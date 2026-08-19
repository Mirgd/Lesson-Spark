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
  QUESTION_BANKS_EN,
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
import { useUiLanguage } from "@/lib/ui-language";

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
  const { language, t, dir } = useUiLanguage();
  const isArabic = language === "ar";

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
    toast.warning(
      isArabic
        ? "أضف موضوع الدرس أولاً"
        : "Add the lesson topic first."
    );
    return;
  }

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

  const name = identity?.name;

  if (name) {
    try {
      await upsertPlan(currentBundle(plan));

      toast.success(
        isArabic
          ? `تم حفظ الخطة باسم ${name}`
          : `Plan saved under ${name}`
      );

      return;
    } catch {
      toast.error(
        isArabic
          ? "تم الحفظ محلياً — تعذّر الحفظ في حسابك"
          : "Saved locally — unable to save to your account."
      );

      return;
    }
  }

  toast.success(
    isArabic
      ? "تم حفظ الخطة"
      : "Plan saved successfully."
  );
};


  const startExecute = () => {
    if (!plan.topic.trim()) {
toast.warning(
  isArabic
    ? "أضف موضوع الدرس قبل بدء التنفيذ"
    : "Add the lesson topic before starting the lesson."
);      return;
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

toast.success(
  isArabic
    ? "✅ تمت تعبئة الخطة — راجع وعدّل ما يلزم"
    : "✅ Plan generated — review and edit as needed"
);

} catch (e) {
  toast.error(
    reportAiError(
      e,
      isArabic ? "التخطيط الذكي" : "AI Planning",
      isArabic ? "تعذّر توليد الخطة" : "Failed to generate the plan"
    )
  );
} finally {
  setAutoFilling(false);
}
  };

const autoFillBox = askAutoFill ? (
  <div className="mt-2 rounded-[10px] border-[1.5px] border-gold/50 bg-gold/10 p-3">
    <p className="text-[14px] font-semibold leading-relaxed text-primary">
      ✨{" "}
      {isArabic
        ? "أريد أن أملأ خطة الدرس تلقائياً بناءً على موضوع الدرس"
        : "I want to automatically generate the lesson plan based on the lesson topic"}

      {curriculumText
        ? isArabic
          ? " ونص المقرر المرفوع"
          : " and the uploaded curriculum"
        : ""}
    </p>

    <div className="mt-2 flex flex-wrap gap-2">
      <button
        onClick={doAutoFill}
        disabled={autoFilling}
        className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {autoFilling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isArabic
              ? "جارٍ إنشاء الخطة..."
              : "Generating Plan..."}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {isArabic
              ? "نعم، أنشئ الخطة"
              : "Yes, Generate the Plan"}
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
        {isArabic
          ? "لا، سأكتب بنفسي"
          : "No, I'll Write It Myself"}
      </button>
    </div>
  </div>
) : null;

  return (
    <main className="mx-auto max-w-3xl px-3 pb-28 pt-6">
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-primary md:text-3xl">
  {isArabic ? "التخطيط" : "Planning"}
</h1>

<p className="text-sm text-muted-foreground">
  {isArabic
    ? "خطط درسك — ثم افتح شاشة الطالب للبروجكتور"
    : "Plan your lesson — then open the student screen for projection"}
</p>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">
         {isArabic ? "الاكتمال:" : "Completion:"}{" "}
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
            existingOutcomes={plan.outcomes}
          />

          {/* Time bar */}
<div className="card-elevated p-4">
  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
    <span>
      {isArabic ? "توزيع الوقت (5E)" : "Time Distribution (5E)"}
    </span>

    <span className={total !== 55 ? "text-gold" : "text-primary"}>
      {isArabic
        ? `إجمالي: ${total} / 55 دقيقة + 5 للواجب = 60`
        : `Total: ${total} / 55 min + 5 min for homework = 60`}
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
        title={`${
          isArabic ? meta.nameAr : meta.nameEn
        } — ${ph.duration} ${
          isArabic ? "دق" : "min"
        }`}
      />
    );
  })}
</div>

<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
  {plan.phases.map((ph) => {
    const meta = PHASES.find((p) => p.id === ph.id)!;

    return (
      <span
        key={ph.id}
        className="inline-flex items-center gap-1"
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: meta.color }}
        />

        {isArabic ? meta.nameAr : meta.nameEn}{" "}
        {ph.duration}
        {isArabic ? "د" : " min"}
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
  {isArabic ? "افتح شاشة الطالب" : "Open Student Screen"}
</button>

<button onClick={save} className={btnGhost}>
  <Save className="h-4 w-4" />
  {isArabic ? "حفظ الخطة" : "Save Plan"}
</button>

<button onClick={() => window.print()} className={btnGhost}>
  <Printer className="h-4 w-4" />
  {isArabic ? "طباعة PDF" : "Print PDF"}
</button>

<button onClick={startExecute} className={btnPrimary}>
  <Play className="h-4 w-4" />
  {isArabic ? "ابدأ تنفيذ الدرس" : "Start Lesson"}
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
    const { language } = useUiLanguage();
    const isArabic = language === "ar";
  const subjectLabel = (subject: string) => {
  if (isArabic) return subject;

  const labels: Record<string, string> = {
    STEM: "STEM",
    العلوم: "Science",
    الرياضيات: "Mathematics",
    الفيزياء: "Physics",
    الكيمياء: "Chemistry",
    الأحياء: "Biology",
    "علوم الأرض": "Earth Science",
    "علم البيئة": "Environmental Science",
    الإحصاء: "Statistics",

    "اللغة العربية": "Arabic Language",
    "اللغة الإنجليزية": "English Language",
    "اللغة الفرنسية": "French Language",
    لغتي: "Arabic Language",
    المطالعة: "Reading",
    "النحو والصرف": "Grammar and Morphology",
    "البلاغة والنقد": "Rhetoric and Criticism",

    "الدراسات الاجتماعية": "Social Studies",
    التاريخ: "History",
    الجغرافيا: "Geography",
    الوطنية: "Civics",
    "الدراسات الإسلامية": "Islamic Studies",
    "التربية الإسلامية": "Islamic Education",
    التفسير: "Quran Interpretation",
    الحديث: "Hadith",
    الفقه: "Fiqh",
    التوحيد: "Tawheed",
    "القرآن الكريم": "Quran",
    التجويد: "Tajweed",
    "السيرة النبوية": "Prophetic Biography",
    "التربية الأخلاقية": "Moral Education",
    "علم النفس": "Psychology",
    "علم الاجتماع": "Sociology",
    الفلسفة: "Philosophy",
    الاقتصاد: "Economics",

    "التقنية الرقمية": "Digital Technology",
    "الحاسب وتقنية المعلومات": "Computer and Information Technology",
    "علوم الحاسب": "Computer Science",
    الروبوت: "Robotics",
    "الذكاء الاصطناعي": "Artificial Intelligence",
    "المهارات الرقمية": "Digital Skills",
    "المهارات الحياتية والأسرية": "Life and Family Skills",
    "التربية المهنية": "Career Education",
    "التربية البدنية والدفاع عن النفس": "Physical Education",
    "التربية الفنية": "Art Education",
    "التربية الموسيقية": "Music Education",
    "المسرح والدراما": "Theater and Drama",
    "التصميم والتكنولوجيا": "Design and Technology",
    "ريادة الأعمال": "Entrepreneurship",
    "التفكير الناقد": "Critical Thinking",
  };

  return labels[subject] ?? subject;
};

const gradeLabel = (grade: string) => {
  if (isArabic) return grade;

  const labels: Record<string, string> = {
    "الأول الابتدائي": "Grade 1",
    "الثاني الابتدائي": "Grade 2",
    "الثالث الابتدائي": "Grade 3",
    "الرابع الابتدائي": "Grade 4",
    "الخامس الابتدائي": "Grade 5",
    "السادس الابتدائي": "Grade 6",

    "الأول المتوسط": "Grade 7",
    "الثاني المتوسط": "Grade 8",
    "الثالث المتوسط": "Grade 9",

    "الأول الثانوي": "Grade 10",
    "الثاني الثانوي": "Grade 11",
    "الثالث الثانوي": "Grade 12",
  };

  return labels[grade] ?? grade;
};
return (
  <div className="card-elevated p-5">
    <div className="grid gap-3 md:grid-cols-2">
      {/* Subject */}
      <Field label={isArabic ? "المادة" : "Subject"}>
        <select
          className={inputCls}
          value={
            SUBJECTS.includes(plan.subject)
              ? plan.subject
              : plan.subject
                ? "__other__"
                : ""
          }
          onChange={(e) => {
            const v = e.target.value;

            if (v === "__other__") {
              updateField("subject", " ");
            } else {
              updateField("subject", v);
            }
          }}
        >
          <option value="">
            {isArabic ? "— اختر المادة —" : "— Select Subject —"}
          </option>

          <optgroup
            label={
              isArabic
                ? "العلوم والرياضيات"
                : "Science & Mathematics"
            }
          >
            {SUBJECTS_SCIENCE.map((s) => (
              <option key={s} value={s}>
                {subjectLabel(s)}
              </option>
            ))}
          </optgroup>

          <optgroup
            label={isArabic ? "اللغات" : "Languages"}
          >
            {SUBJECTS_LANGUAGES.map((s) => (
              <option key={s} value={s}>
                {subjectLabel(s)}
              </option>
            ))}
          </optgroup>

          <optgroup
            label={
              isArabic
                ? "العلوم الشرعية والاجتماعية"
                : "Islamic & Social Studies"
            }
          >
            {SUBJECTS_SOCIAL.map((s) => (
              <option key={s} value={s}>
                {subjectLabel(s)}
              </option>
            ))}
          </optgroup>

          <optgroup
            label={
              isArabic
                ? "المهارات والفنون"
                : "Skills & Arts"
            }
          >
            {SUBJECTS_SKILLS.map((s) => (
              <option key={s} value={s}>
                {subjectLabel(s)}
              </option>
            ))}
          </optgroup>

          <option value="__other__">
            {isArabic
              ? "أخرى (اكتب المادة)…"
              : "Other (type subject)…"}
          </option>
        </select>

        {!SUBJECTS.includes(plan.subject) &&
          plan.subject !== "" && (
            <input
              className={`${inputCls} mt-2`}
              value={
                plan.subject.trim() === ""
                  ? ""
                  : plan.subject
              }
              onChange={(e) =>
                updateField("subject", e.target.value)
              }
              placeholder={
                isArabic
                  ? "اكتب اسم المادة"
                  : "Enter subject name"
              }
              autoFocus
            />
          )}
      </Field>

      {/* Grade */}
      <Field label={isArabic ? "الصف" : "Grade"}>
        <select
          className={inputCls}
          value={plan.grade}
          onChange={(e) =>
            updateField("grade", e.target.value)
          }
        >
          <option value="">
            {isArabic ? "— اختر الصف —" : "— Select Grade —"}
          </option>

          <optgroup
            label={isArabic ? "الابتدائي" : "Primary School"}
          >
            {GRADES_PRIMARY.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </optgroup>

          <optgroup
            label={isArabic ? "المتوسط" : "Middle School"}
          >
            {GRADES_MIDDLE.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </optgroup>

          <optgroup
            label={isArabic ? "الثانوي" : "High School"}
          >
            {GRADES_HIGH.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      {/* Lesson content language */}
      <Field
        label={
          isArabic
            ? "لغة الدرس"
            : "Lesson Content Language"
        }
      >
        <select
          className={inputCls}
          value={plan.contentLanguage ?? "ar"}
          onChange={(e) =>
            updateField(
              "contentLanguage",
              e.target.value as ContentLanguage
            )
          }
        >
          {CONTENT_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {isArabic
                ? l.label
                : l.value === "ar"
                  ? "Arabic"
                  : "English"}
            </option>
          ))}
        </select>

        <p className="mt-1 text-[11px] text-muted-foreground">
          {isArabic
            ? "لغة المحتوى التعليمي المولَّد (الأسئلة، الأنشطة، أوراق العمل، الشرائح) — وهي مستقلة عن لغة واجهة الموقع."
            : "The language used for generated educational content (questions, activities, worksheets, and slides). This is independent from the website interface language."}
        </p>
      </Field>
    </div>

    {/* Topic */}
    <div className="mt-3">
      <Field
        label={
          isArabic
            ? "موضوع الدرس"
            : "Lesson Topic"
        }
      >
        <input
          className={inputCls}
          value={plan.topic}
          onChange={(e) =>
            updateField("topic", e.target.value)
          }
          onBlur={onTopicBlur}
          placeholder={
            isArabic
              ? "مثال: الحرارة والانتقال الحراري"
              : "Example: Comparing and Ordering Numbers"
          }
        />
      </Field>

      {autoFill}
    </div>

    {/* Learning outcomes */}
    <div className="mt-3">
      <Field
        label={
          isArabic
            ? "ماذا سأتعلم اليوم؟"
            : "What Will I Learn Today?"
        }
      >
        <textarea
          className={`${inputCls} min-h-[110px] resize-y overflow-hidden leading-relaxed`}
          rows={Math.max(
            4,
            plan.objectives.split(/\r?\n/).length + 1
          )}
          value={plan.objectives}
          onChange={(e) => {
            updateField(
              "objectives",
              e.target.value
            );

            updateField(
              "outcomes",
              e.target.value
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
            );
          }}
          placeholder={
            isArabic
              ? "أُعرّف ...\nأُميّز ...\nأُطبّق ...\nأستنتج ..."
              : "I define ...\nI distinguish ...\nI apply ...\nI infer ..."
          }
        />

        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {isArabic ? (
            <>
              اكتب كل ناتج بفعل مضارع مباشر بصيغة المتكلم —
              أُعرّف · أُميّز · أُطبّق · أستنتج · أربط ·
              أحلّل · أُصمّم · أبني
              <br />
              مثال: أُميّز بين أنواع الصخور الثلاثة
            </>
          ) : (
            <>
              Write each learning outcome in the first person
              using a measurable action verb — I define · I
              distinguish · I apply · I infer · I connect · I
              analyze · I design · I build
              <br />
              Example: I distinguish between the three types of
              rocks.
            </>
          )}
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
  const { language } = useUiLanguage();
  const isArabic = language === "ar";
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
  toast.error(
    reportAiError(
      e,
      isArabic ? "التخطيط الذكي" : "AI Planning",
      isArabic ? "تعذّر الاتصال" : "Unable to connect"
    )
  );
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
    toast.success(
  isArabic
    ? "✅ تمت تعبئة الخطة — راجع وعدّل ما يلزم"
    : "✅ Plan generated — review and edit as needed"
);
  };

return (
  <div
    className="phase-card bg-card"
    style={{
      borderInlineStartWidth: 4,
      borderInlineStartColor: meta.color,
    }}
  >
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="flex w-full items-center gap-3.5 bg-card px-5 py-4 text-start transition-colors hover:bg-[#F7F9FC]"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: meta.color }}
      >
        {completed ? "✓" : meta.nameEn[0]}
      </span>

      <div className="min-w-0 flex-1">
        <span className="block text-[18px] font-bold leading-snug text-primary">
          {isArabic ? meta.nameAr : meta.nameEn}
        </span>

        <span className="mt-px block text-[12px] font-medium text-[#8896A5]">
          {isArabic ? meta.nameEn : meta.nameAr}
        </span>
      </div>

      <span className="shrink-0 rounded-lg bg-[#FBF4E3] px-2.5 py-1 text-[15px] font-bold text-gold">
        {data.duration} {isArabic ? "دق" : "min"}
      </span>

      <ChevronDown
        className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>

    {open && (
      <div className="border-t bg-[#F7F9FC] p-5">
        <div
          className="mb-4 rounded-[10px] border bg-card px-3.5 py-2.5 text-[14px] leading-[1.7] text-[#4A5568]"
          style={{
            borderInlineStartWidth: 3,
            borderInlineStartColor: "var(--gold)",
          }}
        >
          <span className="font-bold text-gold">💡 </span>

          {isArabic
            ? meta.teacherHint
            : `Plan this ${meta.nameEn} phase around the lesson objective and encourage active student participation.`}
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <label className="font-medium">
              ⏱ {isArabic ? "الوقت" : "Time"}
            </label>

            <span className="font-bold text-primary">
              {data.duration} {isArabic ? "دق" : "min"}
            </span>
          </div>

          <input
            type="range"
            min={2}
            max={25}
            value={data.duration}
            onChange={(e) =>
              onChange({
                duration: Number(e.target.value),
              })
            }
            className="w-full accent-[var(--gold)]"
          />
        </div>

        <Field
          label={
            isArabic
              ? "نشاط المرحلة (توجيه المعلم)"
              : "Phase Activity (Teacher Guidance)"
          }
        >
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={data.teacherActivity}
            onChange={(e) =>
              onChange({
                teacherActivity: e.target.value,
              })
            }
            placeholder={
              isArabic
                ? meta.placeholder
                : `Describe the teacher's role during the ${meta.nameEn} phase...`
            }
          />
        </Field>

        <div className="mt-3">
          <Field
            label={
              isArabic
                ? "أسئلة المعلم"
                : "Teacher Questions"
            }
          >
            <textarea
              className={`${inputCls} min-h-[80px]`}
              value={data.teacherQuestions ?? ""}
              onChange={(e) =>
                onChange({
                  teacherQuestions: e.target.value,
                })
              }
              placeholder={
                isArabic
                  ? meta.questionsPlaceholder
                  : `Write guiding questions for the ${meta.nameEn} phase...`
              }
            />
          </Field>

          <ReadyQuestions
            phase={meta.id}
            topic={context.topic}
            onPick={(q) => {
              const cur = (
                data.teacherQuestions ?? ""
              ).trimEnd();

              onChange({
                teacherQuestions: cur
                  ? `${cur}\n• ${q}`
                  : `• ${q}`,
              });
            }}
          />
        </div>

        <div className="mt-3">
          <Field
            label={
              isArabic
                ? "النشاط بصياغة الطالب (يظهر في شاشة الطالب)"
                : "Student Activity (Shown on Student Screen)"
            }
          >
            <textarea
              className={`${inputCls} min-h-[70px]`}
              value={data.studentActivity}
              onChange={(e) =>
                onChange({
                  studentActivity: e.target.value,
                })
              }
              placeholder={
                isArabic
                  ? meta.studentPlaceholder
                  : `Write the activity from the student's point of view...`
              }
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
              <Loader2 className="h-4 w-4 animate-spin" />
              {isArabic
                ? "جارٍ التفكير..."
                : "Thinking..."}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {isArabic
                ? "اقترح نشاطاً بالذكاء الاصطناعي"
                : "Suggest an AI Activity"}
            </>
          )}
        </button>

        {data.aiSuggestion && (
          <div className="mt-3 whitespace-pre-wrap rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm leading-relaxed">
            {data.aiSuggestion}

            <div className="mt-3">
              <button
                onClick={useSuggestion}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                {isArabic
                  ? "استخدم هذا الاقتراح"
                  : "Use This Suggestion"}
              </button>
            </div>
          </div>
        )}

        <PhaseImagePicker
          images={data.images ?? []}
          onChange={(images: PhaseImage[]) =>
            onChange({ images })
          }
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
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [open, setOpen] = useState(false);

  const subject =
    topic.trim() ||
    (isArabic ? "الموضوع" : "the topic");

const questionBank = isArabic
  ? QUESTION_BANKS
  : QUESTION_BANKS_EN;

  const list = questionBank[phase].map((q) =>
    q.replace(/\{topic\}/g, subject)
  );

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[13px] font-semibold text-gold hover:bg-gold/20"
      >
        💡 {isArabic ? "أسئلة جاهزة" : "Ready-Made Questions"}

        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
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
              className="block w-full border-b px-3.5 py-2.5 text-start text-[14px] leading-[1.7] last:border-b-0 hover:bg-[#F7F9FC]"
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
  context: {
    subject: string;
    grade: string;
    topic: string;
    objectives: string;
    lang: ContentLanguage;
  };
}) {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [loading, setLoading] = useState(false);
  const suggest = useServerFn(suggestHomework);
  const { text: curriculum } = useCurriculum();

  const askAi = async () => {
    setLoading(true);

    try {
      const { text } = await suggest({
        data: {
          ...context,
          curriculum: curriculum || undefined,
        },
      });

      update({ aiSuggestion: text });
    } catch (e) {
      toast.error(
        reportAiError(
          e,
          isArabic ? "التخطيط الذكي" : "AI Planning",
          isArabic ? "تعذّر الاتصال" : "Unable to connect"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const useSuggestion = () => {
    const text = homework.aiSuggestion ?? "";

    const teacherMatch = isArabic
      ? text.match(
          /\*\*توجيه المعلم:\*\*([\s\S]*?)(?=\*\*للطالب|$)/
        )
      : text.match(
          /\*\*(?:Teacher Guidance|For the Teacher|Teacher):\*\*([\s\S]*?)(?=\*\*(?:For the Student|Student)|$)/i
        );

    const studentMatch = isArabic
      ? text.match(/\*\*للطالب:\*\*([\s\S]*)/)
      : text.match(
          /\*\*(?:For the Student|Student):\*\*([\s\S]*)/i
        );

    update({
      teacherNote:
        (teacherMatch?.[1] ?? "").trim() ||
        homework.teacherNote,

      studentText:
        (studentMatch?.[1] ?? "").trim() ||
        homework.studentText,
    });

    toast.success(
      isArabic
        ? "تم تعبئة الواجب"
        : "Homework fields filled successfully"
    );
  };

  return (
    <div
      className="card-elevated p-4"
      style={{
        borderInlineStartWidth: 4,
        borderInlineStartColor: "#888",
      }}
    >
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-primary">
            📋 {isArabic ? "الواجب المنزلي" : "Homework"}
          </span>

          <span className="text-xs text-muted-foreground">
            {isArabic ? "Home Extension" : "Home Extension"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {isArabic
            ? "امتداد من مرحلة التقويم — تحدٍّ واقعي يربط التعلم بالحياة"
            : "An extension of the Evaluate phase — a real-world challenge that connects learning to life."}
        </p>
      </div>

      <Field
        label={
          isArabic
            ? "توجيه المعلم"
            : "Teacher Guidance"
        }
      >
        <textarea
          className={`${inputCls} min-h-[70px]`}
          value={homework.teacherNote}
          onChange={(e) =>
            update({
              teacherNote: e.target.value,
            })
          }
          placeholder={
            isArabic
              ? "اشرح للطالب هدف الواجب ومعايير التقييم..."
              : "Explain the purpose of the homework and the assessment criteria..."
          }
        />
      </Field>

      <div className="mt-3">
        <Field
          label={
            isArabic
              ? "صياغة الطالب (يظهر في شاشة الطالب)"
              : "Student Instructions (Shown on Student Screen)"
          }
        >
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={homework.studentText}
            onChange={(e) =>
              update({
                studentText: e.target.value,
              })
            }
            placeholder={
              isArabic
                ? "تحدّيك خارج الفصل: ..."
                : "Your challenge outside the classroom: ..."
            }
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
            <Loader2 className="h-4 w-4 animate-spin" />

            {isArabic
              ? "جارٍ التفكير..."
              : "Thinking..."}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />

            {isArabic
              ? "اقترح واجباً ذكياً"
              : "Suggest AI Homework"}
          </>
        )}
      </button>

      {homework.aiSuggestion && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm leading-relaxed">
          {homework.aiSuggestion}

          <div className="mt-3">
            <button
              onClick={useSuggestion}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              {isArabic
                ? "استخدم هذا الواجب"
                : "Use This Homework"}
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

