# Step 1 — Move identity to Supabase Authentication (email + password)

Only authentication changes. No schema changes, no RLS changes, no data deleted, no lesson-plan migration.

## How the new flow works

1. `/auth` becomes a real email/password sign-in page (with sign-up as a second tab, using the existing `handle_new_user` trigger that already creates the `profiles` row and a default `teacher` role).
2. After a successful sign-in, the app reads:
   - `profiles` where `id = auth.uid()` → display name, school, branch, stage, subject
   - `user_roles` where `user_id = auth.uid()` → role (`teacher` / `supervisor` / `admin` / `school_admin`)
3. That combination becomes the single source of identity for the UI. `localStorage` `rz_teacher` and `teachers.name` are no longer read for identity or access control.
4. Supervisors/admins land on `/supervisor`; everyone else lands on `/planning`. Unauthenticated visitors on any app page are sent to `/auth`.
5. Existing lesson-plan storage keeps working exactly as today (it still writes to `open_plans` keyed by a display name) — the name now comes from the signed-in profile instead of the local identity form. Migrating that data to `lesson_plans` is a later step.

## Files

New:

- `src/lib/session.ts` — `useSession()` hook: current Supabase user + `profiles` row + `user_roles` role, kept fresh via `onAuthStateChange`; plus `signOut()` helper. This replaces `useTeacher()` as the identity source.

Rewritten:

- `src/routes/auth/index.tsx` — sign in / sign up form (email, password, full name on sign-up), Arabic error messages, redirect by role after success.
- `src/components/SupervisorOnly.tsx` — gate on the role from `user_roles` instead of the local identity role.

Updated to read identity from `useSession()`:

- `src/routes/__root.tsx` — auth gate redirects unauthenticated users to `/auth`; header shows the signed-in name with a sign-out button; supervision/admin links shown by real role.
- `src/routes/planning.tsx`, `src/routes/dashboard.tsx`, `src/routes/supervisor.tsx`, `src/components/PlanAutoSave.tsx`, `src/components/PlanReview.tsx` — use the profile name/role instead of `useTeacher()` / `getTeacher()`.

Kept:

- `src/lib/teacher.ts` stays on disk (still used by `/admin`'s teacher directory listing) but is no longer used for authentication or authorization.

## Notes / decisions to confirm

- Sign-up will be left enabled so existing teachers can create their own accounts; email confirmation stays required unless you want instant sign-in (I can turn on auto-confirm).
- Google sign-in is not included in this step — say the word and I'll add it.
