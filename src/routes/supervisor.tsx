import { useUiLanguage } from "@/lib/ui-language";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Star, ClipboardCheck, X, Users } from "lucide-react";
import {
  listAllPlans,
  listPlanReviews,
  listTeacherProfiles,
  type PlanReviewRow,
  type SupervisedPlan,
  type TeacherProfile,
} from "@/lib/supervision";
import { relativeTime } from "@/lib/plans-db";
import { useSession } from "@/lib/session";
import { PHASES, type HomeworkData, type PhaseData } from "@/lib/lesson-types";
import PlanReview from "@/components/PlanReview";
import SupervisorOnly from "@/components/SupervisorOnly";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/supervisor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الإشراف — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content: "متابعة خطط الدروس وتقييمها بنموذج 5E في المدرسة الرمز.",
      },
      { property: "og:title", content: "الإشراف — المدرسة الرمز" },
      { property: "og:description", content: "متابعة خطط الدروس وتقييمها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <SupervisorPage />
    </SupervisorOnly>
  ),
});

const STATUS_LABEL: Record<string, string> = { draft: "مسودة", complete: "مكتملة" };

function SupervisorPage() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const { identity } = useSession();
  const me = identity?.user.id ?? "";

  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [plans, setPlans] = useState<SupervisedPlan[]>([]);
  const [reviews, setReviews] = useState<PlanReviewRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"all" | "pending" | "mine">("all");
  const [openPlan, setOpenPlan] = useState<SupervisedPlan | null>(null);
  const [attendancePlan, setAttendancePlan] = useState<SupervisedPlan | null>(null);

  const statusLabel = (value: string) => {
    if (value === "complete") {
      return isArabic ? "مكتملة" : "Complete";
    }

    if (value === "draft") {
      return isArabic ? "مسودة" : "Draft";
    }

    return value;
  };
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [t, p, r] = await Promise.all([
        listTeacherProfiles(),
        listAllPlans(),
        listPlanReviews(),
      ]);
      setTeachers(t);
      setPlans(p);
      setReviews(r);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر تحميل بيانات الإشراف"
            : "Unable to load supervision data",
      );
    } finally {
      setBusy(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const teacherById = useMemo(() => {
    const map = new Map<string, TeacherProfile>();
    for (const t of teachers) map.set(t.id, t);
    return map;
  }, [teachers]);

  const teacherName = useCallback(
    (id: string) => {
      const t = teacherById.get(id);
      return (t?.full_name || t?.email || (isArabic ? "مستخدم غير معروف" : "Unknown user")).trim();
    },
    [teacherById, isArabic],
  );

  const byPlan = useMemo(() => {
    const map = new Map<string, PlanReviewRow[]>();
    for (const r of reviews) map.set(r.plan_id, [...(map.get(r.plan_id) ?? []), r]);
    return map;
  }, [reviews]);

  const subjects = useMemo(
    () => Array.from(new Set(plans.map((p) => p.subject).filter(Boolean))) as string[],
    [plans],
  );
  const grades = useMemo(
    () => Array.from(new Set(plans.map((p) => p.grade).filter(Boolean))) as string[],
    [plans],
  );

  const stats = useMemo(() => {
    const rated = plans.filter((p) => (byPlan.get(p.id) ?? []).length > 0);
    const all = reviews.map((r) => r.rating);
    const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    return {
      teachers: teachers.length,
      plans: plans.length,
      rated: rated.length,
      pending: plans.length - rated.length,
      mine: reviews.filter((r) => r.reviewer_id === me).length,
      avg: avg ? avg.toFixed(1) : "—",
    };
  }, [plans, reviews, byPlan, teachers, me]);

  const filtered = plans.filter((p) => {
    if (teacherId && p.user_id !== teacherId) return false;
    if (subject && p.subject !== subject) return false;
    if (grade && p.grade !== grade) return false;
    if (status && p.status !== status) return false;
    if (q) {
      const hay = `${p.topic ?? ""} ${p.unit ?? ""} ${teacherName(p.user_id)}`;
      if (!hay.includes(q)) return false;
    }
    const list = byPlan.get(p.id) ?? [];
    if (tab === "pending") return list.length === 0;
    if (tab === "mine") return list.some((x) => x.reviewer_id === me);
    return true;
  });

  const exportReviews = () => {
    const head = isArabic
      ? ["المعلم/ة", "الموضوع", "المادة", "الصف", "التقييم", "الملاحظة", "التاريخ"]
      : ["Teacher", "Topic", "Subject", "Grade", "Rating", "Comment", "Date"];
    const planOf = (id: string) => plans.find((p) => p.id === id);
    const body = reviews.map((r) => {
      const p = planOf(r.plan_id);
      return [
        teacherName(r.teacher_id),
        p?.topic ?? "",
        p?.subject ?? "",
        p?.grade ?? "",
        String(r.rating),
        (r.comment || "").replace(/[\n,]/g, " "),
        new Date(r.created_at).toLocaleDateString(isArabic ? "ar" : "en"),
      ].join(",");
    });
    const blob = new Blob(["\uFEFF" + [head.join(","), ...body].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reviews.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (busy)
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-primary">
            <ClipboardCheck className="h-6 w-6 text-gold" />
            {isArabic ? "لوحة الإشراف" : "Supervision Dashboard"}{" "}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isArabic
              ? "كل المعلمين/ات وخطط دروسهم المحفوظة في حساباتهم — قراءة وتقييم فقط."
              : "View teachers and their saved lesson plans — review and evaluation only."}
            {identity
              ? isArabic
                ? ` (المُقيّم: ${identity.name})`
                : ` (Reviewer: ${identity.name})`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            {isArabic ? "تحديث" : "Refresh"}{" "}
          </button>
          <button
            onClick={exportReviews}
            disabled={reviews.length === 0}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isArabic ? "تصدير التقييمات" : "Export Reviews"}{" "}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: isArabic ? "عدد المعلمين/ات" : "Teachers",
            value: stats.teachers,
          },
          {
            label: isArabic ? "إجمالي الخطط" : "Total Plans",
            value: stats.plans,
          },
          {
            label: isArabic ? "بانتظار التقييم" : "Pending Review",
            value: stats.pending,
          },
          {
            label: isArabic ? "متوسط التقييم" : "Average Rating",
            value: stats.avg,
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border bg-card p-4 text-center shadow-[var(--shadow-soft)]"
          >
            <div className="text-2xl font-black text-primary">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      {/* قائمة المعلمات */}
      <section className="mb-6 rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
          <Users className="h-4 w-4 text-gold" />
          {isArabic ? "المعلمات والمعلمون" : "Teachers"}{" "}
        </h2>
        {teachers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {isArabic ? "لا يوجد معلمون مسجَّلون بعد." : "No teachers are registered yet."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTeacherId("")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                teacherId === "" ? "border-gold bg-gold/15 text-gold" : "hover:bg-accent"
              }`}
            >
              {isArabic ? "الكل" : "All"} ({teachers.length})
            </button>
            {teachers.map((t) => {
              const count = plans.filter((p) => p.user_id === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setTeacherId(t.id === teacherId ? "" : t.id)}
                  className={`rounded-lg border px-3 py-1.5 text-start text-xs font-bold ${
                    teacherId === t.id ? "border-gold bg-gold/15 text-gold" : "hover:bg-accent"
                  }`}
                >
                  {t.full_name || t.email}
                  <span className="block text-[10px] font-medium text-muted-foreground">
                    {[t.subject, t.stage, t.school, t.branch].filter(Boolean).join(" · ") || "—"} ·{" "}
                    {count} {count} {isArabic ? "خطة" : count === 1 ? "plan" : "plans"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            {
              v: "all",
              t: isArabic ? `الكل (${stats.plans})` : `All (${stats.plans})`,
            },
            {
              v: "pending",
              t: isArabic
                ? `بانتظار التقييم (${stats.pending})`
                : `Pending Review (${stats.pending})`,
            },
            {
              v: "mine",
              t: isArabic ? `قيّمتها (${stats.mine})` : `Reviewed by Me (${stats.mine})`,
            },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            onClick={() => setTab(o.v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === o.v
                ? "border-gold bg-gold/15 text-gold"
                : "bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            isArabic ? "🔍 بحث بالموضوع أو المعلم/ة..." : "🔍 Search by topic or teacher..."
          }
          className="min-w-[180px] flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">{isArabic ? "كل المواد" : "All Subjects"}</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">{isArabic ? "كل الصفوف" : "All Grades"}</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">{isArabic ? "كل الحالات" : "All Statuses"}</option>

          <option value="draft">{isArabic ? "مسودة" : "Draft"}</option>

          <option value="complete">{isArabic ? "مكتملة" : "Complete"}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isArabic ? "لا توجد خطط مطابقة." : "No matching lesson plans."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const list = byPlan.get(row.id) ?? [];
            const avg = list.length
              ? (list.reduce((a, b) => a + b.rating, 0) / list.length).toFixed(1)
              : null;
            return (
              <article
                key={row.id}
                className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-primary">
                      {row.topic || (isArabic ? "بدون عنوان" : "Untitled Lesson")}{" "}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[teacherName(row.user_id), row.subject, row.grade, row.unit]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {avg ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                        <Star className="h-3 w-3 fill-gold" /> {avg}/5 ({list.length})
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        {isArabic ? "بانتظار التقييم" : "Pending Review"}{" "}
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {statusLabel(row.status)}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {row.completion_pct}%
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {row.content_language === "en" ? "English" : isArabic ? "عربي" : "Arabic"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {row.date
                    ? isArabic
                      ? `تاريخ الدرس: ${row.date} · `
                      : `Lesson date: ${row.date} · `
                    : ""}
                  {isArabic ? "آخر تعديل:" : "Last updated:"} {relativeTime(row.updated_at)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setOpenPlan(row)}
                    className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    {isArabic ? "عرض الخطة كاملة" : "View Full Plan"}
                  </button>

                  <button
                    onClick={() => setAttendancePlan(row)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-xs font-bold text-gold hover:bg-gold/10"
                  >
                    <Users className="h-3.5 w-3.5" />

                    {isArabic ? "الحضور والمتابعة" : "Attendance & Feedback"}
                  </button>
                </div>
                <PlanReview
                  planId={row.id}
                  teacherId={row.user_id}
                  onSaved={() => void refresh()}
                />
              </article>
            );
          })}
        </div>
      )}

      {openPlan && (
        <PlanViewer
          plan={openPlan}
          teacher={teacherName(openPlan.user_id)}
          onClose={() => setOpenPlan(null)}
        />
      )}
      {attendancePlan && (
  <SupervisorAttendanceViewer
    plan={attendancePlan}
    teacher={teacherName(attendancePlan.user_id)}
    onClose={() => setAttendancePlan(null)}
  />
)}
    </main>
  );
}

/** عرض خطة الدرس للمشرف/ة — قراءة فقط بدون أي تعديل */
function PlanViewer({
  plan,
  teacher,
  onClose,
}: {
  plan: SupervisedPlan;
  teacher: string;
  onClose: () => void;
}) {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const phases = Array.isArray(plan.phases) ? (plan.phases as PhaseData[]) : [];

  const outcomes = Array.isArray(plan.outcomes) ? (plan.outcomes as string[]) : [];

  const homework = (plan.homework ?? null) as HomeworkData | null;

  const isEn = plan.content_language === "en";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div
        className="w-full max-w-3xl rounded-2xl border bg-card p-5 shadow-lg"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-primary">
              {plan.topic || (isArabic ? "بدون عنوان" : "Untitled Lesson")}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {[teacher, plan.subject, plan.grade, plan.unit, plan.date]
                .filter(Boolean)
                .join(" · ")}{" "}
              · {isEn ? "English" : isArabic ? "عربي" : "Arabic"} ·{" "}
              {isArabic ? "قراءة فقط" : "Read Only"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border p-2 text-muted-foreground hover:bg-accent"
            title={isArabic ? "إغلاق" : "Close"}
            aria-label={isArabic ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {plan.objectives && (
          <section className="mb-4">
            <h3 className="mb-1 text-sm font-bold text-primary">
              {isArabic ? "الأهداف" : "Objectives"}
            </h3>

            <p className="whitespace-pre-wrap text-sm" dir={isEn ? "ltr" : "rtl"}>
              {plan.objectives}
            </p>
          </section>
        )}

        {outcomes.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-1 text-sm font-bold text-primary">
              {isArabic ? "نواتج التعلم" : "Learning Outcomes"}
            </h3>

            <ul className="list-inside list-disc space-y-1 text-sm" dir={isEn ? "ltr" : "rtl"}>
              {outcomes.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          {phases.map((ph) => {
            const meta = PHASES.find((m) => m.id === ph.id);

            return (
              <div key={ph.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: meta?.color,
                    }}
                  >
                    {meta ? (isArabic ? `${meta.nameAr} · ${meta.nameEn}` : meta.nameEn) : ph.id}
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    {ph.duration} {isArabic ? "دقيقة" : "min"}
                  </span>
                </div>

                <div className="space-y-2 text-sm" dir={isEn ? "ltr" : "rtl"}>
                  {ph.teacherActivity && (
                    <p className="whitespace-pre-wrap">
                      <span className="font-bold text-primary">
                        {isArabic ? "المعلم/ة: " : "Teacher: "}
                      </span>

                      {ph.teacherActivity}
                    </p>
                  )}

                  {ph.teacherQuestions && (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {ph.teacherQuestions}
                    </p>
                  )}

                  {ph.studentActivity && (
                    <p className="whitespace-pre-wrap">
                      <span className="font-bold text-gold">
                        {isArabic ? "الطالب: " : "Student: "}
                      </span>

                      {ph.studentActivity}
                    </p>
                  )}

                  {!ph.teacherActivity && !ph.studentActivity && (
                    <p className="text-xs text-muted-foreground">
                      {isArabic
                        ? "لم تُكتب هذه المرحلة بعد."
                        : "This phase has not been completed yet."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {homework && (homework.teacherNote || homework.studentText) && (
          <section className="mt-4 rounded-xl border p-3">
            <h3 className="mb-1 text-sm font-bold text-primary">
              {isArabic ? "الواجب" : "Homework"}
            </h3>

            <div className="space-y-1 text-sm" dir={isEn ? "ltr" : "rtl"}>
              {homework.teacherNote && (
                <p className="whitespace-pre-wrap">
                  <span className="font-bold text-primary">
                    {isArabic ? "للمعلم: " : "Teacher: "}
                  </span>

                  {homework.teacherNote}
                </p>
              )}

              {homework.studentText && (
                <p className="whitespace-pre-wrap text-muted-foreground">
                  <span className="font-bold text-gold">{isArabic ? "للطالب: " : "Student: "}</span>

                  {homework.studentText}
                </p>
              )}
            </div>
          </section>
        )}

        <div className="mt-5 border-t pt-4">
          <PlanReview planId={plan.id} teacherId={plan.user_id} />
        </div>
      </div>
    </div>
  );
}
/* =========================================================
   SUPERVISOR ATTENDANCE VIEWER
   قراءة فقط
========================================================= */

type SupervisorAttendanceRow = {
  id: string;
  student_id: string;
  status: string;
  understanding_level: string | null;
  feedback: string | null;

  students:
    | {
        full_name: string;
      }
    | {
        full_name: string;
      }[]
    | null;
};

function SupervisorAttendanceViewer({
  plan,
  teacher,
  onClose,
}: {
  plan: SupervisedPlan;
  teacher: string;
  onClose: () => void;
}) {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [rows, setRows] =
    useState<SupervisorAttendanceRow[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        setLoading(true);

        const { data, error } = await (supabase as any)
          .from("lesson_attendance")
          .select(`
            id,
            student_id,
            status,
            understanding_level,
            feedback,
            students (
              full_name
            )
          `)
          .eq("lesson_plan_id", plan.id);

        if (error) {
          throw error;
        }

        setRows(
          (data ?? []) as SupervisorAttendanceRow[],
        );
      } catch (error) {
        console.error(
          "SUPERVISOR ATTENDANCE ERROR:",
          error,
        );

        toast.error(
          isArabic
            ? "تعذّر تحميل سجل الحضور"
            : "Unable to load attendance",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadAttendance();
  }, [plan.id, isArabic]);

  const attendanceLabel = (status: string) => {
    switch (status) {
      case "present":
        return isArabic ? "حاضرة" : "Present";

      case "absent":
        return isArabic ? "غائبة" : "Absent";

      case "late":
        return isArabic ? "متأخرة" : "Late";

      case "excused":
        return isArabic ? "غياب بعذر" : "Excused";

      default:
        return isArabic ? "لم يحدد" : "Not marked";
    }
  };

  const understandingLabel = (
    level: string | null,
  ) => {
    switch (level) {
      case "mastered":
        return isArabic ? "متمكنة" : "Mastered";

      case "good":
        return isArabic ? "جيدة" : "Good";

      case "needs_support":
        return isArabic ? "تحتاج دعم" : "Needs Support";

      case "not_mastered":
        return isArabic
          ? "غير متمكنة"
          : "Not Mastered";

      default:
        return "—";
    }
  };

  const getStudentName = (
    student:
      | { full_name: string }
      | { full_name: string }[]
      | null,
  ) => {
    if (!student) {
      return isArabic ? "طالبة غير معروفة" : "Unknown student";
    }

    if (Array.isArray(student)) {
      return (
        student[0]?.full_name ||
        (isArabic ? "طالبة غير معروفة" : "Unknown student")
      );
    }

    return student.full_name;
  };

  const presentCount = rows.filter(
    (r) => r.status === "present",
  ).length;

  const absentCount = rows.filter(
    (r) => r.status === "absent",
  ).length;

  const lateCount = rows.filter(
    (r) => r.status === "late",
  ).length;

  const needsSupportCount = rows.filter(
    (r) =>
      r.understanding_level === "needs_support" ||
      r.understanding_level === "not_mastered",
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">

      <div
        className="w-full max-w-5xl rounded-2xl border bg-card p-5 shadow-lg"
        dir={isArabic ? "rtl" : "ltr"}
      >

        {/* HEADER */}

        <div className="mb-5 flex items-start justify-between gap-3">

          <div>
            <p className="text-xs font-bold text-gold">
              {isArabic
                ? "الحضور والمتابعة — قراءة فقط"
                : "Attendance & Feedback — Read Only"}
            </p>

            <h2 className="mt-1 text-xl font-black text-primary">
              {plan.topic ||
                (isArabic
                  ? "بدون عنوان"
                  : "Untitled Lesson")}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {teacher}
              {" · "}
              {plan.subject || "—"}
              {" · "}
              {plan.grade || "—"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-2 text-muted-foreground hover:bg-accent"
            title={isArabic ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>

        </div>

        {/* LOADING */}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (

          /* EMPTY */

          <div className="rounded-xl border border-dashed p-8 text-center">

            <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />

            <p className="font-bold">
              {isArabic
                ? "لم تسجل المعلمة الحضور لهذه الحصة بعد"
                : "Attendance has not been recorded for this lesson yet"}
            </p>

          </div>

        ) : (
          <>
            {/* SUMMARY */}

            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">

              <div className="rounded-xl border p-3 text-center">
                <div className="text-xl font-black">
                  {presentCount}
                </div>

                <div className="text-xs text-muted-foreground">
                  {isArabic ? "حاضرات" : "Present"}
                </div>
              </div>

              <div className="rounded-xl border p-3 text-center">
                <div className="text-xl font-black">
                  {absentCount}
                </div>

                <div className="text-xs text-muted-foreground">
                  {isArabic ? "غائبات" : "Absent"}
                </div>
              </div>

              <div className="rounded-xl border p-3 text-center">
                <div className="text-xl font-black">
                  {lateCount}
                </div>

                <div className="text-xs text-muted-foreground">
                  {isArabic ? "متأخرات" : "Late"}
                </div>
              </div>

              <div className="rounded-xl border p-3 text-center">
                <div className="text-xl font-black">
                  {needsSupportCount}
                </div>

                <div className="text-xs text-muted-foreground">
                  {isArabic
                    ? "يحتجن دعمًا"
                    : "Need Support"}
                </div>
              </div>

            </div>

            {/* STUDENTS */}

            <div className="space-y-2">

              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1.5fr_1fr_1fr_2fr]"
                >

                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground">
                      {isArabic ? "الطالبة" : "Student"}
                    </div>

                    <div className="font-bold">
                      {index + 1}.{" "}
                      {getStudentName(row.students)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground">
                      {isArabic ? "الحضور" : "Attendance"}
                    </div>

                    <div className="text-sm font-semibold">
                      {attendanceLabel(row.status)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground">
                      {isArabic
                        ? "مستوى الفهم"
                        : "Understanding"}
                    </div>

                    <div className="text-sm font-semibold">
                      {understandingLabel(
                        row.understanding_level,
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground">
                      {isArabic
                        ? "التغذية الراجعة"
                        : "Feedback"}
                    </div>

                    <div className="text-sm">
                      {row.feedback || "—"}
                    </div>
                  </div>

                </div>
              ))}

            </div>
          </>
        )}

      </div>
    </div>
  );
}
