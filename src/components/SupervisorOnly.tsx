import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ROLE_LABEL, useSession } from "@/lib/session";

/** يحمي الصفحات الخاصة بالمشرف/ة — بقية الأدوار ترى رسالة تنبيه */
export default function SupervisorOnly({ children }: { children: ReactNode }) {
  const { identity, loading } = useSession();

  if (loading)
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );

  if (!identity?.isSupervisor)
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <ShieldAlert className="h-10 w-10 text-gold" />
        <h1 className="mt-3 text-xl font-black text-primary">هذه الصفحة للمشرف/ة فقط</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {identity
            ? `أنت مسجّل باسم ${identity.name} بدور ${ROLE_LABEL[identity.role]}. تواصل مع الإدارة لمنحك صلاحية الإشراف.`
            : "سجّل الدخول أولاً."}
        </p>
        <Link
          to="/auth"
          className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          صفحة تسجيل الدخول
        </Link>
      </main>
    );

  return <>{children}</>;
}
