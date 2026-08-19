import { useUiLanguage } from "@/lib/ui-language";
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
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

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

      const list = all.filter(
        (r) => r.plan_id === planId
      );

      setRows(list);

      const mine = list.find(
        (r) => r.reviewer_id === reviewerId
      );

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

      if (alive) {
        setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, reviewerId]);

  const save = async () => {
    if (!rating) {
      toast.error(
        isArabic
          ? "اختر درجة التقييم أولاً"
          : "Select a rating first"
      );

      return;
    }

    if (!reviewerId) {
      toast.error(
        isArabic
          ? "سجّل الدخول أولاً"
          : "Please sign in first"
      );

      return;
    }

    setSaving(true);

    try {
      await upsertPlanReview({
        planId,
        teacherId,
        rating,
        comment,
      });

      toast.success(
        isArabic
          ? "تم حفظ التقييم"
          : "Review saved successfully"
      );

      await load();
      onSaved?.();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر حفظ التقييم"
            : "Unable to save the review"
      );
    } finally {
      setSaving(false);
    }
  };

  if (busy) {
    return (
      <Loader2 className="mt-3 h-4 w-4 animate-spin text-primary" />
    );
  }

  const others = rows.filter(
    (r) => r.reviewer_id !== reviewerId
  );

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold text-primary">
          {isArabic
            ? "تقييم الخطة"
            : "Plan Review"}
        </span>

        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              title={`${n}/5`}
              aria-label={
                isArabic
                  ? `تقييم ${n} من 5`
                  : `Rate ${n} out of 5`
              }
            >
              <Star
                className={`h-4 w-4 ${
                  n <= rating
                    ? "fill-gold text-gold"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={comment}
        onChange={(e) =>
          setComment(e.target.value)
        }
        rows={2}
        placeholder={
          isArabic
            ? "ملاحظة لصاحب الخطة..."
            : "Add a note for the plan owner..."
        }
        className="w-full rounded-lg border bg-background p-2 text-xs"
      />

      <button
        onClick={save}
        disabled={saving}
        className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        {saving
          ? isArabic
            ? "جارٍ الحفظ..."
            : "Saving..."
          : isArabic
            ? "حفظ التقييم"
            : "Save Review"}
      </button>

      {others.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          {others.map((r) => (
            <li key={r.id}>
              ★ {r.rating}/5 —{" "}
              {r.comment ||
                (isArabic
                  ? "بدون ملاحظة"
                  : "No comment")}{" "}
              (
              {isArabic
                ? "تقييم مشرف/ة آخر"
                : "Another supervisor's review"}
              )
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
