import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  UiLanguageProvider,
  useUiLanguage,
} from "@/lib/ui-language";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,

  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LOGO_URL, COMPANY_AR } from "@/lib/branding";
import { NewLessonButton } from "@/components/NewLessonButton";
import { ROLE_LABEL, signOutAndRedirect, useSession } from "@/lib/session";




function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">لم نتمكن من العثور على ما تبحث عنه.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">تعذّر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">حدث خطأ ما. حاول مرة أخرى.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content:
          "مخطط درس STEM ذكي وفق نموذج 5E لحصة 60 دقيقة — ذكاء اصطناعي يقرأ مقررك ويبني خطة الدرس والعرض التقديمي تلقائياً",
      },
      { property: "og:title", content: "المدرسة الرمز · التعلم العميق" },
      {
        property: "og:description",
        content:
          "مخطط درس STEM ذكي وفق نموذج 5E لحصة 60 دقيقة — ذكاء اصطناعي يقرأ مقررك ويبني خطة الدرس والعرض التقديمي تلقائياً",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "المدرسة الرمز · التعلم العميق" },
      {
        name: "twitter:description",
        content:
          "مخطط درس STEM ذكي وفق نموذج 5E لحصة 60 دقيقة — ذكاء اصطناعي يقرأ مقررك ويبني خطة الدرس والعرض التقديمي تلقائياً",
      },


    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>

      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const { identity } = useSession();
  const {
  language,
  toggleLanguage,
} = useUiLanguage();

const isArabic = language === "ar";
  const isSupervisor = identity?.isSupervisor ?? false;
  const linkCls =
    "px-4 py-1.5 rounded-lg text-[15px] font-semibold text-[#4A5568] hover:bg-[#FBF4E3] hover:text-gold transition-all";
  const activeCls = "!bg-primary !text-primary-foreground";

  return (
    <nav className="no-print sticky top-0 z-40 border-b-2 border-b-gold bg-card shadow-[0_2px_12px_rgba(27,42,74,0.08)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-[20px] font-extrabold text-primary">
              {isArabic ? "المدرسة" : "Al-Ramz School"}
            </span>

            <span className="text-[20px] font-extrabold text-gold">
              {isArabic ? "الرمز" : ""}
            </span>

            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
              {isArabic ? "· التعلم العميق" : "· Deep Learning"}
            </span>
        </Link>
          {LOGO_URL && (
            <img
              src={LOGO_URL}
              alt={COMPANY_AR}
              style={{ height: 48 }}
              className="w-auto select-none"
              draggable={false}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link
            to="/planning"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            {isArabic ? "التخطيط" : "Planning"}
          </Link>

          <Link
            to="/execute"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            {isArabic ? "التنفيذ" : "Execution"}
          </Link>

          <Link
            to="/reflection"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            {isArabic ? "التأمل" : "Reflection"}
          </Link>

          <Link
            to="/lessons"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            {isArabic ? "دروسي" : "My Lessons"}
          </Link>

          <Link
            to="/dashboard"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            {isArabic ? "لوحتي" : "Dashboard"}
          </Link>

          <Link
            to="/absent"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            {isArabic ? "الطالب الغائب" : "Absent Student"}
          </Link>

          {isSupervisor && (
  <>
    <Link
      to="/supervisor"
      className={linkCls}
      activeProps={{ className: `${linkCls} ${activeCls}` }}
    >
      {isArabic ? "الإشراف" : "Supervision"}
    </Link>

    <Link
      to="/admin"
      className={`${linkCls} border border-gold/60 bg-gold/10 text-gold hover:bg-gold hover:text-white`}
      activeProps={{ className: `${linkCls} ${activeCls}` }}
    >
      {isArabic ? "⚙️ الإدارة" : "⚙️ Admin"}
    </Link>
  </>
)}

          <div className="mr-2 flex items-center gap-2 ps-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-lg border border-gold/60 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold transition hover:bg-gold hover:text-white"
            >
              🌐 {isArabic ? "English" : "العربية"}
              </button>
            <NewLessonButton variant="header" />
            {identity && (
  <button
    onClick={() => void signOutAndRedirect()}
    title={`${identity.name} — ${ROLE_LABEL[identity.role]}`}
    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
  >
    {isArabic ? "خروج" : "Sign Out"}
  </button>
)}
          </div>



        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="no-print mt-16 border-t bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 pt-5 text-center text-xs text-muted-foreground">
        {LOGO_URL && (
          <img
            src={LOGO_URL}
            alt={COMPANY_AR}
            style={{ height: 32 }}
            className="w-auto select-none opacity-80"
            draggable={false}
          />
        )}
        <span>
          {COMPANY_AR} · المدرسة الرمز · التعلم العميق
        </span>
      </div>
      <div
        className="px-4 pb-5 pt-2 text-center"
        style={{ fontFamily: '"Inter", "Tajawal", sans-serif', fontSize: 12, color: "#888888" }}
        dir="ltr"
      >
        Designed &amp; Developed by Zaid Idris
      </div>
    </footer>

  );
}

/** بوابة الدخول: الصفحات المحمية تتطلب جلسة Supabase */
function AuthGate({ children }: { children: ReactNode }) {
  const { loading, identity } = useSession();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const open =
    path === "/" ||
    path === "/auth" ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/") ||
    path.startsWith("/.");

  useEffect(() => {
    if (!open && !loading && !identity) window.location.replace("/auth");
  }, [open, loading, identity]);

  if (open) return <>{children}</>;
  if (loading || !identity)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="text-sm text-muted-foreground">جارٍ التحميل...</span>
      </div>
    );
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <UiLanguageProvider>
        <AppLayout />
      </UiLanguageProvider>
    </QueryClientProvider>
  );
}

function AppLayout() {
  const { dir } = useUiLanguage();

  return (
    <div
      className="flex min-h-screen flex-col"
      dir={dir}
    >
      <Header />

      <div className="flex-1">
        <AuthGate>
          <Outlet />
        </AuthGate>
      </div>

      <Footer />

      <Toaster
        richColors
        position="top-center"
        dir={dir}
      />
    </div>
  );
}
