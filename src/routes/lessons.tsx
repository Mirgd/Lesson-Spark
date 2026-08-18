import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import {
  applyBundleLocally,
  deletePlan,
  duplicatePlan,
  getPlan,
  listPlans,
  rowToBundle,
  type PlanRow,
} from "@/lib/plans-db";
import { NewLessonButton } from "@/components/NewLessonButton";

export const Route = createFileRoute("/lessons")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دروسي — المدرسة الرمز · التعلم العميق" },
      { name: "description", content: "دروسك المحفوظة في حسابك فقط." },
      { property: "og:title", content: "دروسي — المدرسة الرمز" },
      { property: "og:description", content: "قائمة خطط الدروس الخاصة بحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lessons,
});

function Lessons() {
  const { loading, identity } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(true);

  const userId = identity?.user.id;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      // دروسي = خطط المستخدم المسجَّل فقط (user_id = auth.uid())
      setRows(await listPlans());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحميل الدروس");
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      window.location.replace("/auth");
      return;
    }
    void refresh();
  }, [loading, userId, refresh]);

  const open = async (row: PlanRow) => {
    try {
      const fresh = await getPlan(row.id);
      if (!fresh) {
        toast.error("لم يتم العثور على الخطة");
        return;
      }
      applyBundleLocally(rowToBundle(fresh));
      navigate({ to: "/planning" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر فتح الدرس");
    }
  };

  const duplicate = async (row: PlanRow) => {
    try {
      await duplicatePlan(row.id);
      toast.success("تم نسخ الدرس");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر النسخ");
    }
  };

  const remove = async (row: PlanRow) => {
    try {
      await deletePlan(row.id);
      toast.success("تم الحذف");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحذف");
    }
  };

  if (loading || busy)
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-primary">دروسي</h1>
          <p className="mt-1 text-sm text-muted-foreground">دروسك المحفوظة في حسابك.</p>
        </div>
        <NewLessonButton variant="primary" label="ابدأ درساً جديداً" />
      </header>

      {rows.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <p className="text-lg font-medium">لم تُخطط بعد</p>
          <p className="mt-1 text-sm text-muted-foreground">درسك القادم على بُعد دقيقتين ✦</p>
          <Link
            to="/planning"
            className="mt-5 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            ابدأ التخطيط
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="card-elevated flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-primary">{r.topic || "بدون موضوع"}</div>
                <div className="text-xs text-muted-foreground">
                  {r.subject || "—"} · {r.grade || "—"} ·{" "}
                  {new Date(r.updated_at).toLocaleDateString("ar")}
                </div>
              </div>
              <button onClick={() => void open(r)} className={btnGhost}>
                <FolderOpen className="h-4 w-4" /> فتح
              </button>
              <button onClick={() => void duplicate(r)} className={btnGhost}>
                <Copy className="h-4 w-4" /> نسخ
              </button>
              <button
                onClick={() => void remove(r)}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-accent";
