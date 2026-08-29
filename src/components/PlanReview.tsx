import { useUiLanguage } from "@/lib/ui-language";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Star, Trash2 } from "lucide-react";
import {
  listPlanReviews,
  upsertPlanReview,
  type PlanReviewRow,
} from "@/lib/supervision";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

/**
 * تقييم خطة درس
 * المشرف/ة يستطيع:
 * - إضافة تقييم
 * - تعديل تقييمه
 * - حذف تقييمه فقط
 *
 * تقييمات المشرفين الآخرين تظهر للقراءة فقط.
 */
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
  const [deleting, setDeleting] = useState(false);

  /* =========================================================
     LOAD REVIEWS
  ========================================================= */

  const load = async () => {
    try {
      const all = await listPlanReviews();

      const list = all.filter(
        (r) => r.plan_id === planId,
      );

      setRows(list);

      const mine = list.find(
        (r) => r.reviewer_id === reviewerId,
      );

      if (mine) {
        setRating(mine.rating);
        setComment(mine.comment ?? "");
      } else {
        /*
         * إذا لم يعد هناك تقييم للمشرفة الحالية
         * نفرغ الحقول.
         */
        setRating(0);
        setComment("");
      }
    } catch (error) {
      console.error("LOAD PLAN REVIEWS ERROR:", error);
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

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

  /* =========================================================
     MY REVIEW
  ========================================================= */

  const myReview = rows.find(
    (r) => r.reviewer_id === reviewerId,
  );

  const others = rows.filter(
    (r) => r.reviewer_id !== reviewerId,
  );

  /* =========================================================
     SAVE / UPDATE REVIEW
  ========================================================= */

  const save = async () => {
    if (!rating) {
      toast.error(
        isArabic
          ? "اختر درجة التقييم أولاً"
          : "Select a rating first",
      );

      return;
    }

    if (!reviewerId) {
      toast.error(
        isArabic
          ? "سجّل الدخول أولاً"
          : "Please sign in first",
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
        myReview
          ? isArabic
            ? "تم تحديث التقييم"
            : "Review updated successfully"
          : isArabic
            ? "تم حفظ التقييم"
            : "Review saved successfully",
      );

      await load();

      onSaved?.();
    } catch (error) {
      console.error("SAVE REVIEW ERROR:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذّر حفظ التقييم"
            : "Unable to save the review",
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     DELETE MY REVIEW
  ========================================================= */

  const deleteMyReview = async () => {
    if (!myReview) {
      return;
    }

    if (!reviewerId) {
      toast.error(
        isArabic
          ? "سجّل الدخول أولاً"
          : "Please sign in first",
      );

      return;
    }

    const confirmed = window.confirm(
      isArabic
        ? "هل أنتِ متأكدة من حذف تقييمك لهذه الخطة؟ لن يؤثر ذلك على تقييمات المشرفات الأخريات."
        : "Are you sure you want to delete your review? Other supervisors' reviews will not be affected.",
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const { error } = await (supabase as any)
        .from("plan_reviews")
        .delete()
        .eq("id", myReview.id)
        .eq("reviewer_id", reviewerId);

      if (error) {
        throw error;
      }

      /*
       * نفرغ تقييم المشرفة من الواجهة مباشرة.
       */
      setRating(0);
      setComment("");

      /*
       * ثم نعيد تحميل التقييمات من قاعدة البيانات.
       */
      await load();

      toast.success(
        isArabic
          ? "تم حذف التقييم"
          : "Review deleted successfully",
      );

      /*
       * نخبر الصفحة الأم حتى تحدث البيانات أيضًا.
       */
      onSaved?.();
    } catch (error) {
      console.error(
        "DELETE REVIEW ERROR:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذّر حذف التقييم"
            : "Unable to delete review",
      );
    } finally {
      setDeleting(false);
    }
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (busy) {
    return (
      <Loader2 className="mt-3 h-4 w-4 animate-spin text-primary" />
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="mt-3 border-t pt-3">

      {/* عنوان التقييم + النجوم */}
      <div className="mb-2 flex flex-wrap items-center gap-2">

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
              disabled={saving || deleting}
              title={`${n}/5`}
              aria-label={
                isArabic
                  ? `تقييم ${n} من 5`
                  : `Rate ${n} out of 5`
              }
              className="disabled:opacity-50"
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

        {myReview && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
            {isArabic
              ? "تم التقييم"
              : "Reviewed"}
          </span>
        )}

      </div>

      {/* الملاحظة */}
      <textarea
        value={comment}
        onChange={(e) =>
          setComment(e.target.value)
        }
        disabled={saving || deleting}
        rows={2}
        placeholder={
          isArabic
            ? "ملاحظة لصاحب الخطة..."
            : "Add a note for the plan owner..."
        }
        className="w-full rounded-lg border bg-background p-2 text-xs disabled:opacity-60"
      />

      {/* الأزرار */}
      <div className="mt-2 flex flex-wrap items-center gap-2">

        {/* حفظ / تحديث */}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || deleting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {saving && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}

          {saving
            ? isArabic
              ? "جارٍ الحفظ..."
              : "Saving..."
            : myReview
              ? isArabic
                ? "تحديث التقييم"
                : "Update Review"
              : isArabic
                ? "حفظ التقييم"
                : "Save Review"}
        </button>

        {/* حذف تقييم المشرفة الحالية فقط */}
        {myReview && (
          <button
            type="button"
            onClick={() =>
              void deleteMyReview()
            }
            disabled={saving || deleting}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}

            {deleting
              ? isArabic
                ? "جارٍ الحذف..."
                : "Deleting..."
              : isArabic
                ? "حذف التقييم"
                : "Delete Review"}
          </button>
        )}

      </div>

      {/* تقييمات المشرفين الآخرين */}
      {others.length > 0 && (
        <div className="mt-3">

          <p className="mb-2 text-[11px] font-bold text-muted-foreground">
            {isArabic
              ? "تقييمات المشرفات الأخريات"
              : "Other Supervisors' Reviews"}
          </p>

          <ul className="space-y-2">

            {others.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border bg-muted/30 p-2 text-[11px]"
              >
                <div className="font-bold text-primary">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                  {" "}
                  {r.rating}/5
                </div>

                <div className="mt-1 text-muted-foreground">
                  {r.comment ||
                    (isArabic
                      ? "بدون ملاحظة"
                      : "No comment")}
                </div>

                <div className="mt-1 text-[10px] text-muted-foreground">
                  {isArabic
                    ? "تقييم مشرف/ة آخر — للقراءة فقط"
                    : "Another supervisor's review — read only"}
                </div>
              </li>
            ))}

          </ul>

        </div>
      )}

    </div>
  );
}