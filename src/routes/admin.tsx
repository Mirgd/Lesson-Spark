import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { listStaffDirectory, type StaffMember } from "@/lib/supervision";
import { ROLE_LABEL, type AppRole } from "@/lib/session";
import { relativeTime } from "@/lib/plans-db";
import SupervisorOnly from "@/components/SupervisorOnly";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "بيانات الكادر التعليمي — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content: "سجل بيانات الكادر التعليمي وعدد خطط الدروس المحفوظة لكل حساب في المدرسة الرمز.",
      },
      { property: "og:title", content: "بيانات الكادر التعليمي — المدرسة الرمز" },
      { property: "og:description", content: "سجل حسابات الكادر التعليمي وخططهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <AdminPage />
    </SupervisorOnly>
  ),
});

/** الأدوار بالعربية — حساب واحد قد يحمل أكثر من دور */
function rolesLabel(roles: AppRole[]): string {
  if (roles.length === 0) return ROLE_LABEL.teacher;
  const order: AppRole[] = ["teacher", "supervisor", "school_admin", "admin"];
  return order
    .filter((r) => roles.includes(r))
    .map((r) => ROLE_LABEL[r])
    .join(" · ");
}

function AdminPage() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [totals, setTotals] = useState({ plans: 0, completed: 0 });
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const dir = await listStaffDirectory();
      setMembers(dir.members);
      setTotals({ plans: dir.totalPlans, completed: dir.completedPlans });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحميل البيانات");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(() => {
    const term = q.trim();
    if (!term) return members;
    return members.filter((m) =>
      [m.full_name, m.email, m.school ?? "", m.subject ?? ""].some((v) => v.includes(term)),
    );
  }, [members, q]);

  const csv = () => {
    const head = ["الاسم", "البريد", "الأدوار", "المدرسة", "الفرع", "المرحلة", "المادة", "عدد الخطط", "خطط مكتملة"];
    const body = rows.map((r) =>
      [
        r.full_name,
        r.email,
        rolesLabel(r.roles),
        r.school ?? "",
        r.branch ?? "",
        r.stage ?? "",
        r.subject ?? "",
        String(r.plans),
        String(r.completed),
      ].join(","),
    );
    const blob = new Blob(["\uFEFF" + [head.join(","), ...body].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff.csv";
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-primary">
            <Users className="h-6 w-6 text-gold" /> بيانات الكادر التعليمي
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُقرأ البيانات من الحسابات المسجَّلة وأدوارها وخطط دروسها.
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
            onClick={csv}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            تصدير Excel
          </button>
          <Link
            to="/supervisor"
            className="rounded-lg border border-gold bg-gold/10 px-3 py-2 text-sm font-bold text-gold hover:bg-gold hover:text-white"
          >
            تقييم الخطط
          </Link>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "عدد المستخدمين", value: members.length },
          { label: "عدد الخطط", value: totals.plans },
          { label: "خطط مكتملة", value: totals.completed },
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

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 بحث بالاسم أو البريد أو المدرسة أو المادة..."
        className="mb-4 w-full rounded-lg border bg-background px-3 py-2 text-sm"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          لا توجد حسابات مطابقة.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">الاسم</th>
                <th className="px-3 py-2 font-bold">الدور / الأدوار</th>
                <th className="px-3 py-2 font-bold">المدرسة</th>
                <th className="px-3 py-2 font-bold">المرحلة</th>
                <th className="px-3 py-2 font-bold">المادة</th>
                <th className="px-3 py-2 font-bold">الخطط</th>
                <th className="px-3 py-2 font-bold">آخر تحديث</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-bold text-primary">{r.full_name || "بدون اسم"}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {r.email}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{rolesLabel(r.roles)}</td>
                  <td className="px-3 py-2">
                    {[r.school, r.branch].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2">{r.stage || "—"}</td>
                  <td className="px-3 py-2">{r.subject || "—"}</td>
                  <td className="px-3 py-2 font-bold">
                    {r.plans}
                    {r.completed > 0 && (
                      <span className="ms-1 text-xs font-normal text-muted-foreground">
                        ({r.completed} مكتملة)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.last_updated ? relativeTime(r.last_updated) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
