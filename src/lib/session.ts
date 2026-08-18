import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** الأدوار كما هي في public.user_roles (app_role) */
export type AppRole = "teacher" | "supervisor" | "admin" | "school_admin";

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  school: string | null;
  branch: string | null;
  stage: string | null;
  subject: string | null;
  is_active: boolean;
}

export interface SessionIdentity {
  user: User;
  profile: ProfileRow | null;
  role: AppRole;
  /** الاسم المعروض — من profiles.full_name ثم البريد */
  name: string;
  school: string;
  branch: string;
  stage: string;
  subject: string;
  isSupervisor: boolean;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  teacher: "معلم/ة",
  supervisor: "مشرف/ة",
  admin: "مدير النظام",
  school_admin: "مدير/ة المدرسة",
};

async function loadIdentity(user: User): Promise<SessionIdentity> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, school, branch, stage, subject, is_active")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const list = (roles ?? []).map((r) => r.role as AppRole);
  const role: AppRole =
    list.find((r) => r === "admin") ??
    list.find((r) => r === "school_admin") ??
    list.find((r) => r === "supervisor") ??
    "teacher";

  const p = (profile ?? null) as ProfileRow | null;
  const name =
    (p?.full_name ?? "").trim() ||
    ((user.user_metadata?.full_name as string | undefined) ?? "").trim() ||
    (user.email ?? "");

  return {
    user,
    profile: p,
    role,
    name,
    school: p?.school ?? "",
    branch: p?.branch ?? "",
    stage: p?.stage ?? "",
    subject: p?.subject ?? "",
    isSupervisor: role !== "teacher",
  };
}

/** هوية المستخدم الحالية من Supabase Auth + profiles + user_roles */
export function useSession() {
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const sync = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setIdentity(null);
      setLoading(false);
      return;
    }
    setIdentity(await loadIdentity(data.user));
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await sync();
      if (!alive) return;
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void sync();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [sync]);

  return { identity, loading, refresh: sync };
}

export async function signOutAndRedirect() {
  await supabase.auth.signOut();
  window.location.replace("/auth");
}

export function homeForRole(role: AppRole) {
  return role === "teacher" ? "/planning" : "/supervisor";
}
