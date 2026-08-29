import { useUiLanguage } from "@/lib/ui-language";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { useSession } from "@/lib/session";
import {
  applyBundleLocally,
  deletePlan,
  duplicatePlan,
  getPlan,
  listPlans,
  relativeTime,
  rowToBundle,
  type PlanRow,
} from "@/lib/plans-db";
import { emptyPlan } from "@/lib/lesson-types";
import PlanReviewBadge from "@/components/PlanReviewBadge";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحتي — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content: "خطط دروسك المحفوظة باسمك مع نسبة الاكتمال والبحث والتصفية.",
      },
      { property: "og:title", content: "لوحتي — المدرسة الرمز" },
      { property: "og:description", content: "كل خطط دروس 5E الخاصة بك في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const { loading, identity } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  const name = identity?.name;

  const refresh = useCallback(async () => {
    if (!name) return;

    try {
      setRows(await listPlans());
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر تحميل الخطط"
            : "Unable to load lesson plans",
      );
    } finally {
      setBusy(false);
    }
  }, [name, isArabic]);

  useEffect(() => {
    if (loading) return;

    if (!name) {
      window.location.replace("/auth");
      return;
    }

    refresh();
  }, [loading, name, refresh]);

  const subjects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.subject).filter(Boolean) as string[])),
    [rows],
  );

  const grades = useMemo(
    () => Array.from(new Set(rows.map((r) => r.grade).filter(Boolean) as string[])),
    [rows],
  );

  const filtered = rows.filter(
    (r) =>
      (!q || (r.topic ?? "").includes(q)) &&
      (!status || r.status === status) &&
      (!subject || r.subject === subject) &&
      (!grade || r.grade === grade),
  );

  const counts = {
    all: rows.length,
    draft: rows.filter((r) => r.status === "draft").length,
    complete: rows.filter((r) => r.status === "complete").length,
  };

  const open = async (row: PlanRow) => {
    try {
      const fresh = await getPlan(row.id);

      if (!fresh) {
        toast.error(isArabic ? "لم يتم العثور على الخطة" : "Lesson plan not found");
        return;
      }

      applyBundleLocally(rowToBundle(fresh));

      navigate({
        to: "/planning",
      });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر فتح الخطة"
            : "Unable to open the lesson plan",
      );
    }
  };

  const newPlan = () => {
    localStorage.setItem("rz_current", JSON.stringify(emptyPlan()));

    navigate({
      to: "/planning",
    });
  };

  if (loading || busy) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-primary">
            {isArabic ? `مرحباً ${name} 👋` : `Welcome, ${name} 👋`}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {[identity?.subject, identity?.stage, identity?.school].filter(Boolean).join(" · ") ||
              (isArabic
                ? "يمكنك تحديث بياناتك من صفحة الاسم"
                : "You can update your information from your profile page")}
          </p>
        </div>

        <button
          onClick={newPlan}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />

          {isArabic ? "خطة جديدة" : "New Plan"}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          {
            label: isArabic ? "الكل" : "All",
            value: counts.all,
          },
          {
            label: isArabic ? "مسودة" : "Draft",
            value: counts.draft,
          },
          {
            label: isArabic ? "مكتملة" : "Complete",
            value: counts.complete,
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

      <div className="mb-5 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isArabic ? "🔍 بحث بالموضوع..." : "🔍 Search by topic..."}
          className="min-w-[180px] flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />

        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">{isArabic ? "المادة" : "Subject"}</option>

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
          <option value="">{isArabic ? "الصف" : "Grade"}</option>

          {grades.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">{isArabic ? "الحالة" : "Status"}</option>

          <option value="draft">{isArabic ? "مسودة" : "Draft"}</option>

          <option value="complete">{isArabic ? "مكتملة" : "Complete"}</option>
        </select>
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">
        {isArabic ? "خططي الدراسية" : "My Lesson Plans"}
      </h2>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isArabic
            ? "لا توجد خطط بعد — ابدأ بخطة جديدة."
            : "No lesson plans yet — start by creating a new plan."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-primary">
                    {row.topic || (isArabic ? "بدون عنوان" : "Untitled Lesson")}
                  </h3>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[row.subject, row.grade].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    row.status === "complete"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {row.status === "complete"
                    ? isArabic
                      ? "مكتملة"
                      : "Complete"
                    : isArabic
                      ? "مسودة"
                      : "Draft"}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gold"
                    style={{
                      width: `${row.completion_pct}%`,
                    }}
                  />
                </div>

                <span className="text-xs font-bold text-muted-foreground">
                  {row.completion_pct}%
                </span>
              </div>

              <p className="mt-2 text-[11px] text-muted-foreground">
                {isArabic ? "آخر تعديل:" : "Last updated:"} {relativeTime(row.updated_at)}
              </p>

              <PlanReviewBadge planId={row.id} />

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => open(row)}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <FolderOpen className="h-3.5 w-3.5" />

                  {isArabic ? "فتح" : "Open"}
                </button>

                <button
                  onClick={async () => {
                    await duplicatePlan(row.id);

                    await refresh();

                    toast.success(isArabic ? "تم نسخ الخطة" : "Lesson plan duplicated");
                  }}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" />

                  {isArabic ? "نسخ" : "Duplicate"}
                </button>

                <button
                  onClick={async () => {
                    if (!confirm(isArabic ? "حذف هذه الخطة؟" : "Delete this lesson plan?")) {
                      return;
                    }

                    await deletePlan(row.id);

                    await refresh();

                    toast.success(isArabic ? "تم الحذف" : "Lesson plan deleted");
                  }}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />

                  {isArabic ? "حذف" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
