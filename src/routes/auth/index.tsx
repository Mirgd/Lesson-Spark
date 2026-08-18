import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { homeForRole, type AppRole } from "@/lib/session";

export const Route = createFileRoute("/auth/")({
  component: AuthPage,
});

function arabicError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "البريد أو كلمة المرور غير صحيحة";
  if (m.includes("email not confirmed")) return "لم يتم تأكيد البريد بعد — راجع رسالة التأكيد";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "هذا البريد مسجّل مسبقاً — سجّل الدخول";
  if (m.includes("password should be") || m.includes("weak"))
    return "كلمة المرور ضعيفة — استخدم ٨ أحرف على الأقل";
  if (m.includes("rate limit")) return "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة";
  return message;
}

async function redirectAfterLogin(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const list = (data ?? []).map((r) => r.role as AppRole);
  const role: AppRole =
    list.find((r) => r === "admin") ??
    list.find((r) => r === "school_admin") ??
    list.find((r) => r === "supervisor") ??
    "teacher";
  window.location.replace(homeForRole(role));
}

/** تسجيل الدخول بالبريد وكلمة المرور عبر Supabase Auth */
function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // إن كان المستخدم مسجّلاً بالفعل، ننقله للتطبيق مباشرة
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) await redirectAfterLogin(data.user.id);
    })();
  }, []);

  const login = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error || !data.user) {
      toast.error(arabicError(error?.message ?? "تعذّر تسجيل الدخول"));
      return;
    }
    toast.success("تم تسجيل الدخول 👋");
    await redirectAfterLogin(data.user.id);
  };

  const signup = async () => {
    if (fullName.trim().length < 3) {
      toast.error("اكتب الاسم الكامل");
      return;
    }
    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون ٨ أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(arabicError(error.message));
      return;
    }
    if (!data.session) {
      toast.success("تم إنشاء الحساب — افتح بريدك وأكّد الرابط ثم سجّل الدخول");
      setTab("login");
      return;
    }
    toast.success(`أهلاً ${fullName.trim()} 👋`);
    await redirectAfterLogin(data.user!.id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void (tab === "login" ? login() : signup());
  };

  const inputCls =
    "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-gold";
  const labelCls = "mb-1 block text-sm font-bold text-primary";
  const tabCls = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
      active ? "border border-gold bg-gold/15 text-gold" : "text-muted-foreground hover:bg-accent"
    }`;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h1 className="text-2xl font-black text-primary">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          استخدم بريدك وكلمة المرور للدخول إلى مخطط الدروس.
        </p>

        <div className="mt-5 flex gap-2 rounded-xl border bg-background p-1">
          <button type="button" onClick={() => setTab("login")} className={tabCls(tab === "login")}>
            دخول
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={tabCls(tab === "signup")}
          >
            حساب جديد
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {tab === "signup" && (
            <div>
              <label htmlFor="fullName" className={labelCls}>
                الاسم الكامل *
              </label>
              <input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
                placeholder="مثال: أ. نورة العتيبي / أ. خالد الحربي"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className={labelCls}>
              البريد الإلكتروني *
            </label>
            <input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="name@school.edu.sa"
            />
          </div>

          <div>
            <label htmlFor="password" className={labelCls}>
              كلمة المرور *
            </label>
            <input
              id="password"
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          {tab === "signup" && (
            <div>
              <label htmlFor="confirm" className={labelCls}>
                تأكيد كلمة المرور *
              </label>
              <input
                id="confirm"
                type="password"
                required
                dir="ltr"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : tab === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {tab === "login" ? "دخول" : "إنشاء حساب"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default AuthPage;
