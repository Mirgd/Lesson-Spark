import { useMemo, useState } from "react";
import { Star, Trash2, Plus, Library } from "lucide-react";
import { PHASES, type LessonPlan, type PhaseId } from "@/lib/lesson-types";
import { RATING_SCALE, useQuestionBank, type BankQuestion } from "@/lib/question-bank";
import { SharedFileBadge } from "@/components/SharedFileBadge";
import { useSharedFile } from "@/lib/pdf-images";

const TEAL = "#1E7CA8";

function Rating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label = RATING_SCALE.find((r) => r.value === value);
  return (
    <div className="flex items-center gap-1">
      {RATING_SCALE.map((r) => (
        <button
          key={r.value}
          type="button"
          title={r.label}
          onClick={() => onChange(value === r.value ? 0 : r.value)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className="h-4 w-4"
            style={{
              color: r.value <= value ? "#B8860B" : "#C9CCD3",
              fill: r.value <= value ? "#B8860B" : "none",
            }}
          />
        </button>
      ))}
      <span className="ms-1 text-[11px]" style={{ color: label?.color ?? "#8A8F98" }}>
        {label?.label ?? "بدون تقييم"}
      </span>
    </div>
  );
}

export function QuestionBank({ plan }: { plan: LessonPlan }) {
  const { items, addMany, update, remove } = useQuestionBank();
  const [tab, setTab] = useState<PhaseId>("engage");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({ text: "", answer: "" });
  const { name: sharedName } = useSharedFile();

  const filtered = useMemo(() => {
    const q = search.trim();
    return items
      .filter((it) => it.phase === tab)
      .filter((it) => !q || it.text.includes(q) || it.topic.includes(q))
      .sort((a, b) => b.rating - a.rating || b.uses - a.uses);
  }, [items, tab, search]);

  const selectedCount = items.filter((i) => i.selected).length;

  const add = () => {
    if (!draft.text.trim()) return;
    addMany([
      {
        phase: tab,
        subject: plan.subject,
        topic: plan.topic,
        text: draft.text.trim(),
        answer: draft.answer.trim(),
      },
    ]);
    setDraft({ text: "", answer: "" });
  };

  return (
    <div className="card-elevated p-4">
      <SharedFileBadge name={sharedName} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: TEAL }}>
          <Library className="h-4 w-4" /> بنك الأسئلة
        </div>
        <span className="text-[11px] text-muted-foreground">
          {items.length} سؤال · {selectedCount} مختار لورقة العمل
        </span>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-1">
        {PHASES.map((p) => {
          const count = items.filter((i) => i.phase === p.id).length;
          const active = tab === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setTab(p.id)}
              className="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
              style={{
                borderColor: p.color,
                background: active ? p.color : "transparent",
                color: active ? "#fff" : p.color,
              }}
            >
              {p.nameAr} ({count})
            </button>
          );
        })}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ابحث في أسئلة هذه المرحلة..."
        className="mt-3 w-full rounded border p-2 text-sm"
      />

      <ul className="mt-3 space-y-2">
        {filtered.length === 0 && (
          <li className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
            لا توجد أسئلة محفوظة لهذه المرحلة — أضف سؤالاً أو ولّد ورقة عمل ليُحفظ تلقائياً.
          </li>
        )}
        {filtered.map((q: BankQuestion) => (
          <li key={q.id} className="rounded-lg border bg-card p-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={Boolean(q.selected)}
                onChange={() => update(q.id, { selected: !q.selected })}
                className="mt-1"
                title="أعد استخدامه في ورقة العمل القادمة"
              />
              <div className="min-w-0 flex-1">
                <textarea
                  value={q.text}
                  onChange={(e) => update(q.id, { text: e.target.value })}
                  rows={2}
                  className="w-full rounded border p-2 text-sm"
                />
                <input
                  value={q.answer}
                  onChange={(e) => update(q.id, { answer: e.target.value })}
                  placeholder="الإجابة النموذجية"
                  className="mt-1 w-full rounded border p-2 text-sm"
                  style={{ background: "#16794A0F" }}
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <Rating value={q.rating} onChange={(v) => update(q.id, { rating: v })} />
                  <span className="text-[11px] text-muted-foreground">
                    {q.topic || "—"} · استُخدم {q.uses} مرة
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(q.id)}
                className="rounded p-1 text-muted-foreground hover:text-red-600"
                title="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-lg border border-dashed p-2">
        <textarea
          value={draft.text}
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
          rows={2}
          placeholder="أضف سؤالاً جديداً لهذه المرحلة..."
          className="w-full rounded border p-2 text-sm"
        />
        <input
          value={draft.answer}
          onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
          placeholder="الإجابة النموذجية (اختياري)"
          className="mt-1 w-full rounded border p-2 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="mt-2 flex items-center gap-1 rounded-md px-3 py-1 text-xs font-bold text-white"
          style={{ background: TEAL }}
        >
          <Plus className="h-3 w-3" /> أضف إلى البنك
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        الأسئلة المختارة (☑) تُعاد داخل ورقة العمل القادمة لمراحلها المطابقة.
      </p>
    </div>
  );
}
