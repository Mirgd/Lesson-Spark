import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { emptyPlan, useCurrentPlan, useSavedLessons, completionRatio } from "@/lib/lesson-types";
import { clearFileArtifacts } from "@/lib/lesson-reset";
import { useUiLanguage } from "@/lib/ui-language";
interface Props {
  variant?: "header" | "primary" | "ghost";
  label?: string;
}

export function NewLessonButton({ variant = "ghost", label }: Props) {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [plan, setPlan] = useCurrentPlan();
  const [, setLessons] = useSavedLessons();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const hasContent = completionRatio(plan) > 0 || plan.topic.trim().length > 0;

  const buttonLabel = label ?? (isArabic ? "درس جديد" : "New Lesson");

  const reset = () => {
    void (async () => {
      await clearFileArtifacts();

      setPlan(emptyPlan());
      setOpen(false);

      navigate({
        to: "/planning",
      });
    })();
  };

  const saveAndReset = () => {
    setLessons((prev) => {
      const filtered = prev.filter((l) => l.id !== plan.id);

      return [
        {
          ...plan,
          createdAt: new Date().toISOString(),
        },
        ...filtered,
      ];
    });

    toast.success(isArabic ? "تم حفظ الدرس الحالي" : "Current lesson saved");

    reset();
  };

  const onClick = () => {
    if (hasContent) {
      setOpen(true);
    } else {
      reset();
    }
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
        <Plus className="h-4 w-4" />
        {buttonLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            dir={isArabic ? "rtl" : "ltr"}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-primary">
              {isArabic
                ? "هل تريد حفظ الدرس الحالي قبل البدء؟"
                : "Would you like to save the current lesson before starting a new one?"}
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              {isArabic
                ? "سيُمسح كل ما يخص الدرس الجاري: الملف المرفوع، صور الكتاب، العرض التقديمي، ورقة العمل، بنك الأسئلة، وواجب الغائب — ثم يُفتح درس فارغ."
                : "Everything related to the current lesson will be cleared: the uploaded file, book images, presentation, worksheet, question bank, and absent-student homework. A new blank lesson will then be opened."}
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {isArabic ? "إلغاء" : "Cancel"}
              </button>

              <button
                onClick={reset}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                {isArabic ? "ابدأ بدون حفظ" : "Start Without Saving"}
              </button>

              <button
                onClick={saveAndReset}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                {isArabic ? "حفظ وابدأ جديد" : "Save & Start New"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
