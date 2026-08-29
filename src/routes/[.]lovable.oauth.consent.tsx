import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_URL, COMPANY_AR } from "@/lib/branding";

type OAuthClient = { name?: string; client_name?: string; redirect_uri?: string };
type AuthorizationDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data?: AuthorizationDetails | null; error?: { message: string } | null };
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the session lives in localStorage, absent during SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("طلب تفويض غير صالح: authorization_id مفقود");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ href: "/" });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data ?? {};
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-primary">تعذّر تحميل طلب التفويض</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as AuthorizationDetails;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "تطبيق خارجي";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("لم يُرجِع خادم التفويض رابط إعادة توجيه.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-160px)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border bg-card p-8 shadow-[var(--shadow-soft)]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {LOGO_URL && (
            <img src={LOGO_URL} alt={COMPANY_AR} style={{ height: 48 }} className="w-auto" />
          )}
          <h1 className="text-xl font-black text-primary">ربط «{clientName}» بحسابك</h1>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          سيتمكّن «{clientName}» من استخدام أدوات هذا التطبيق نيابةً عنك أثناء تسجيل دخولك.
        </p>

        <ul className="mt-4 space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
          <li>• تصميم خطط دروس وفق نموذج 5E</li>
          <li>• اقتراح أنشطة لكل مرحلة وواجب منزلي</li>
          <li>• البحث عن صور تعليمية توضيحية</li>
        </ul>

        {scopes.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            <div className="mb-1 font-medium">الصلاحيات المطلوبة:</div>
            <div className="flex flex-wrap gap-1.5">
              {scopes.map((s) => (
                <span key={s} className="rounded-full border px-2 py-0.5" dir="ltr">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {details?.client?.redirect_uri && (
          <p className="mt-3 break-all text-xs text-muted-foreground" dir="ltr">
            {details.client.redirect_uri}
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          هذا لا يتجاوز صلاحيات التطبيق ولا سياسات الحماية في الخادم.
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
          >
            إلغاء الربط
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            الموافقة
          </button>
        </div>
      </div>
    </main>
  );
}
