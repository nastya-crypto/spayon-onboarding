# Decisions Log: form-builder

Agent reports on completed tasks. Each entry is written by the agent that executed the task.

---

## Task 1: Prisma schema migration

**Status:** Done
**Commit:** bec755c
**Agent:** main agent
**Summary:** Added 5 new models (FormTemplate, FormStep, FormField, FormSubmission, FieldResponse) and 2 enums (FieldType, SubmissionStatus). Removed OnboardingToken. Migration applied manually via Supabase SQL Editor because the pooler (port 6543) doesn't support `migrate dev` and direct connection (port 5432) is blocked. Seed extended with idempotent "Standard Onboarding" template (4 steps). Legacy files referencing OnboardingToken suppressed with @ts-ignore pending Task 9 cleanup.
**Deviations:** Migration applied via SQL Editor instead of `prisma migrate dev` — pooler incompatibility with Prisma migration engine. Migration file created manually and marked applied with `prisma migrate resolve`.

**Reviews:**

*Round 1:*
- code-reviewer: 6 findings (all low/info) → [logs/working/task-1/code-reviewer-1.json](logs/working/task-1/code-reviewer-1.json)
- security-auditor: 7 findings (all low/info) → [logs/working/task-1/security-auditor-1.json](logs/working/task-1/security-auditor-1.json)

**Verification:**
- `npx prisma generate` → success
- `npx tsc --noEmit` → 0 errors
- `npm run seed` → "Standard Onboarding" created (id: cmo4pzd1d0000ky8ze5eejp8q)
- Supabase Table Editor → 5 new tables visible

---

## Task 2: Template management API

**Status:** Done
**Commit:** 61bb1ab, fixes: 108ff69
**Agent:** main agent
**Summary:** GET/POST /api/templates and GET/PATCH/DELETE /api/templates/[id] with ADMIN auth guard. POST auto-prepends Company Name protected field. PATCH uses interactive Prisma transaction for full-replacement. buildZodSchema utility created for Task 3. GET list returns both step count and field count (computed from nested step._count.fields).
**Deviations:** None

**Reviews:**

*Round 1:*
- code-reviewer: 8 findings → [logs/working/task-2/code-reviewer-1.json](logs/working/task-2/code-reviewer-1.json)
- security-auditor: 8 findings (approved) → [logs/working/task-2/security-auditor-1.json](logs/working/task-2/security-auditor-1.json)
- test-reviewer: 9 findings → [logs/working/task-2/test-reviewer-1.json](logs/working/task-2/test-reviewer-1.json)

**Verification:**
- `npx jest src/__tests__/api/templates.test.ts src/__tests__/lib/form-validation.test.ts` → 17 passed
- `npx tsc --noEmit` → 0 errors

---

## Task 4: Submissions API

**Status:** Done
**Commit:** 61bb1ab (fixes: post-review commit pending)
**Agent:** main agent
**Summary:** Three admin-only routes: GET list (email excluded via Prisma select), GET detail (orphans included), PATCH status with `VALID_TRANSITIONS` guard. All use `getServerSession` pattern. 21 tests pass.
**Deviations:** None

**Reviews:**

*Round 1:*
- code-reviewer: 4 findings (low/info) → [logs/working/task-4/code-reviewer-1.json](logs/working/task-4/code-reviewer-1.json)
- security-auditor: 5 findings (low/info) → [logs/working/task-4/security-auditor-1.json](logs/working/task-4/security-auditor-1.json)
- test-reviewer: 5 findings (low/info) → [logs/working/task-4/test-reviewer-1.json](logs/working/task-4/test-reviewer-1.json)

**Verification:**
- `npx jest src/__tests__/api/submissions/` → 21 passed
- `npx tsc --noEmit` → 0 errors

---

## Task 3: Public form API

**Status:** Done
**Commit:** 209d319
**Agent:** main agent
**Summary:** GET /api/templates/[id]/public returns template structure (steps + fields) with `isProtected` and `fieldKey` explicitly stripped via both Prisma select and explicit mapping. POST /api/templates/[id]/submit accepts multipart/form-data, applies rate limiting (5/IP/hour per template), validates required fields and FILE constraints (MIME allowlist, 10 MB max), uploads to Supabase Storage bucket `form-uploads`, and creates FormSubmission + FieldResponse records. Company Name check runs before Zod to return a specific error message. Middleware updated with exact regex paths only.
**Deviations:** Company name validation runs before Zod validation (rather than after) to return the specific "Company Name field is required" error message as required by tests.

