/** شارة الملف المشترك: تظهر في كل قسم يحتاج ملف الدرس بدلاً من خانة رفع جديدة. */
export const UPLOAD_ANCHOR_ID = "lesson-file-upload";

export function SharedFileBadge({ name }: { name: string }) {
  if (!name) return null;
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-50/40 p-2.5 text-xs font-bold text-green-800 dark:bg-green-950/20 dark:text-green-300">
      <span className="min-w-0 flex-1 truncate">
        ✅ يستخدم: <span className="font-medium">{name}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          const el = document.getElementById(UPLOAD_ANCHOR_ID);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className="shrink-0 rounded-md border border-green-700/30 bg-background px-2 py-1 text-[11px] font-bold text-primary hover:bg-accent"
      >
        تغيير الملف
      </button>
    </div>
  );
}
