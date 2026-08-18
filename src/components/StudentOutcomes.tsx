import { useState } from "react";
import type { LessonPlan } from "@/lib/lesson-types";

export function planOutcomes(plan: LessonPlan): string[] {
  if (plan.outcomes && plan.outcomes.length) return plan.outcomes;
  return plan.objectives
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function StudentOutcomes({
  plan,
  size = "md",
}: {
  plan: LessonPlan;
  size?: "sm" | "md";
}) {
  const [checkMode, setCheckMode] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const items = planOutcomes(plan);
  const extracted = Boolean(plan.outcomes && plan.outcomes.length);
  if (!items.length) return null;

  return (
    <div className={`rounded-xl bg-gold/5 ${size === "sm" ? "mb-4 p-3" : "mb-6 p-5"}`}>
      <div className={`mb-2 font-bold text-gold ${size === "sm" ? "text-xs" : "text-base"}`}>
        ماذا سأتعلم اليوم؟
      </div>
      <ul className={size === "sm" ? "space-y-1 text-sm" : "space-y-2 text-lg"}>
        {items.map((o, i) => (
          <li key={i} className="flex gap-2">
            {checkMode ? (
              <button
                type="button"
                onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                className="text-gold"
                aria-label="تحقق"
              >
                {checked[i] ? "☑" : "□"}
              </button>
            ) : (
              <span className="text-gold">{extracted ? "✦" : "•"}</span>
            )}
            <span className={checked[i] ? "line-through opacity-70" : ""}>{o}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setCheckMode((v) => !v)}
        className={`mt-3 rounded-lg border border-gold/40 px-3 py-1.5 font-medium text-gold hover:bg-gold/10 ${
          size === "sm" ? "text-xs" : "text-sm"
        }`}
      >
        {checkMode ? "العودة للعرض" : "في نهاية الحصة — تحقق من نفسك ✓"}
      </button>
    </div>
  );
}
