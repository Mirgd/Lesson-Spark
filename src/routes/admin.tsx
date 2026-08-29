import { useUiLanguage } from "@/lib/ui-language";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { listStaffDirectory, setTeacherSupervisorRole, type StaffMember } from "@/lib/supervision";
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
function rolesLabel(roles: AppRole[], isArabic: boolean): string {
  const labels: Record<AppRole, { ar: string; en: string }> = {
    teacher: {
      ar: "معلم/ة",
      en: "Teacher",
    },
    supervisor: {
      ar: "مشرف/ة",
      en: "Supervisor",
    },
    school_admin: {
      ar: "إدارة المدرسة",
      en: "School Admin",
    },
    admin: {
      ar: "مدير النظام",
      en: "Admin",
    },
  };

  const actualRoles = roles.length > 0 ? roles : (["teacher"] as AppRole[]);

  const order: AppRole[] = ["teacher", "supervisor", "school_admin", "admin"];

  return order
    .filter((role) => actualRoles.includes(role))
    .map((role) => (isArabic ? labels[role].ar : labels[role].en))
    .join(" · ");
}
function AdminPage() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [totals, setTotals] = useState({
    plans: 0,
    completed: 0,
  });
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");

  const [changingRole, setChangingRole] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);

    try {
      const dir = await listStaffDirectory();

      setMembers(dir.members);

      setTotals({
        plans: dir.totalPlans,
        completed: dir.completedPlans,
      });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر تحميل البيانات"
            : "Unable to load staff data",
      );
    } finally {
      setBusy(false);
    }
  }, [isArabic]);

  const toggleSupervisorRole = async (member: StaffMember) => {
    const isSupervisor = member.roles.includes("supervisor");

    setChangingRole(member.id);

    try {
      await setTeacherSupervisorRole(member.id, isSupervisor ? "teacher" : "supervisor");

      toast.success(
        isArabic
          ? isSupervisor
            ? "تمت إعادة الحساب إلى معلم/ة"
            : "تمت ترقية الحساب إلى مشرف/ة"
          : isSupervisor
            ? "User changed back to Teacher"
            : "User promoted to Supervisor",
      );

      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر تعديل الصلاحية"
            : "Unable to update role",
      );
    } finally {
      setChangingRole(null);
    }
  };

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
    const head = [
      "الاسم",
      "البريد",
      "الأدوار",
      "المدرسة",
      "الفرع",
      "المرحلة",
      "المادة",
      "عدد الخطط",
      "خطط مكتملة",
    ];
    const body = rows.map((r) =>
      [
        r.full_name,
        r.email,
        rolesLabel(r.roles, isArabic),
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
            <Users className="h-6 w-6 text-gold" />
            {isArabic ? "بيانات الكادر التعليمي" : "Staff Directory"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {isArabic
              ? "تُقرأ البيانات من الحسابات المسجَّلة وأدوارها وخطط دروسها."
              : "View registered staff accounts, roles, and lesson plans."}
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
            onClick={csv}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            {isArabic ? "تصدير Excel" : "Export Excel"}
          </button>
          <Link
            to="/supervisor"
            className="rounded-lg border border-gold bg-gold/10 px-3 py-2 text-sm font-bold text-gold hover:bg-gold hover:text-white"
          >
            {isArabic ? "تقييم الخطط" : "Review Plans"}{" "}
          </Link>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {
            label: isArabic ? "عدد المستخدمين" : "Users",
            value: members.length,
          },
          {
            label: isArabic ? "عدد الخطط" : "Plans",
            value: totals.plans,
          },
          {
            label: isArabic ? "خطط مكتملة" : "Completed Plans",
            value: totals.completed,
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

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          isArabic
            ? "🔍 بحث بالاسم أو البريد أو المدرسة أو المادة..."
            : "🔍 Search by name, email, school, or subject..."
        }
        className="mb-4 w-full rounded-lg border bg-background px-3 py-2 text-sm"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isArabic ? "لا توجد حسابات مطابقة." : "No matching accounts found."}{" "}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">{isArabic ? "الاسم" : "Name"}</th>

                <th className="px-3 py-2 font-bold">
                  {isArabic ? "الدور / الأدوار" : "Role / Roles"}
                </th>

                <th className="px-3 py-2 font-bold">
                  {isArabic ? "تعديل الصلاحية" : "Change Role"}
                </th>

                <th className="px-3 py-2 font-bold">{isArabic ? "المدرسة" : "School"}</th>

                <th className="px-3 py-2 font-bold">{isArabic ? "المرحلة" : "Stage"}</th>

                <th className="px-3 py-2 font-bold">{isArabic ? "المادة" : "Subject"}</th>

                <th className="px-3 py-2 font-bold">{isArabic ? "الخطط" : "Plans"}</th>

                <th className="px-3 py-2 font-bold">{isArabic ? "آخر تحديث" : "Last Updated"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-bold text-primary">
                      {r.full_name || (isArabic ? "بدون اسم" : "No name")}
                    </div>

                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {r.email}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{rolesLabel(r.roles, isArabic)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void toggleSupervisorRole(r)}
                      disabled={changingRole === r.id}
                      className="whitespace-nowrap rounded-lg border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold transition-colors hover:bg-gold hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {changingRole === r.id
                        ? isArabic
                          ? "جارٍ التعديل..."
                          : "Updating..."
                        : r.roles.includes("supervisor")
                          ? isArabic
                            ? "تحويل إلى معلم/ة"
                            : "Make Teacher"
                          : isArabic
                            ? "تعيين كمشرف/ة"
                            : "Make Supervisor"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {[r.school, r.branch].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2">{r.stage || "—"}</td>
                  <td className="px-3 py-2">{r.subject || "—"}</td>
                  <td className="px-3 py-2 font-bold">
                    {r.completed > 0 && (
                      <span className="ms-1 text-xs font-normal text-muted-foreground">
                        ({isArabic ? `${r.completed} مكتملة` : `${r.completed} completed`})
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
