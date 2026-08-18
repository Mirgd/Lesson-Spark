import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import type { LessonPlan } from "@/lib/lesson-types";
import { currentBundle, upsertPlan } from "@/lib/plans-db";
import { useSession } from "@/lib/session";

/** حفظ تلقائي للخطة بالاسم (كل تعديل + كل ٣٠ ثانية) */
export function PlanAutoSave({ plan }: { plan: LessonPlan }) {
  const { identity } = useSession();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = identity?.name;

  useEffect(() => {
    if (!name) return;
    const run = async () => {
      setState("saving");
      try {
        await upsertPlan(currentBundle(plan));
        setState("saved");
      } catch {
        setState("error");
      }
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, 1500);
    const interval = setInterval(run, 30000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      clearInterval(interval);
    };
  }, [plan, name]);

  if (!name) return null;

  return (
    <div className="no-print flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
      {state === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> جارٍ الحفظ...
        </>
      )}
      {state === "saved" && (
        <>
          <Cloud className="h-3 w-3 text-emerald-600" /> تم الحفظ باسم {name}
        </>
      )}
      {state === "error" && (
        <>
          <CloudOff className="h-3 w-3 text-red-600" /> تعذّر الحفظ
        </>
      )}
    </div>
  );
}
