import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { emptyPlan, useCurrentPlan, useSavedLessons, completionRatio } from "@/lib/lesson-types";
import { clearFileArtifacts } from "@/lib/lesson-reset";

interface Props {
  variant?: "header" | "primary" | "ghost";
  label?: string;
}

export function NewLessonButton({ variant = "ghost", label = "درس جديد" }: Props) {
  const [plan, setPlan] = useCurrentPlan();
  const [, setLessons] = useSavedLessons();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const hasContent = completionRatio(plan) > 0 || plan.topic.trim().length > 0;

  const reset = () => {
    void (async () => {
      // مسح شامل: الملف وصوره والعرض وورقة العمل وبنك الأسئلة وواجب الغائب.
      await clearFileArtifacts();
      setPlan(emptyPlan());
      setOpen(false);
      navigate({ to: "/planning" });
    })();
  };


  const saveAndReset = () => {
    setLessons((prev) => {
      const filtered = prev.filter((l) => l.id !== plan.id);
      return [{ ...plan, createdAt: new Date().toISOString() }, ...filtered];
    });
    toast.success("تم حفظ الدرس الحالي");
    reset();
  };

  const onClick = () => {
    if (hasContent) setOpen(true);
    else reset();
  };

  const cls =
    variant === "header"
      ? "inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-sm font-bold text-primary hover:opacity-90"
      : variant === "primary"
      ? "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
      : "inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent";

  return (
    <>
      <button onClick={onClick} className={cls}>
        <Plus className="h-4 w-4" /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-primary">
              هل تريد حفظ الدرس الحالي قبل البدء؟
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              سيُمسح كل ما يخص الدرس الجاري: الملف المرفوع، صور الكتاب، العرض التقديمي، ورقة العمل،
              بنك الأسئلة، وواجب الغائب — ثم يُفتح درس فارغ.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                إلغاء
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                ابدأ بدون حفظ
              </button>
              <button
                onClick={saveAndReset}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                حفظ وابدأ جديد
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