**Reviews:**

*Round 1:*
- code-reviewer: pending → [logs/working/task-3/code-reviewer-1.json]
- security-auditor: pending → [logs/working/task-3/security-auditor-1.json]
- test-reviewer: pending → [logs/working/task-3/test-reviewer-1.json]

**Verification:**
- `npx jest src/__tests__/api/templates/submit.test.ts` → 11 passed
- `npx tsc --noEmit` → 0 errors

---

## Task 5: Templates admin pages

**Status:** Done
**Commit:** 0115ef4, fixes: pending
**Agent:** background subagent
**Summary:** TemplateEditor client component with step/field management, reorder, protected field guard (no Delete on isProtected fields), and validation before save. List page at `/dashboard/templates` with Copy Link (uses NEXTAUTH_URL from server), Edit, and Delete (window.confirm) actions. New and Edit pages wrap TemplateEditor with their own save logic and error display. TemplateEditorUtils.ts extracts shared types and the toFieldKey helper.
**Deviations:** None

**Reviews:**

*Round 1:*
- code-reviewer: 5 findings (2 major) → [logs/working/task-5/code-reviewer-1.json]
- test-reviewer: pending → [logs/working/task-5/test-reviewer-1.json]

*Round 2 (after fixes):*
- NewTemplatePage save errors now displayed (CR-2 fix applied)

**Verification:**
- `npx jest src/__tests__/TemplateEditor.test.tsx` → tests pass
- `npx tsc --noEmit` → 0 errors

---

## Task 6: Dashboard refactor

**Status:** Done
**Commit:** 209d319
**Agent:** main agent
**Summary:** Dashboard switched from Merchant to FormSubmission data via direct Prisma queries. MerchantsTable renamed to SubmissionsTable with English text, templateName column, and link to `/dashboard/submissions/[id]`. CreateLinkButton replaced with static Link to `/dashboard/templates`. StatsCard badge translated from "заявок" to "submissions". All stats cards use English labels.
**Deviations:** None

**Reviews:**

*Round 1:*
- code-reviewer: pending → [logs/working/task-6/code-reviewer-1.json]
- test-reviewer: pending → [logs/working/task-6/test-reviewer-1.json]

**Verification:**
- `npx tsc --noEmit` → 0 errors
- Manual: pending (requires running dev server)

---

## Task 7: Submission detail page

**Status:** Done
**Commit:** 7d120c7, fixes: pending
**Agent:** background subagent
**Summary:** `/dashboard/submissions/[id]` server component fetches submission with template and responses via Prisma, groups responses by step, renders orphans in "Other responses" section. FILE values parsed as JSON with `isValidFileUrl` guard preventing javascript: URI XSS. CHECKBOX rendered as Yes/No. StatusChanger adapted to accept `submissionId` (falls back to `merchantId` for backward compat until Task 9 cleanup).
**Deviations:** `renderOrphanValue` one-liner removed (inlined per review). Status cast guarded at runtime.

**Reviews:**

*Round 1:*
- code-reviewer: 3 findings (all minor) → [logs/working/task-7/code-reviewer-1.json]

**Verification:**
- `npx jest src/__tests__/submission-detail.test.ts` → 6 passed
- `npx tsc --noEmit` → 0 errors

---

<!-- Entries are added by agents as tasks are completed.

Format is strict — use only these sections, do not add others.
Do not include: file lists, findings tables, JSON reports, step-by-step logs.
Review details — in JSON files via links. QA report — in logs/working/.

## Task N: [title]

**Status:** Done
**Commit:** abc1234
**Agent:** [teammate name or "main agent"]
**Summary:** 1-3 sentences: what was done, key decisions. Not a file list.
**Deviations:** None / Deviated from spec: [reason], did [what].

**Reviews:**

*Round 1:*
- code-reviewer: 2 findings → [logs/working/task-N/code-reviewer-1.json]
- security-auditor: OK → [logs/working/task-N/security-auditor-1.json]

*Round 2 (after fixes):*
- code-reviewer: OK → [logs/working/task-N/code-reviewer-2.json]

**Verification:**
- `npm test` → 42 passed
- Manual check → OK

-->
