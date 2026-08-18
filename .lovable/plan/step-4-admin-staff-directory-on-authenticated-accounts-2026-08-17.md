# Step 4 — Admin staff directory on authenticated accounts

## A. How /admin gets its data today

`src/routes/admin.tsx` loads two legacy sources in parallel:

- `listTeachers()` from `src/lib/teacher.ts` → `public.teachers` (name-based rows, open access).
- `listOpenPlans()` from `src/lib/plans-db.ts` → `public.open_plans`.

Plan counts are matched by **teacher name string** (`open_plans.teacher_name`), and any plan name not
found in `teachers` is injected as a synthetic extra row (`id: "x-<name>"`). Role is a single text
field on `teachers.role`, rendered as either "معلم/ة" or "مشرف/ة". The page is wrapped in
`SupervisorOnly`.

## B. Files that change

- `src/lib/supervision.ts` — add one read function `listStaffDirectory()` returning one entry per
  authenticated user: profile fields + all roles + own plan counts. Existing functions
  (`listTeacherProfiles`, `listAllPlans`, `listPlanReviews`, `upsertPlanReview`) stay untouched.
- `src/routes/admin.tsx` — rewrite the data layer of the page to use the new function; keep the same
  Arabic RTL layout, search, refresh, Excel export and statistics cards.

Nothing else changes. `src/lib/teacher.ts`, `open_plans`, `open_reviews`, `teachers`,
`/supervisor`, `/lessons`, auth, and RLS are all left as they are.

## C. Combining profiles + user_roles without duplicates

1. Read `profiles` (id, full_name, email, school, branch, stage, subject, is_active).
2. Read `user_roles` (user_id, role) — all rows, no role filter.
3. Group roles into a `Map<user_id, AppRole[]>`.
4. Build the table by iterating **profiles** (one row per person) and attaching the role array.
   A user with `teacher + supervisor` produces exactly one row whose role cell shows
   "معلم/ة · مشرف/ة". A profile with no role row shows "معلم/ة" as the default label.

Because the row list is keyed by `profiles.id`, multi-role users cannot duplicate.

## D. Plan counts

Read `lesson_plans` (id, user_id, status, updated_at) — supervisors receive all rows under existing
access rules — then aggregate per `user_id`:

- `count` = number of that user's plans, joined via `lesson_plans.user_id = profiles.id`.
- `complete` = plans with `status = 'complete'`.
- `last` = latest `updated_at`, shown as "آخر تحديث".

`open_plans` is not read by the Admin page any more, so a supervisor who also writes lessons shows
their own real `lesson_plans` count.

## E. Why the new supervisor appears automatically

The directory is derived from `profiles`, so any account that exists there appears with no manual
step. Its role cell is computed from `user_roles`, so the promoted account
(`teacher + supervisor`) shows both labels immediately after refresh.

## F. Current access rules

No change needed. Existing rules already allow the reads for a supervisor account:

- `profiles` — supervisors read all profiles.
- `user_roles` — supervisors read all roles.
- `lesson_plans` — supervisors read all plans.

Admin and school-admin accounts also have their own read rules; `SupervisorOnly` continues to gate
the page (it allows any non-teacher role).

## G. Required rule changes

None. This is a frontend + query change only.

## UI notes

- Columns become: الاسم (with email underneath), الدور/الأدوار, المدرسة · الفرع, المرحلة, المادة,
  الخطط, آخر تحديث. The الجوال column is dropped because `profiles` has no phone field.
- Statistics cards become: عدد المستخدمين، عدد الخطط، خطط مكتملة — computed from the new data.
- Search matches name, email, school and subject.
- Excel export mirrors the new columns.
- Page subtitle updated to reflect account-based data instead of "بدون تسجيل دخول".
