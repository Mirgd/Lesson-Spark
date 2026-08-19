import { useEffect, useState } from "react";
import { normalizeLang, type ContentLanguage } from "@/lib/lang";

export type PhaseId = "engage" | "explore" | "explain" | "elaborate" | "evaluate";

export interface PhaseMeta {
  id: PhaseId;
  nameAr: string;
  nameEn: string;
  color: string;
  defaultDuration: number;
  teacherHint: string;
  studentPrompt: string;
  placeholder: string;
  questionsPlaceholder: string;
  studentPlaceholder: string;
}

export const PHASES: PhaseMeta[] = [
  {
    id: "engage",
    nameAr: "الإشراك",
    nameEn: "Engage",
    color: "#B8860B",
    defaultDuration: 10,
    teacherHint:
      "ابدأ بظاهرة مثيرة أو سؤال استفزازي. استحضر المعرفة السابقة. لا تشرح — فقط أشعل الفضول.",
    studentPrompt: "ماذا أعرف عن هذا الموضوع؟ ما الذي يثير فضولي؟",
    placeholder:
      "أعرض صورة أو مقطعاً قصيراً مثيراً عن الموضوع\nثم أسأل: ماذا تلاحظون؟ ماذا تتوقعون أن نتعلم اليوم؟",
    questionsPlaceholder:
      "• ماذا تعرف عن (الموضوع)؟\n• أين رأيت هذا في حياتك اليومية؟\n• ماذا تتوقع أن يحدث لو...؟",
    studentPlaceholder: "شاهد... لاحظ... تساءل...",
  },
  {
    id: "explore",
    nameAr: "الاستكشاف",
    nameEn: "Explore",
    color: "#1E7CA8",
    defaultDuration: 16,
    teacherHint:
      "الطالب يُجرّب ويسجّل بنفسه — أنت تمشي وتلاحظ فقط. لا تشرح قبل أن يستكشفوا.",
    studentPrompt: "جرّب... سجّل ملاحظاتك... ماذا اكتشفت؟",
    placeholder:
      "أوزّع المجموعات وأقدّم التحدي/التجربة\nأمشي بين المجموعات وأُلاحظ دون أن أتدخل\nأطرح أسئلة توجيهية فقط عند الحاجة",
    questionsPlaceholder:
      "• ماذا لاحظتم حتى الآن؟\n• لماذا تعتقدون أن هذا حدث؟\n• ماذا سيحدث لو غيّرتم...؟",
    studentPlaceholder: "جرّب النشاط التالي وسجّل ما تلاحظه...",
  },
  {
    id: "explain",
    nameAr: "التفسير",
    nameEn: "Explain",
    color: "#1B2A4A",
    defaultDuration: 13,
    teacherHint:
      "اسأل الطلاب أولاً: ماذا لاحظتم؟ ثم أنت تنظّم وتضيف المصطلح العلمي الدقيق.",
    studentPrompt: "ماذا تعلمت؟ كيف تُفسّر ما لاحظته؟",
    placeholder:
      "أطلب من كل مجموعة عرض نتائجها\nأقارن بين الإجابات المختلفة\nأُضيف المصطلح العلمي الدقيق بعد أن يُفسّروا",
    questionsPlaceholder:
      "• كيف تُفسّر ما لاحظته؟\n• هل وافق أحد على نتيجة مختلفة؟ لماذا؟\n• ما العلاقة بين ما فعلناه وما درسناه سابقاً؟",
    studentPlaceholder: "شارك ما توصّلت إليه... استمع لزملائك...",
  },
  {
    id: "elaborate",
    nameAr: "التوسيع",
    nameEn: "Elaborate",
    color: "#6B46C1",
    defaultDuration: 11,
    teacherHint:
      "قدّم سيناريو جديداً مختلفاً. الطالب يُطبّق الفهم — لا تشرح، فقط قدّم التحدي.",
    studentPrompt: "كيف أُطبّق ما تعلمته في موقف جديد؟",
    placeholder:
      "أقدّم سيناريو أو مشكلة جديدة مختلفة\nأترك المجموعات تُطبّق الفهم باستقلالية\nلا أشرح — فقط أُراقب وأُسجّل",
    questionsPlaceholder:
      "• كيف تُطبّق ما تعلمته على هذا الموقف الجديد؟\n• ما الفرق بين هذه الحالة والحالة الأولى؟\n• صمّم حلاً لهذه المشكلة...",
    studentPlaceholder: "طبّق ما تعلمته على هذا التحدي الجديد...",
  },
  {
    id: "evaluate",
    nameAr: "التقويم",
    nameEn: "Evaluate",
    color: "#276749",
    defaultDuration: 5,
    teacherHint:
      "قيّم تحقق نواتج التعلم. بطاقة خروج أو سؤال تأملي. الواجب يخرج من هنا.",
    studentPrompt: "ماذا تعلمت اليوم؟ ما الذي ما زال غامضاً؟",
    placeholder:
      "أوزّع بطاقة الخروج:\n3 أشياء تعلمتها\n2 أسئلة ما زالت عندك\n1 شيء ستُطبّقه",
    questionsPlaceholder:
      "• ما أهم شيء تعلمته اليوم؟\n• ما الذي ما زال غامضاً بالنسبة لك؟\n• كيف تُقيّم فهمك من 1 إلى 10؟ ولماذا؟",
    studentPlaceholder: "أجب: (3) أشياء تعلمتها — (2) أسئلة لديك — (1) شيء ستُطبّقه",
  },
];

