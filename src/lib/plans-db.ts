import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import {
  completionRatio,
  emptyPlan,
  planLang,
  type LessonPlan,
  type PhaseData,
} from "@/lib/lesson-types";

import { normalizeLang } from "@/lib/lang";

import { loadBank, QUESTION_BANK_KEY, type BankQuestion } from "@/lib/question-bank";

import { loadWorksheet, WORKSHEET_KEY, type WorksheetItem } from "@/lib/worksheet";

import { loadSlides, PRESENTATION_KEY, type Slide } from "@/lib/presentation";

import { getLastPdfFile } from "@/lib/pdf-images";

import { uploadLessonPdf } from "@/lib/lesson-files";

/**
 * نحفظ مسار PDF الخاص بالخطة محلياً أيضاً
 * حتى لا نفقده عند فتح درس محفوظ ثم حفظه مرة أخرى.
 */
const CURRICULUM_FILE_PATH_KEY = "rz_curriculum_file_path";

/* =========================================================
   TYPES
========================================================= */

/**
 * صف خطة في public.lesson_plans
 * مملوكة للمستخدم المسجّل.
 */
export interface PlanRow {
  id: string;
  user_id: string;

  local_id: string | null;

  subject: string | null;
  grade: string | null;
  topic: string | null;

  class_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;

  unit: string | null;
  date: string | null;

  objectives: string | null;

  outcomes: unknown;
  phases: unknown;
  homework: unknown;

  question_bank: unknown;
  worksheet: unknown;
  presentation_slides: unknown;

  /**
   * المسار الدائم لملف المقرر داخل:
   * Supabase Storage / lesson-files
   */
  curriculum_file_path: string | null;

  /**
   * الحقل القديم إن كان ما زال موجوداً.
   */
  curriculum_ref: string | null;

  completion_pct: number;
  status: string;

  created_at: string;
  updated_at: string;
}

/**
 * صف خطة قديمة في public.open_plans.
 *
 * هذا الجدول قد لا يحتوي curriculum_file_path،
 * لذلك لا نجبره على وجود الحقل.
 */
export interface OpenPlanRow {
  id: string;
  teacher_name: string;

  local_id: string | null;

  subject: string | null;
  grade: string | null;
  topic: string | null;

  unit: string | null;

  objectives: string | null;

  outcomes: unknown;
  phases: unknown;
  homework: unknown;

  question_bank: unknown;
  worksheet: unknown;
  presentation_slides: unknown;

  completion_pct: number;
  status: string;

  created_at: string;
  updated_at: string;
}

/**
 * الحزمة الكاملة الخاصة بالخطة.
 */
export interface PlanBundle {
  plan: LessonPlan;

  questionBank: BankQuestion[];

  worksheet: WorksheetItem[];

  slides: Slide[];

  /**
   * مسار ملف PDF الدائم في Supabase Storage.
   */
  curriculumFilePath?: string | null;
}

/* =========================================================
   LOCAL PDF PATH
========================================================= */

function loadCurriculumFilePath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem(CURRICULUM_FILE_PATH_KEY) || null;
  } catch {
    return null;
  }
}

function saveCurriculumFilePath(path: string | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (path) {
      localStorage.setItem(CURRICULUM_FILE_PATH_KEY, path);
    } else {
      localStorage.removeItem(CURRICULUM_FILE_PATH_KEY);
    }
  } catch (error) {
    console.error("Unable to save curriculum file path:", error);
  }
}
export function clearCurriculumFilePath() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(CURRICULUM_FILE_PATH_KEY);
  } catch (error) {
    console.error("Unable to clear curriculum file path:", error);
  }
}

/* =========================================================
   CURRENT BUNDLE
========================================================= */

export function currentBundle(plan: LessonPlan): PlanBundle {
  return {
    plan,

    questionBank: loadBank(),

    worksheet: loadWorksheet(),

    slides: loadSlides(),

    curriculumFilePath: loadCurriculumFilePath(),
  };
}

