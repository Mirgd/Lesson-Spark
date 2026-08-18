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

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [t, p, r] = await Promise.all([listTeacherProfiles(), listAllPlans(), listPlanReviews()]);
      setTeachers(t);
      setPlans(p);
      setReviews(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحميل بيانات الإشراف");
    } finally {
      setBusy(false);
    }
  }, []);

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
      return (t?.full_name || t?.email || "مستخدم غير معروف").trim();
    },
    [teacherById],
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
    const head = ["المعلم/ة", "الموضوع", "المادة", "الصف", "التقييم", "الملاحظة", "التاريخ"];
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
        new Date(r.created_at).toLocaleDateString("ar"),
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
            <ClipboardCheck className="h-6 w-6 text-gold" /> لوحة الإشراف
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل المعلمين/ات وخطط دروسهم المحفوظة في حساباتهم — قراءة وتقييم فقط.
            {identity ? ` (المُقيّم: ${identity.name})` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> تحديث
          </button>
          <button
            onClick={exportReviews}
            disabled={reviews.length === 0}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            تصدير التقييمات
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "عدد المعلمين/ات", value: stats.teachers },
          { label: "إجمالي الخطط", value: stats.plans },
          { label: "بانتظار التقييم", value: stats.pending },
          { label: "متوسط التقييم", value: stats.avg },
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
          <Users className="h-4 w-4 text-gold" /> المعلمات والمعلمون
        </h2>
        {teachers.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا يوجد معلمون مسجَّلون بعد.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTeacherId("")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                teacherId === "" ? "border-gold bg-gold/15 text-gold" : "hover:bg-accent"
              }`}
            >
              الكل ({teachers.length})
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
                    {count} خطة
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
            { v: "all", t: `الكل (${stats.plans})` },
            { v: "pending", t: `بانتظار التقييم (${stats.pending})` },
            { v: "mine", t: `قيّمتها (${stats.mine})` },
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
          placeholder="🔍 بحث بالموضوع أو المعلم/ة..."
          className="min-w-[180px] flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">كل المواد</option>
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
          <option value="">كل الصفوف</option>
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
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="complete">مكتملة</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          لا توجد خطط مطابقة.
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
                      {row.topic || "بدون عنوان"}
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
                        بانتظار التقييم
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {row.completion_pct}%
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {row.content_language === "en" ? "English" : "عربي"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {row.date ? `تاريخ الدرس: ${row.date} · ` : ""}آخر تعديل:{" "}
                  {relativeTime(row.updated_at)}
                </p>
                <button
                  onClick={() => setOpenPlan(row)}
                  className="mt-3 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  عرض الخطة كاملة
                </button>
                <PlanReview planId={row.id} teacherId={row.user_id} onSaved={() => void refresh()} />
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
  const phases = Array.isArray(plan.phases) ? (plan.phases as PhaseData[]) : [];
  const outcomes = Array.isArray(plan.outcomes) ? (plan.outcomes as string[]) : [];
  const homework = (plan.homework ?? null) as HomeworkData | null;
  const isEn = plan.content_language === "en";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-primary">{plan.topic || "بدون عنوان"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {[teacher, plan.subject, plan.grade, plan.unit, plan.date]
                .filter(Boolean)
                .join(" · ")}{" "}
              · {isEn ? "English" : "عربي"} · قراءة فقط
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border p-2 text-muted-foreground hover:bg-accent"
            title="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {plan.objectives && (
          <section className="mb-4">
            <h3 className="mb-1 text-sm font-bold text-primary">الأهداف</h3>
            <p className="whitespace-pre-wrap text-sm" dir={isEn ? "ltr" : "rtl"}>
              {plan.objectives}
            </p>
          </section>
        )}

        {outcomes.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-1 text-sm font-bold text-primary">نواتج التعلم</h3>
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
                  <span className="text-sm font-bold" style={{ color: meta?.color }}>
                    {meta?.nameAr} · {meta?.nameEn}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{ph.duration} دقيقة</span>
                </div>
                <div className="space-y-2 text-sm" dir={isEn ? "ltr" : "rtl"}>
                  {ph.teacherActivity && (
                    <p className="whitespace-pre-wrap">
                      <span className="font-bold text-primary">المعلم/ة: </span>
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
                      <span className="font-bold text-gold">الطالب: </span>
                      {ph.studentActivity}
                    </p>
                  )}
                  {!ph.teacherActivity && !ph.studentActivity && (
                    <p className="text-xs text-muted-foreground">لم تُكتب هذه المرحلة بعد.</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {homework && (homework.teacherNote || homework.studentText) && (
          <section className="mt-4 rounded-xl border p-3">
            <h3 className="mb-1 text-sm font-bold text-primary">الواجب</h3>
            <div className="space-y-1 text-sm" dir={isEn ? "ltr" : "rtl"}>
              {homework.teacherNote && <p className="whitespace-pre-wrap">{homework.teacherNote}</p>}
              {homework.studentText && (
                <p className="whitespace-pre-wrap text-muted-foreground">{homework.studentText}</p>
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
