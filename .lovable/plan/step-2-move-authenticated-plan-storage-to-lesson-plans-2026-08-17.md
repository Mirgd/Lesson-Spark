# Step 2 — Move authenticated plan storage to `lesson_plans`

## How ownership works

- Every save sets `user_id` = the signed-in user's `auth.uid()` (from the current session), never the teacher's name.
- Upserts stay keyed on the existing client plan id: `local_id`, using the existing unique key `(user_id, local_id)` that is already on the table — so the same client-side plan keeps updating one row instead of creating duplicates.
- "My Lessons" reads only rows where `user_id` equals the signed-in user, so a teacher only ever sees their own plans.
- Existing access rules already allow exactly this (a teacher can read/write their own plans; supervisors/admins can read scoped plans), so no rule changes are needed.

## Files that change

- `src/lib/plans-db.ts` — the storage layer. Point reads, writes, autosave-upsert, delete and duplicate at `lesson_plans`; row shape gains `user_id`, `date`, `unit`, `curriculum_ref`; drop `teacher_name` from the save payload; list function filters by the current user id.
- `src/components/PlanAutoSave.tsx` — autosave (typing + every 30s) saves under the signed-in user id instead of the name; keeps the same "saved / saving / failed" indicator wording.
- `src/routes/dashboard.tsx` ("دروسي") — loads only the signed-in user's plans; duplicate, delete, open, update and any single-plan lookup act on the new table and are scoped server-side by both the plan identifier and the signed-in user id (`auth.uid()`), never by client-side list filtering alone.
- `src/routes/planning.tsx` — save/open flow uses the new storage layer.

## Not touched

- Authentication, session hook, and login page stay exactly as they are.
- UI, Arabic copy, and design unchanged.
- `open_plans`, `open_reviews`, `teachers` and all their data stay in place; the 7 existing open plans are not migrated.
- The supervisor/review screens keep reading their current source in this step; they move in a later step so nothing breaks mid-migration.
- No database or access-rule migration is required.
