import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** عرض ملاحظات الإشراف على خطة المعلم/ة — من public.plan_reviews */
export default function PlanReviewBadge({ planId }: { planId: string }) {
  const [rows, setRows] = useState<{ id: string; rating: number; comment: string }[]>([]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("plan_reviews")
      .select("id, rating, comment")
      .eq("plan_id", planId)
      .then(({ data }) => {
        if (alive) setRows(data ?? []);
      });
    return () => {
      alive = false;
    };
  }, [planId]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg bg-muted/50 p-2 text-[11px]">
      <div className="font-bold text-primary">تقييم الإشراف</div>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {rows.map((r) => (
          <li key={r.id}>
            ★ {r.rating}/5 — {r.comment || "بدون ملاحظة"}
          </li>
        ))}
      </ul>
    </div>
  );
}