/** أسئلة جاهزة لكل مرحلة — {topic} يُستبدل بموضوع الدرس */
export const QUESTION_BANKS: Record<PhaseId, string[]> = {
  engage: [
    "ماذا تعرف عن {topic}؟",
    "أين رأيت {topic} في حياتك اليومية؟",
    "ماذا تتوقع أن نتعلم اليوم؟",
    "ما الذي يثير فضولك حول {topic}؟",
    "ماذا سيحدث لو...؟",
  ],
  explore: [
    "ماذا لاحظتم حتى الآن؟",
    "لماذا تعتقدون أن هذا حدث؟",
    "ما الذي فاجأكم في النتيجة؟",
    "كيف تختلف نتيجتكم عن مجموعة أخرى؟",
    "ماذا ستغيّرون لو أعدتم التجربة؟",
  ],
  explain: [
    "كيف تُفسّر ما لاحظته بكلماتك؟",
    "ما العلاقة بين ما فعلناه وما درسناه سابقاً؟",
    "هل توافق على تفسير زميلك؟ لماذا؟",
    "ما المصطلح العلمي الدقيق لما وصفته؟",
    "كيف تُثبت أن تفسيرك صحيح؟",
  ],
  elaborate: [
    "كيف تُطبّق ما تعلمته على هذا الموقف الجديد؟",
    "ما الفرق بين هذه الحالة والحالة الأولى؟",
    "صمّم حلاً لهذه المشكلة باستخدام ما تعلمته",
    "كيف تستخدم هذا المفهوم في حياتك اليومية؟",
    "ما الأفضل من الحلول المقترحة؟ ولماذا؟",
  ],
  evaluate: [
    "ما أهم شيء تعلمته اليوم؟",
    "ما الذي ما زال غامضاً بالنسبة لك؟",
    "كيف ستستخدم هذا التعلم خارج المدرسة؟",
    "ما الذي تريد أن تعرف أكثر عنه؟",
    "كيف تُقيّم فهمك من 1 إلى 10؟ ولماذا؟",
  ],
};
export const QUESTION_BANKS_EN: Record<PhaseId, string[]> = {
  engage: [
    "What do you already know about {topic}?",
    "Where have you encountered {topic} in your daily life?",
    "What do you expect to learn today?",
    "What makes you curious about {topic}?",
    "What do you think would happen if...?",
  ],

  explore: [
    "What have you noticed so far?",
    "Why do you think this happened?",
    "What surprised you about the result?",
    "How does your result differ from another group's result?",
    "What would you change if you repeated the investigation?",
  ],

  explain: [
    "How would you explain what you observed in your own words?",
    "How is what we did connected to what you learned before?",
    "Do you agree with your classmate's explanation? Why?",
    "What is the correct scientific term for what you described?",
    "What evidence supports your explanation?",
  ],

  elaborate: [
    "How can you apply what you learned to this new situation?",
    "How is this situation different from the first one?",
    "Design a solution to this problem using what you learned.",
    "How could you use this concept in your daily life?",
    "Which of the suggested solutions is best, and why?",
  ],

  evaluate: [
    "What is the most important thing you learned today?",
    "What is still unclear to you?",
    "How will you use what you learned outside school?",
    "What would you like to learn more about?",
    "How would you rate your understanding from 1 to 10, and why?",
  ],
};

/** صورة من صفحات الكتاب المرفوع — نخزّن رقم الصفحة فقط */
export interface BookImage {
  source: "book";
  id: string;
  page: number;
}