/* =========================================================
   AUTH
========================================================= */

/**
 * معرّف المستخدم المسجّل حالياً.
 */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("يجب تسجيل الدخول لحفظ الخطة");
  }

  return data.user.id;
}

/* =========================================================
   PLAN -> DATABASE ROW
========================================================= */

export function planToRow(bundle: PlanBundle, userId: string) {
  const { plan } = bundle;

  const pct = Math.round(completionRatio(plan) * 100);

  return {
    user_id: userId,

    local_id: plan.id,

    subject: plan.subject || null,

    grade: plan.grade || null,

    topic: plan.topic || null,

    class_id: plan.classId || null,

    scheduled_date: plan.scheduledDate || null,

    objectives: plan.objectives || null,

    content_language: planLang(plan),

    outcomes: (plan.outcomes ?? []) as unknown as Json,

    phases: plan.phases as unknown as Json,

    homework: plan.homework as unknown as Json,

    question_bank: bundle.questionBank as unknown as Json,

    worksheet: bundle.worksheet as unknown as Json,

    presentation_slides: bundle.slides as unknown as Json,

    /**
     * مهم:
     * مسار PDF المخزّن في Storage.
     */
    curriculum_file_path: bundle.curriculumFilePath ?? null,

    completion_pct: pct,

    status: pct >= 100 ? "complete" : "draft",

    updated_at: new Date().toISOString(),
  };
}

/* =========================================================
   DATABASE ROW -> BUNDLE
========================================================= */

export function rowToBundle(row: PlanRow | OpenPlanRow): PlanBundle {
  const base = emptyPlan();

  /**
   * open_plans قديم وقد لا يحتوي العمود،
   * لذلك نفحص وجوده أولاً.
   */
  const curriculumFilePath =
    "curriculum_file_path" in row ? (row.curriculum_file_path ?? null) : null;

  return {
    plan: {
      ...base,

      id: row.local_id ?? row.id,

      createdAt: row.created_at,

      subject: row.subject ?? "",

      grade: row.grade ?? "",

      topic: row.topic ?? "",

      classId: "class_id" in row ? (row.class_id ?? "") : "",

      scheduledDate: "scheduled_date" in row ? (row.scheduled_date ?? "") : "",

      objectives: row.objectives ?? "",
      contentLanguage: normalizeLang(
        (
          row as {
            content_language?: unknown;
          }
        ).content_language,
      ),

      outcomes: Array.isArray(row.outcomes) ? (row.outcomes as string[]) : [],

      phases: Array.isArray(row.phases) ? (row.phases as PhaseData[]) : base.phases,

      homework: (row.homework as LessonPlan["homework"]) ?? base.homework,
    },

    questionBank: Array.isArray(row.question_bank) ? (row.question_bank as BankQuestion[]) : [],

    worksheet: Array.isArray(row.worksheet) ? (row.worksheet as WorksheetItem[]) : [],

    slides: Array.isArray(row.presentation_slides) ? (row.presentation_slides as Slide[]) : [],

    curriculumFilePath,
  };
}

/* =========================================================
   APPLY BUNDLE LOCALLY
========================================================= */

/**
 * يفتح خطة من قاعدة البيانات
 * داخل مساحة العمل المحلية.
 */
export function applyBundleLocally(bundle: PlanBundle) {
  localStorage.setItem("rz_current", JSON.stringify(bundle.plan));

  localStorage.setItem(QUESTION_BANK_KEY, JSON.stringify(bundle.questionBank));

  localStorage.setItem(WORKSHEET_KEY, JSON.stringify(bundle.worksheet));

  localStorage.setItem(PRESENTATION_KEY, JSON.stringify(bundle.slides));

  /**
   * نحفظ مسار PDF أيضاً.
   */
  saveCurriculumFilePath(bundle.curriculumFilePath);
}

/* =========================================================
   SAVE / UPDATE PLAN
========================================================= */

