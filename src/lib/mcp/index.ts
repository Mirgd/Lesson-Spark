import { auth, defineMcp } from "@lovable.dev/mcp-js";
import planLesson from "./tools/plan-lesson";
import suggestPhaseActivity from "./tools/suggest-phase-activity";
import suggestHomework from "./tools/suggest-homework";
import searchImages from "./tools/search-images";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged, and Vite inlines it at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rumooz-deep-learning-mcp",
  title: "المدرسة الرمز · التعلم العميق",
  version: "0.1.0",
  instructions:
    "Lesson-design tools for Al-Motaqadimah Schools' 5E deep-learning planner. Use plan_5e_lesson to draft a full 50-minute Arabic STEM lesson, suggest_phase_activity for a single 5E phase, suggest_homework for an Extend-style home challenge, and search_lesson_images to find classroom-safe illustrations.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [planLesson, suggestPhaseActivity, suggestHomework, searchImages],
});