/** صورة من الإنترنت — نخزّن الرابط فقط */
export interface WebImage {
  source?: "unsplash";
  id: string;
  url: string;
  thumb: string;
  alt: string;
  author: string;
  authorUrl: string;
  link: string;
}

export type PhaseImage = BookImage | WebImage;

export const isBookImage = (img: PhaseImage): img is BookImage =>
  (img as BookImage).source === "book";

export interface PhaseData {
  id: PhaseId;
  duration: number;
  teacherActivity: string;
  /** أسئلة المعلم لهذه المرحلة */
  teacherQuestions?: string;
  studentActivity: string;
  aiSuggestion?: string;
  images?: PhaseImage[];
}


export interface HomeworkData {
  teacherNote: string;
  studentText: string;
  aiSuggestion?: string;
}

export interface ReflectionData {
  wentWell: string;
  toImprove: string;
  needsSupport: string;
  slowPhase?: string;
}

export interface LessonPlan {
  id: string;
  createdAt: string;
  subject: string;
  grade: string;
  topic: string;
  objectives: string;
  /** لغة المحتوى التعليمي المولَّد — الواجهة تبقى عربية دائماً */
  contentLanguage?: ContentLanguage;
  /** نواتج التعلم المستخرجة من المقرر (صياغة بنائية بلسان الطالب) */
  outcomes?: string[];
  phases: PhaseData[];
  homework: HomeworkData;
  reflection?: ReflectionData;
}

export const emptyPlan = (): LessonPlan => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  subject: "",
  grade: "",
  topic: "",
  objectives: "",
  contentLanguage: "ar",
  phases: PHASES.map((p) => ({
    id: p.id,
    duration: p.defaultDuration,
    teacherActivity: "",
    studentActivity: "",
  })),
  homework: { teacherNote: "", studentText: "" },
});

/** لغة محتوى الخطة — الخطط القديمة بدون الحقل تعود إلى العربية */
export const planLang = (plan: Pick<LessonPlan, "contentLanguage">): ContentLanguage =>
  normalizeLang(plan.contentLanguage);

const CURRENT_KEY = "rz_current";
const LESSONS_KEY = "rz_lessons";
const CURRICULUM_KEY = "rz_curriculum";
const CURRICULUM_NAME_KEY = "rz_curriculum_name";

const LS_EVENT = "rz-local-storage";

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch (e) {
      console.error(e);
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const raw = JSON.stringify(value);
      if (localStorage.getItem(key) === raw) return;
      localStorage.setItem(key, raw);
      window.dispatchEvent(new CustomEvent(LS_EVENT, { detail: { key, raw } }));
    } catch (e) {
      console.error(e);
    }
  }, [key, value, hydrated]);

  /* مزامنة فورية بين كل المكوّنات التي تستخدم نفس المفتاح (نفس التبويب أو تبويب آخر). */
  useEffect(() => {
    const apply = (raw: string | null) => {
      if (raw == null) return;
      setValue((prev) => {
        try {
          return JSON.stringify(prev) === raw ? prev : (JSON.parse(raw) as T);
        } catch {
          return prev;
        }
      });
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; raw: string }>).detail;
      if (detail?.key === key) apply(detail.raw);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) apply(e.newValue);
    };
    window.addEventListener(LS_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LS_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  return [value, setValue];
}


export function useCurrentPlan() {
  return useLocalStorage<LessonPlan>(CURRENT_KEY, emptyPlan());
}

export function useSavedLessons() {
  return useLocalStorage<LessonPlan[]>(LESSONS_KEY, []);
}

export function useCurriculum() {
  const [text, setText] = useLocalStorage<string>(CURRICULUM_KEY, "");
  const [name, setName] = useLocalStorage<string>(CURRICULUM_NAME_KEY, "");
  return {
    text,
    name,
    set: (t: string, n: string) => {
      setText(t);
      setName(n);
    },
    clear: () => {
      setText("");
      setName("");
    },
  };
}

export function totalDuration(plan: LessonPlan): number {
  return plan.phases.reduce((s, p) => s + p.duration, 0);
}

export function phaseMeta(id: PhaseId): PhaseMeta {
  return PHASES.find((p) => p.id === id)!;
}

export function completionRatio(plan: LessonPlan): number {
  const parts = [
    ...plan.phases.map((p) => p.teacherActivity.trim() || p.studentActivity.trim()),
    plan.homework.teacherNote.trim() || plan.homework.studentText.trim(),
  ];
  const done = parts.filter(Boolean).length;
  return done / parts.length;
}
