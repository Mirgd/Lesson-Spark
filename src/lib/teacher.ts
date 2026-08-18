import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** الهوية بالاسم فقط — بدون كلمة مرور وبدون حساب */
export type UserRole = "teacher" | "supervisor";

export const ROLE_LABEL: Record<UserRole, string> = {
  teacher: "معلم/ة",
  supervisor: "مشرف/ة",
};

export interface TeacherIdentity {
  name: string;
  role: UserRole;
  school: string;
  branch: string;
  stage: string;
  subject: string;
  phone: string;
}

export const TEACHER_KEY = "rz_teacher";
const EVENT = "rz-teacher-change";

export function emptyTeacher(): TeacherIdentity {
  return { name: "", role: "teacher", school: "", branch: "", stage: "", subject: "", phone: "" };
}

export function getTeacher(): TeacherIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TEACHER_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as TeacherIdentity;
    // الاسم كافٍ للاستمرار — لا نُخرج المستخدم إن كانت هوية قديمة بدون مدرسة
    return t?.name?.trim() ? { ...emptyTeacher(), ...t } : null;
  } catch {
    return null;
  }
}

export function setTeacher(t: TeacherIdentity) {
  localStorage.setItem(TEACHER_KEY, JSON.stringify(t));
  window.dispatchEvent(new Event(EVENT));
}

export function clearTeacher() {
  localStorage.removeItem(TEACHER_KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** يحفظ البيانات في قاعدة البيانات (بدون تسجيل دخول) */
export async function saveTeacherToDb(t: TeacherIdentity) {
  const { error } = await supabase.from("teachers").upsert(
    {
      name: t.name.trim(),
      role: t.role || "teacher",
      school: t.school.trim(),
      branch: t.branch.trim() || null,
      stage: t.stage.trim() || null,
      subject: t.subject.trim() || null,
      phone: t.phone.trim() || null,
    },
    { onConflict: "name" },
  );
  if (error) throw error;
}

export interface TeacherRow {
  id: string;
  name: string;
  role: string;
  school: string | null;
  branch: string | null;
  stage: string | null;
  subject: string | null;
  phone: string | null;
  created_at: string;
}

export async function listTeachers(): Promise<TeacherRow[]> {
  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeacherRow[];
}

/** الهوية الحالية مع التحديث الفوري عند التغيير */
export function useTeacher() {
  const [teacher, setState] = useState<TeacherIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => {
      setState(getTeacher());
      setLoading(false);
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { teacher, loading };
}
