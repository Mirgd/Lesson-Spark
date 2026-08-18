import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content: "سجّل الدخول بالبريد وكلمة المرور لإدارة خطط دروس 5E في المدرسة الرمز.",
      },
      { property: "og:title", content: "تسجيل الدخول — المدرسة الرمز" },
      { property: "og:description", content: "الدخول بالبريد وكلمة المرور." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Outlet />,
});