/**
 * حفظ أو تحديث خطة المستخدم.
 *
 * المفتاح:
 * user_id + local_id
 *
 * إذا كان هناك PDF حالي:
 * 1. يُرفع إلى Supabase Storage.
 * 2. يُحفظ مساره داخل lesson_plans.
 *
 * إذا لم يكن هناك PDF حالي:
 * نحافظ على المسار القديم الموجود في bundle.
 */
export async function upsertPlan(bundle: PlanBundle) {
  const userId = await requireUserId();

  let curriculumFilePath = bundle.curriculumFilePath ?? loadCurriculumFilePath();

  /**
   * الـPDF الحالي الموجود في ذاكرة التطبيق.
   */
  const pdfFile = getLastPdfFile();

  if (pdfFile) {
    curriculumFilePath = await uploadLessonPdf(bundle.plan.id, pdfFile);

    /**
     * نحفظ المسار محلياً أيضاً
     * حتى يبقى عند أي Save لاحق.
     */
    saveCurriculumFilePath(curriculumFilePath);
  }

  const row = {
    ...planToRow(
      {
        ...bundle,
        curriculumFilePath,
      },
      userId,
    ),

    curriculum_file_path: curriculumFilePath,
  };

  /**
   * ملاحظة:
   * قد لا تكون Supabase generated types
   * عندك قد تحدّثت بعد إضافة العمود الجديد
   * curriculum_file_path.
   *
   * لذلك نستخدم cast مؤقتاً هنا.
   * بعد regenerate للـtypes يمكن إزالته.
   */
  const { error } = await supabase.from("lesson_plans").upsert(row as any, {
    onConflict: "user_id,local_id",
  });

  if (error) {
    throw error;
  }
}

/* =========================================================
   LIST PLANS
========================================================= */

/**
 * خطط المستخدم المسجّل فقط.
 */
export async function listPlans() {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("lesson_plans")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as PlanRow[];
}

/* =========================================================
   GET ONE PLAN
========================================================= */

/**
 * جلب خطة واحدة بمعرّفها
 * مع تقييد الملكية.
 */
export async function getPlan(id: string) {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("lesson_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as unknown as PlanRow | null) ?? null;
}

/* =========================================================
   DELETE PLAN
========================================================= */

export async function deletePlan(id: string) {
  const userId = await requireUserId();

  const { error } = await supabase.from("lesson_plans").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    throw error;
  }
}

/* =========================================================
   DUPLICATE PLAN
========================================================= */

export async function duplicatePlan(id: string, newClassId?: string, newScheduledDate?: string) {
  const row = await getPlan(id);

  if (!row) {
    throw new Error("لم يتم العثور على الخطة");
  }

  const bundle = rowToBundle(row);

  bundle.plan = {
    ...bundle.plan,

    id: crypto.randomUUID(),

    topic: `${bundle.plan.topic} (نسخة)`,

    classId: newClassId || "",

    scheduledDate: newScheduledDate || "",
  };

  await upsertPlan(bundle);
}

/* =========================================================
   OPEN PLANS
========================================================= */

/**
 * الخطط القديمة المفتوحة.
 * تقرأ فقط مؤقتاً في الإشراف والإدارة.
 */
export async function listOpenPlans(teacherName?: string) {
  let q = supabase.from("open_plans").select("*").order("updated_at", {
    ascending: false,
  });

  if (teacherName) {
    q = q.eq("teacher_name", teacherName);
  }

  const { data, error } = await q;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as OpenPlanRow[];
}

/* =========================================================
   RELATIVE TIME
========================================================= */

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();

  const m = Math.round(diff / 60000);

  if (m < 1) {
    return "الآن";
  }

  if (m < 60) {
    return `منذ ${m} دقيقة`;
  }

  const h = Math.round(m / 60);

  if (h < 24) {
    return `منذ ${h} ساعة`;
  }

  const d = Math.round(h / 24);

  if (d === 1) {
    return "أمس";
  }

  if (d < 30) {
    return `منذ ${d} يوم`;
  }

  return new Date(iso).toLocaleDateString("ar");
}
