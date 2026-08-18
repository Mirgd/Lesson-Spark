import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
import { listPlanReviews, upsertPlanReview, type PlanReviewRow } from "@/lib/supervision";
import { useSession } from "@/lib/session";

/** تقييم خطة درس مصادَق عليها — يُكتب في public.plan_reviews باسم المشرف/ة المسجَّل */
export default function PlanReview({
  planId,
  teacherId,
  onSaved,
}: {
  planId: string;
  teacherId: string;
  onSaved?: () => void;
}) {
  const { identity } = useSession();
  const reviewerId = identity?.user.id ?? "";
  const [rows, setRows] = useState<PlanReviewRow[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const all = await listPlanReviews();
      const list = all.filter((r) => r.plan_id === planId);
      setRows(list);
      const mine = list.find((r) => r.reviewer_id === reviewerId);
      if (mine) {
        setRating(mine.rating);
        setComment(mine.comment);
      }
    } catch {
      /* تظهر رسالة الخطأ عند الحفظ */
    }
  };

  useEffect(() => {
    let alive = true;
    setBusy(true);
    void (async () => {
      await load();
      if (alive) setBusy(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, reviewerId]);

  const save = async () => {
    if (!rating) {
      toast.error("اختر درجة التقييم أولاً");
      return;
    }
    if (!reviewerId) {
      toast.error("سجّل الدخول أولاً");
      return;
    }
    setSaving(true);
    try {
      await upsertPlanReview({ planId, teacherId, rating, comment });
      toast.success("تم حفظ التقييم");
      await load();
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر حفظ التقييم");
    } finally {
      setSaving(false);
    }
  };

  if (busy) return <Loader2 className="mt-3 h-4 w-4 animate-spin text-primary" />;

  const others = rows.filter((r) => r.reviewer_id !== reviewerId);

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold text-primary">تقييم الخطة</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} title={`${n}/5`}>
              <Star
                className={`h-4 w-4 ${n <= rating ? "fill-gold text-gold" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="ملاحظة لصاحب الخطة..."
        className="w-full rounded-lg border bg-background p-2 text-xs"
      />
      <button
        onClick={save}
        disabled={saving}
        className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "جارٍ الحفظ..." : "حفظ التقييم"}
      </button>

      {others.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          {others.map((r) => (
            <li key={r.id}>
              ★ {r.rating}/5 — {r.comment || "بدون ملاحظة"} (تقييم مشرف/ة آخر)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
