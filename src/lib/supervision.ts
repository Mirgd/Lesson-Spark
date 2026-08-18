import { supabase } from "@/integrations/supabase/client";
import type { ContentLanguage } from "@/lib/lang";
import { normalizeLang } from "@/lib/lang";
import type { AppRole } from "@/lib/session";

/** معلم/ة كما تراه لوحة الإشراف — من public.profiles + public.user_roles */
export interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  school: string | null;
  branch: string | null;
  stage: string | null;
  subject: string | null;
  is_active: boolean;
}

/** خطة درس مملوكة لمعلم/ة في public.lesson_plans (قراءة فقط للمشرف/ة) */
export interface SupervisedPlan {
  id: string;
  user_id: string;
  topic: string | null;
  unit: string | null;
  subject: string | null;
  grade: string | null;
  date: string | null;
  objectives: string | null;
  outcomes: unknown;
  phases: unknown;
  homework: unknown;
  status: string;
  completion_pct: number;
  content_language: ContentLanguage;
  created_at: string;
  updated_at: string;
}

/** تقييم خطة في public.plan_reviews */
export interface PlanReviewRow {
  id: string;
  plan_id: string;
  teacher_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

const PLAN_COLUMNS =
  "id, user_id, topic, unit, subject, grade, date, objectives, outcomes, phases, homework, status, completion_pct, content_language, created_at, updated_at";

/** كل المعلمين/ات المسجَّلين — الدور من user_roles والبيانات من profiles */
export async function listTeacherProfiles(): Promise<TeacherProfile[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("role", "teacher");
  if (rolesError) throw rolesError;

  const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, school, branch, stage, subject, is_active")
    .in("id", ids)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TeacherProfile[];
}

/** كل خطط الدروس المصرَّح بقراءتها — RLS تُعيد كل الخطط للمشرف/ة فقط */
export async function listAllPlans(): Promise<SupervisedPlan[]> {
  const { data, error } = await supabase
    .from("lesson_plans")
    .select(PLAN_COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as unknown as SupervisedPlan),
    content_language: normalizeLang((row as { content_language?: unknown }).content_language),
  }));
}

/** التقييمات المصرَّح بقراءتها في plan_reviews */
export async function listPlanReviews(): Promise<PlanReviewRow[]> {
  const { data, error } = await supabase
    .from("plan_reviews")
    .select("id, plan_id, teacher_id, reviewer_id, rating, comment, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlanReviewRow[];
}

/** حفظ تقييم المشرف/ة الحالي — تقييم واحد لكل (خطة، مُقيّم) */
export async function upsertPlanReview(input: {
  planId: string;
  teacherId: string;
  rating: number;
  comment: string;
}) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("يجب تسجيل الدخول لحفظ التقييم");

  const { error } = await supabase.from("plan_reviews").upsert(
    {
      plan_id: input.planId,
      teacher_id: input.teacherId,
      reviewer_id: auth.user.id,
      rating: input.rating,
      comment: input.comment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id,reviewer_id" },
  );
  if (error) throw error;
}

/** عضو كادر واحد في دليل الكادر التعليمي — حساب واحد = صفّ واحد */
export interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  school: string | null;
  branch: string | null;
  stage: string | null;
  subject: string | null;
  is_active: boolean;
  roles: AppRole[];
  plans: number;
  completed: number;
  last_updated: string | null;
}

export interface StaffDirectory {
  members: StaffMember[];
  totalPlans: number;
  completedPlans: number;
}

/** دليل الكادر من public.profiles + public.user_roles + public.lesson_plans */
export async function listStaffDirectory(): Promise<StaffDirectory> {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: plans, error: lErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, school, branch, stage, subject, is_active")
        .order("full_name", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("lesson_plans").select("id, user_id, status, updated_at"),
    ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  if (lErr) throw lErr;

  const roleMap = new Map<string, AppRole[]>();
  for (const r of roles ?? []) {
    const list = roleMap.get(r.user_id) ?? [];
    const role = r.role as AppRole;
    if (!list.includes(role)) list.push(role);
    roleMap.set(r.user_id, list);
  }

  const planMap = new Map<string, { plans: number; completed: number; last: string | null }>();
  for (const p of plans ?? []) {
    const cur = planMap.get(p.user_id) ?? { plans: 0, completed: 0, last: null };
    cur.plans += 1;
    if (p.status === "complete") cur.completed += 1;
    if (!cur.last || p.updated_at > cur.last) cur.last = p.updated_at;
    planMap.set(p.user_id, cur);
  }

  const members: StaffMember[] = (profiles ?? []).map((p) => {
    const agg = planMap.get(p.id);
    return {
      ...(p as TeacherProfile),
      roles: roleMap.get(p.id) ?? [],
      plans: agg?.plans ?? 0,
      completed: agg?.completed ?? 0,
      last_updated: agg?.last ?? null,
    };
  });

  return {
    members,
    totalPlans: (plans ?? []).length,
    completedPlans: (plans ?? []).filter((p) => p.status === "complete").length,
  };
}
